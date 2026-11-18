package com.lifeatlas.app.wakeword

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant

/**
 * Manages the Overnight Endurance Test mode for the Hey Atlas wake-word feasibility experiment.
 *
 * Guarantees & Architecture:
 * - Persists all snapshots, detections, and lifecycle events to local JSON so data survives
 *   process destruction or Android OS low-memory kills.
 * - Uses monotonic time (SystemClock.elapsedRealtime()) for all duration, rate, and gap calculations
 *   to remain immune to wall-clock time sync or timezone adjustments.
 * - Uses wall-clock time (Instant.now()) for human-readable display timestamps.
 * - Reuses the existing foreground service and AudioRecord capture loop to avoid waking the CPU
 *   solely for metrics collection.
 * - Distinguishes between service-running time and confirmed active-listening time.
 * - Records only non-audio telemetry; never stores, uploads, or logs raw audio PCM.
 * - Provides baseline test comparison (Atlas listening disabled) so the user can accurately evaluate
 *   wake-word battery overhead versus the device's native background standby drain.
 */
object OvernightTestManager {
    private const val TAG = "OvernightTestManager"
    private const val FILE_NAME = "overnight_test.json"
    private const val SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000L // ~15 minutes
    private const val GAP_THRESHOLD_MS = 25 * 60 * 1000L // >25 min gap indicates monitoring interruption / deep Doze
    private const val MAX_SNAPSHOTS = 120 // Up to 30 hours at 15-min cadence
    private const val MAX_DETECTIONS = 200
    private const val MAX_INTERRUPTIONS = 100

    private val lock = Any()

    private fun file(context: Context): File {
        val dir = File(context.noBackupFilesDir, "wakeword")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, FILE_NAME)
    }

    private fun readRootLocked(context: Context): JSONObject {
        val f = file(context)
        if (f.isFile) {
            try {
                return JSONObject(f.readText())
            } catch (e: Exception) {
                Log.w(TAG, "Failed to parse overnight_test.json: ${e.message}")
            }
        }
        return JSONObject()
    }

    private fun writeRootLocked(context: Context, root: JSONObject) {
        val f = file(context)
        val tmp = File(f.parentFile, "$FILE_NAME.tmp")
        tmp.writeText(root.toString())
        if (f.exists()) f.delete()
        tmp.renameTo(f)
    }

    fun isTestRunning(context: Context): Boolean {
        synchronized(lock) {
            val root = readRootLocked(context)
            val active = root.optJSONObject("activeTest") ?: return false
            return active.optString("status") == "running"
        }
    }

    fun isTestBaseline(context: Context): Boolean {
        synchronized(lock) {
            val root = readRootLocked(context)
            val active = root.optJSONObject("activeTest") ?: return false
            return active.optBoolean("isBaseline", false)
        }
    }

    fun startTest(context: Context, isBaseline: Boolean): JSONObject {
        synchronized(lock) {
            val root = readRootLocked(context)
            val existing = root.optJSONObject("activeTest")
            if (existing != null && existing.optString("status") == "running") {
                Log.i(TAG, "Overnight test already running; returning active test.")
                return buildReportJsonLocked(context, existing)
            }

            val nowWall = Instant.now().toString()
            val nowElapsed = SystemClock.elapsedRealtime()
            val battery = getBatterySnapshot(context)
            val env = WakeWordDiagnostics.captureEnvironment(context)

            val testId = "overnight-${System.currentTimeMillis()}"
            val test = JSONObject()
                .put("testId", testId)
                .put("isBaseline", isBaseline)
                .put("status", "running")
                .put("startedAt", nowWall)
                .put("startElapsedRealtimeMs", nowElapsed)
                .put("batteryStartPct", battery.batteryPct)
                .put("isChargingStart", battery.isCharging)
                .put("plugTypeStart", battery.plugType)
                .put("interactiveStart", env.interactive)
                .put("keyguardLockedStart", env.keyguardLocked)
                .put("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}")
                .put("sdkInt", Build.VERSION.SDK_INT)
                .put("serviceRunningDurationMs", 0L)
                .put("confirmedActiveListeningDurationMs", 0L)
                .put("lastSnapshotElapsedRealtimeMs", nowElapsed)
                .put("lastServiceTickElapsedRealtimeMs", nowElapsed)
                .put("snapshots", JSONArray())
                .put("detections", JSONArray())
                .put("interruptions", JSONArray())

            // Initial snapshot #0
            val initialSnapshot = createSnapshot(
                context = context,
                nowWall = nowWall,
                nowElapsed = nowElapsed,
                startElapsed = nowElapsed,
                confirmedListeningMs = 0L,
                serviceRunningMs = 0L,
                isMicCapturing = !isBaseline && AtlasWakeWordService.isMicActuallyCapturing,
                serviceRunning = !isBaseline && AtlasWakeWordService.isServiceRunning,
                detectionsCount = 0,
                interruptionsCount = 0
            )
            val snapshots = JSONArray().put(initialSnapshot)
            test.put("snapshots", snapshots)

            root.put("activeTest", test)
            writeRootLocked(context, root)

            // In baseline mode, wake-word service should be stopped; schedule lightweight alarm for 15-min cadence.
            if (isBaseline) {
                scheduleBaselineAlarm(context)
            } else {
                cancelBaselineAlarm(context)
            }

            WakeWordDiagnostics.updateServiceState(
                context,
                if (isBaseline) "overnight_baseline" else "overnight_active",
                "Started overnight test ($testId, baseline=$isBaseline, startBattery=${battery.batteryPct}%)"
            )

            return buildReportJsonLocked(context, test)
        }
    }

    fun stopTest(context: Context): JSONObject {
        synchronized(lock) {
            val root = readRootLocked(context)
            val active = root.optJSONObject("activeTest")
            if (active == null || active.optString("status") != "running") {
                val completed = root.optJSONObject("lastCompletedTest")
                return if (completed != null) {
                    buildReportJsonLocked(context, completed)
                } else {
                    buildEmptyReportJson()
                }
            }

            val nowWall = Instant.now().toString()
            val nowElapsed = SystemClock.elapsedRealtime()
            val startElapsed = active.optLong("startElapsedRealtimeMs", nowElapsed)
            val totalDurationMs = (nowElapsed - startElapsed).coerceAtLeast(0L)

            val battery = getBatterySnapshot(context)
            val env = WakeWordDiagnostics.captureEnvironment(context)

            // Final snapshot
            val confirmedMs = active.optLong("confirmedActiveListeningDurationMs", 0L)
            val serviceMs = active.optLong("serviceRunningDurationMs", 0L)
            val detections = active.optJSONArray("detections") ?: JSONArray()
            val interruptions = active.optJSONArray("interruptions") ?: JSONArray()

            val finalSnapshot = createSnapshot(
                context = context,
                nowWall = nowWall,
                nowElapsed = nowElapsed,
                startElapsed = startElapsed,
                confirmedListeningMs = confirmedMs,
                serviceRunningMs = serviceMs,
                isMicCapturing = !active.optBoolean("isBaseline", false) && AtlasWakeWordService.isMicActuallyCapturing,
                serviceRunning = !active.optBoolean("isBaseline", false) && AtlasWakeWordService.isServiceRunning,
                detectionsCount = detections.length(),
                interruptionsCount = interruptions.length()
            )

            val snapshots = active.optJSONArray("snapshots") ?: JSONArray()
            appendBounded(snapshots, finalSnapshot, MAX_SNAPSHOTS)
            active.put("snapshots", snapshots)

            active.put("status", "completed")
            active.put("endedAt", nowWall)
            active.put("endElapsedRealtimeMs", nowElapsed)
            active.put("totalDurationMs", totalDurationMs)
            active.put("batteryEndPct", battery.batteryPct)
            active.put("isChargingEnd", battery.isCharging)
            active.put("plugTypeEnd", battery.plugType)
            active.put("interactiveEnd", env.interactive)
            active.put("keyguardLockedEnd", env.keyguardLocked)

            // Battery calculations
            val startBattery = active.optInt("batteryStartPct", -1)
            val isChargingStart = active.optBoolean("isChargingStart", false)
            val isChargingEnd = battery.isCharging
            val (drainPct, drainPerHour) = computeBatteryStats(
                startBattery,
                battery.batteryPct,
                isChargingStart,
                isChargingEnd,
                totalDurationMs
            )
            active.put("batteryDrainPct", drainPct)
            active.put("drainPerHour", drainPerHour)

            // Monitoring gaps calculation
            val gaps = detectMonitoringGaps(snapshots)
            active.put("monitoringGaps", gaps)

            // Save to completed and baseline slots
            root.put("lastCompletedTest", active)
            if (active.optBoolean("isBaseline", false)) {
                root.put("lastCompletedBaseline", active)
            } else {
                root.put("lastCompletedActive", active)
            }
            root.remove("activeTest")
            writeRootLocked(context, root)

            cancelBaselineAlarm(context)

            val hours = totalDurationMs / 3600000.0
            WakeWordDiagnostics.updateServiceState(
                context,
                "overnight_completed",
                "Completed overnight test (${active.optString("testId")}, duration=${"%.1f".format(hours)}h, drain=${drainPct}%)"
            )

            return buildReportJsonLocked(context, active)
        }
    }

    /**
     * Called by the active capture loop in AtlasWakeWordService while reading PCM frames.
     * Accumulates confirmed active listening time and triggers periodic snapshots.
     */
    fun onAudioTick(context: Context, nowElapsed: Long, lastActiveElapsed: Long) {
        synchronized(lock) {
            val root = readRootLocked(context)
            val active = root.optJSONObject("activeTest") ?: return
            if (active.optString("status") != "running") return
            if (active.optBoolean("isBaseline", false)) return

            // Accumulate active listening duration if delta is realistic (< 2000 ms)
            val delta = clampTickDelta(nowElapsed, lastActiveElapsed)
            if (delta > 0L) {
                val currentListeningMs = active.optLong("confirmedActiveListeningDurationMs", 0L) + delta
                active.put("confirmedActiveListeningDurationMs", currentListeningMs)
            }

            // Accumulate service running duration
            val lastServiceTick = active.optLong("lastServiceTickElapsedRealtimeMs", nowElapsed)
            val serviceDelta = clampTickDelta(nowElapsed, lastServiceTick)
            if (serviceDelta > 0L) {
                val currentServiceMs = active.optLong("serviceRunningDurationMs", 0L) + serviceDelta
                active.put("serviceRunningDurationMs", currentServiceMs)
            }
            active.put("lastServiceTickElapsedRealtimeMs", nowElapsed)

            // Check if ~15 minutes elapsed since last snapshot
            val lastSnapshotElapsed = active.optLong("lastSnapshotElapsedRealtimeMs", 0L)
            if (nowElapsed - lastSnapshotElapsed >= SNAPSHOT_INTERVAL_MS) {
                recordPeriodicSnapshotLocked(context, active, nowElapsed, isMicCapturing = true, isServiceRunning = true)
            }

            writeRootLocked(context, root)
        }
    }

    /**
     * Called when wake-word engine detects the target phrase.
     */
    fun onDetection(context: Context, phrase: String, score: Float, latencyMs: Double) {
        synchronized(lock) {
            val root = readRootLocked(context)
            val active = root.optJSONObject("activeTest") ?: return
            if (active.optString("status") != "running") return

            val nowWall = Instant.now().toString()
            val nowElapsed = SystemClock.elapsedRealtime()
            val env = WakeWordDiagnostics.captureEnvironment(context)

            val detection = JSONObject()
                .put("at", nowWall)
                .put("elapsedRealtimeMs", nowElapsed)
                .put("targetPhrase", phrase)
                .put("score", score.toDouble())
                .put("latencyMs", latencyMs)
                .put("interactive", env.interactive)
                .put("keyguardLocked", env.keyguardLocked)

            val detections = active.optJSONArray("detections") ?: JSONArray()
            appendBounded(detections, detection, MAX_DETECTIONS)
            active.put("detections", detections)

            writeRootLocked(context, root)
        }
    }

    /**
     * Called on unexpected service state changes, pauses, mic competition, or audio start errors.
     */
    fun onInterruption(context: Context, kind: String, reason: String) {
        synchronized(lock) {
            val root = readRootLocked(context)
            val active = root.optJSONObject("activeTest") ?: return
            if (active.optString("status") != "running") return

            val nowWall = Instant.now().toString()
            val nowElapsed = SystemClock.elapsedRealtime()

            val interruption = JSONObject()
                .put("at", nowWall)
                .put("elapsedRealtimeMs", nowElapsed)
                .put("kind", kind)
                .put("reason", reason)

            val interruptions = active.optJSONArray("interruptions") ?: JSONArray()
            appendBounded(interruptions, interruption, MAX_INTERRUPTIONS)
            active.put("interruptions", interruptions)

            writeRootLocked(context, root)
        }
    }

    fun onServiceStateChanged(context: Context, state: String, reason: String = "") {
        if (state == "stopped" || state == "paused_mic_blocked" || state == "error") {
            onInterruption(context, "service_state:$state", reason.ifBlank { "Service entered $state state" })
        }
    }

    fun takePeriodicSnapshotIfNeeded(context: Context, isMicActuallyCapturing: Boolean) {
        synchronized(lock) {
            val root = readRootLocked(context)
            val active = root.optJSONObject("activeTest") ?: return
            if (active.optString("status") != "running") return

            val nowElapsed = SystemClock.elapsedRealtime()
            val lastSnapshotElapsed = active.optLong("lastSnapshotElapsedRealtimeMs", 0L)
            if (nowElapsed - lastSnapshotElapsed >= (SNAPSHOT_INTERVAL_MS - 60_000L)) {
                val serviceRunning = AtlasWakeWordService.isServiceRunning
                recordPeriodicSnapshotLocked(context, active, nowElapsed, isMicActuallyCapturing, serviceRunning)
                writeRootLocked(context, root)
            }

            if (active.optBoolean("isBaseline", false)) {
                scheduleBaselineAlarm(context)
            }
        }
    }

    private fun recordPeriodicSnapshotLocked(
        context: Context,
        active: JSONObject,
        nowElapsed: Long,
        isMicCapturing: Boolean,
        isServiceRunning: Boolean
    ) {
        val nowWall = Instant.now().toString()
        val startElapsed = active.optLong("startElapsedRealtimeMs", nowElapsed)
        val confirmedMs = active.optLong("confirmedActiveListeningDurationMs", 0L)
        val serviceMs = active.optLong("serviceRunningDurationMs", 0L)
        val detections = active.optJSONArray("detections") ?: JSONArray()
        val interruptions = active.optJSONArray("interruptions") ?: JSONArray()

        val snap = createSnapshot(
            context = context,
            nowWall = nowWall,
            nowElapsed = nowElapsed,
            startElapsed = startElapsed,
            confirmedListeningMs = confirmedMs,
            serviceRunningMs = serviceMs,
            isMicCapturing = isMicCapturing,
            serviceRunning = isServiceRunning,
            detectionsCount = detections.length(),
            interruptionsCount = interruptions.length()
        )

        val snapshots = active.optJSONArray("snapshots") ?: JSONArray()
        appendBounded(snapshots, snap, MAX_SNAPSHOTS)
        active.put("snapshots", snapshots)
        active.put("lastSnapshotElapsedRealtimeMs", nowElapsed)
    }

    private fun createSnapshot(
        context: Context,
        nowWall: String,
        nowElapsed: Long,
        startElapsed: Long,
        confirmedListeningMs: Long,
        serviceRunningMs: Long,
        isMicCapturing: Boolean,
        serviceRunning: Boolean,
        detectionsCount: Int,
        interruptionsCount: Int
    ): JSONObject {
        val battery = getBatterySnapshot(context)
        val env = WakeWordDiagnostics.captureEnvironment(context)
        val elapsedMin = ((nowElapsed - startElapsed) / 60000.0).coerceAtLeast(0.0)

        return JSONObject()
            .put("timestamp", nowWall)
            .put("elapsedRealtimeMs", nowElapsed)
            .put("elapsedMinutes", elapsedMin)
            .put("batteryPercent", battery.batteryPct)
            .put("isCharging", battery.isCharging)
            .put("plugType", battery.plugType)
            .put("interactive", env.interactive)
            .put("keyguardLocked", env.keyguardLocked)
            .put("serviceRunning", serviceRunning)
            .put("micActuallyCapturing", isMicCapturing)
            .put("confirmedListeningDurationMs", confirmedListeningMs)
            .put("serviceRunningDurationMs", serviceRunningMs)
            .put("detectionsSoFar", detectionsCount)
            .put("interruptionsSoFar", interruptionsCount)
    }

    internal data class GapInfo(val gapMinutes: Double, val startAt: String, val endAt: String)

    internal fun computeBatteryStats(
        startPct: Int,
        currentPct: Int,
        isChargingStart: Boolean,
        isChargingEnd: Boolean,
        durationMs: Long
    ): Pair<Int, Double> {
        val drainPct = if (!isChargingStart && !isChargingEnd && startPct >= 0 && currentPct >= 0) {
            (startPct - currentPct).coerceAtLeast(0)
        } else {
            0
        }
        val hours = durationMs / 3600000.0
        val drainPerHour = if (hours > 0.05 && drainPct > 0) {
            drainPct / hours
        } else {
            0.0
        }
        return Pair(drainPct, drainPerHour)
    }

    internal fun clampTickDelta(nowElapsed: Long, lastElapsed: Long): Long {
        val delta = nowElapsed - lastElapsed
        return if (delta in 1..2000L) delta else 0L
    }

    internal fun findMonitoringGaps(
        elapsedTimestampsMs: List<Long>,
        wallTimestamps: List<String>
    ): List<GapInfo> {
        if (elapsedTimestampsMs.size < 2 || elapsedTimestampsMs.size != wallTimestamps.size) return emptyList()
        val gaps = mutableListOf<GapInfo>()
        for (i in 1 until elapsedTimestampsMs.size) {
            val diffMs = elapsedTimestampsMs[i] - elapsedTimestampsMs[i - 1]
            if (diffMs > GAP_THRESHOLD_MS) {
                gaps.add(GapInfo(diffMs / 60000.0, wallTimestamps[i - 1], wallTimestamps[i]))
            }
        }
        return gaps
    }

    private fun detectMonitoringGaps(snapshots: JSONArray): JSONArray {
        val gaps = JSONArray()
        if (snapshots.length() < 2) return gaps

        val elapsed = mutableListOf<Long>()
        val walls = mutableListOf<String>()
        for (i in 0 until snapshots.length()) {
            val s = snapshots.getJSONObject(i)
            elapsed.add(s.optLong("elapsedRealtimeMs", 0L))
            walls.add(s.optString("timestamp"))
        }

        for (g in findMonitoringGaps(elapsed, walls)) {
            gaps.put(
                JSONObject()
                    .put("gapMinutes", g.gapMinutes)
                    .put("startAt", g.startAt)
                    .put("endAt", g.endAt)
                    .put("reasonNote", "Cadence gap of ${"%.1f".format(g.gapMinutes)} min (likely deep OEM Doze / maintenance window delay)")
            )
        }
        return gaps
    }

    fun getReport(context: Context): JSONObject {
        synchronized(lock) {
            val root = readRootLocked(context)
            val active = root.optJSONObject("activeTest")
            val completed = root.optJSONObject("lastCompletedTest")
            val baseline = root.optJSONObject("lastCompletedBaseline")
            val activeCompleted = root.optJSONObject("lastCompletedActive")

            val out = JSONObject()
            out.put("isTestRunning", active != null && active.optString("status") == "running")
            if (active != null) {
                out.put("activeTest", buildReportJsonLocked(context, active))
            }
            if (completed != null) {
                out.put("lastCompletedTest", buildReportJsonLocked(context, completed))
            }
            if (baseline != null) {
                out.put("lastCompletedBaseline", buildReportJsonLocked(context, baseline))
            }
            if (activeCompleted != null) {
                out.put("lastCompletedActive", buildReportJsonLocked(context, activeCompleted))
            }

            return out
        }
    }

    private fun buildReportJsonLocked(context: Context, test: JSONObject): JSONObject {
        val out = JSONObject(test.toString())
        val isRunning = test.optString("status") == "running"
        val nowElapsed = SystemClock.elapsedRealtime()
        val startElapsed = test.optLong("startElapsedRealtimeMs", nowElapsed)
        val durationMs = if (isRunning) {
            (nowElapsed - startElapsed).coerceAtLeast(0L)
        } else {
            test.optLong("totalDurationMs", (nowElapsed - startElapsed).coerceAtLeast(0L))
        }

        val hours = durationMs / 3600000.0
        val confirmedMs = test.optLong("confirmedActiveListeningDurationMs", 0L)
        val serviceMs = test.optLong("serviceRunningDurationMs", 0L)
        val pausedOrSilencedMs = (serviceMs - confirmedMs).coerceAtLeast(0L)

        val startBattery = test.optInt("batteryStartPct", -1)
        val currentBattery = if (isRunning) getBatterySnapshot(context).batteryPct else test.optInt("batteryEndPct", -1)
        val isChargingStart = test.optBoolean("isChargingStart", false)
        val isChargingEnd = if (isRunning) getBatterySnapshot(context).isCharging else test.optBoolean("isChargingEnd", false)

        val (drainPct, drainPerHour) = computeBatteryStats(
            startBattery,
            currentBattery,
            isChargingStart,
            isChargingEnd,
            durationMs
        )

        out.put("durationMs", durationMs)
        out.put("durationHours", hours)
        out.put("confirmedActiveListeningDurationMs", confirmedMs)
        out.put("serviceRunningDurationMs", serviceMs)
        out.put("pausedOrSilencedDurationMs", pausedOrSilencedMs)
        out.put("batteryCurrentPct", currentBattery)
        out.put("batteryDrainPct", drainPct)
        out.put("drainPerHour", drainPerHour)

        if (!out.has("monitoringGaps")) {
            val snapshots = test.optJSONArray("snapshots") ?: JSONArray()
            out.put("monitoringGaps", detectMonitoringGaps(snapshots))
        }

        out.put(
            "attributionDisclaimer",
            "Battery drain reflects total device consumption (Android OS, cellular/Wi-Fi standby, background sync, display-off baseline), not Atlas alone. For isolated attribution, compare with a Baseline test."
        )

        return out
    }

    fun generateCsv(context: Context): String {
        synchronized(lock) {
            val root = readRootLocked(context)
            val test = root.optJSONObject("activeTest") ?: root.optJSONObject("lastCompletedTest") ?: return "# No overnight test data found."

            val report = buildReportJsonLocked(context, test)
            val sb = StringBuilder()

            sb.append("# Hey Atlas Overnight Endurance Test Diagnostic Report\n")
            sb.append("# Test ID: ${report.optString("testId")}\n")
            sb.append("# Mode: ${if (report.optBoolean("isBaseline")) "Baseline Standby (Listening Disabled)" else "Active Wake-Word Detection"}\n")
            sb.append("# Status: ${report.optString("status")}\n")
            sb.append("# Started At: ${report.optString("startedAt")}\n")
            sb.append("# Ended At: ${report.optString("endedAt", "In Progress")}\n")
            sb.append("# Total Duration Hours: ${"%.2f".format(report.optDouble("durationHours", 0.0))}\n")
            sb.append("# Service Running Hours: ${"%.2f".format(report.optLong("serviceRunningDurationMs", 0L) / 3600000.0)}\n")
            sb.append("# Confirmed Listening Hours: ${"%.2f".format(report.optLong("confirmedActiveListeningDurationMs", 0L) / 3600000.0)}\n")
            sb.append("# Battery Start: ${report.optInt("batteryStartPct")}% (${report.optString("plugTypeStart")})\n")
            sb.append("# Battery End / Current: ${report.optInt("batteryCurrentPct")}% (${report.optString("plugTypeEnd", report.optString("plugTypeStart"))})\n")
            sb.append("# Total Battery Drain: ${report.optInt("batteryDrainPct")}%\n")
            sb.append("# Average Drain Rate: ${"%.2f".format(report.optDouble("drainPerHour", 0.0))}% / hr\n")
            sb.append("# Detections Count: ${report.optJSONArray("detections")?.length() ?: 0}\n")
            sb.append("# Interruptions Count: ${report.optJSONArray("interruptions")?.length() ?: 0}\n")
            sb.append("# Disclaimer: Battery drain reflects total device consumption across the entire device, not Atlas alone.\n")
            sb.append("\n")

            // Snapshots table
            sb.append("SnapshotIndex,Timestamp,ElapsedMinutes,BatteryPct,IsCharging,PlugType,ScreenOn,Locked,ServiceRunning,MicCapturing,ConfirmedListeningMin,DetectionsSoFar,InterruptionsSoFar\n")
            val snapshots = report.optJSONArray("snapshots") ?: JSONArray()
            for (i in 0 until snapshots.length()) {
                val s = snapshots.getJSONObject(i)
                sb.append("${i + 1},")
                sb.append("\"${s.optString("timestamp")}\",")
                sb.append("${"%.2f".format(s.optDouble("elapsedMinutes", 0.0))},")
                sb.append("${s.optInt("batteryPercent")},")
                sb.append("${s.optBoolean("isCharging")},")
                sb.append("\"${s.optString("plugType")}\",")
                sb.append("${s.optBoolean("interactive")},")
                sb.append("${s.optBoolean("keyguardLocked")},")
                sb.append("${s.optBoolean("serviceRunning")},")
                sb.append("${s.optBoolean("micActuallyCapturing")},")
                sb.append("${"%.2f".format(s.optLong("confirmedListeningDurationMs", 0L) / 60000.0)},")
                sb.append("${s.optInt("detectionsSoFar")},")
                sb.append("${s.optInt("interruptionsSoFar")}\n")
            }

            // Detections table
            sb.append("\n# Detections Log (Zero Raw Audio)\n")
            sb.append("DetectionIndex,Timestamp,ElapsedMinutes,TargetPhrase,Score,LatencyMs,ScreenOn,Locked\n")
            val detections = report.optJSONArray("detections") ?: JSONArray()
            val startElapsed = report.optLong("startElapsedRealtimeMs", 0L)
            for (i in 0 until detections.length()) {
                val d = detections.getJSONObject(i)
                val elMin = ((d.optLong("elapsedRealtimeMs", startElapsed) - startElapsed) / 60000.0).coerceAtLeast(0.0)
                sb.append("${i + 1},")
                sb.append("\"${d.optString("at")}\",")
                sb.append("${"%.2f".format(elMin)},")
                sb.append("\"${d.optString("targetPhrase")}\",")
                sb.append("${"%.3f".format(d.optDouble("score"))},")
                sb.append("${"%.1f".format(d.optDouble("latencyMs"))},")
                sb.append("${d.optBoolean("interactive")},")
                sb.append("${d.optBoolean("keyguardLocked")}\n")
            }

            // Interruptions table
            sb.append("\n# Service Interruptions & Conflicts\n")
            sb.append("InterruptionIndex,Timestamp,Kind,Reason\n")
            val interruptions = report.optJSONArray("interruptions") ?: JSONArray()
            for (i in 0 until interruptions.length()) {
                val u = interruptions.getJSONObject(i)
                sb.append("${i + 1},")
                sb.append("\"${u.optString("at")}\",")
                sb.append("\"${u.optString("kind")}\",")
                sb.append("\"${u.optString("reason").replace("\"", "'")}\"\n")
            }

            return sb.toString()
        }
    }

    fun clear(context: Context) {
        synchronized(lock) {
            val f = file(context)
            if (f.exists()) f.delete()
            cancelBaselineAlarm(context)
        }
    }

    private fun appendBounded(array: JSONArray, item: JSONObject, max: Int) {
        if (array.length() >= max) {
            // Shift older elements if exceeding max
            val list = mutableListOf<JSONObject>()
            for (i in 1 until array.length()) {
                list.add(array.getJSONObject(i))
            }
            list.add(item)
            while (array.length() > 0) array.remove(0)
            for (obj in list) array.put(obj)
        } else {
            array.put(item)
        }
    }

    data class BatterySnapshot(val batteryPct: Int, val isCharging: Boolean, val plugType: String)

    private fun getBatterySnapshot(context: Context): BatterySnapshot {
        return try {
            val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val bStatus = context.registerReceiver(null, ifilter)
            val level = bStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = bStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            val batteryPct = if (level >= 0 && scale > 0) (level * 100 / scale) else -1
            val status = bStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
            val chargePlug = bStatus?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
            val plugType = when (chargePlug) {
                BatteryManager.BATTERY_PLUGGED_AC -> "AC"
                BatteryManager.BATTERY_PLUGGED_USB -> "USB"
                BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Wireless"
                else -> "None (Battery)"
            }
            BatterySnapshot(batteryPct, isCharging, plugType)
        } catch (e: Exception) {
            BatterySnapshot(-1, false, "Unknown")
        }
    }

    private fun scheduleBaselineAlarm(context: Context) {
        try {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, OvernightSnapshotReceiver::class.java)
            val pi = PendingIntent.getBroadcast(
                context,
                9101,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            // Inexact alarm using ELAPSED_REALTIME (does NOT aggressively wake the device from deep sleep)
            val triggerAt = SystemClock.elapsedRealtime() + SNAPSHOT_INTERVAL_MS
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME, triggerAt, pi)
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME, triggerAt, pi)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to schedule baseline alarm: ${e.message}")
        }
    }

    private fun cancelBaselineAlarm(context: Context) {
        try {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, OvernightSnapshotReceiver::class.java)
            val pi = PendingIntent.getBroadcast(
                context,
                9101,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pi != null) am.cancel(pi)
        } catch (_: Exception) {
        }
    }

    private fun buildEmptyReportJson(): JSONObject {
        return JSONObject()
            .put("isTestRunning", false)
            .put("activeTest", JSONObject.NULL)
            .put("lastCompletedTest", JSONObject.NULL)
    }
}
