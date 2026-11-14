package com.lifeatlas.app.wakeword

import android.app.ActivityManager
import android.app.KeyguardManager
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.PowerManager
import android.os.Process
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant

data class DeviceEnvironmentSnapshot(
    val interactive: Boolean,
    val keyguardLocked: Boolean,
    val batterySaverOn: Boolean,
    val ignoringBatteryOptimizations: Boolean,
    val networkOnline: Boolean,
    val musicActive: Boolean,
    val inCallOrCommunication: Boolean,
    val bluetoothAudioConnected: Boolean
) {
    fun toJson(): JSONObject = JSONObject()
        .put("interactive", interactive)
        .put("keyguardLocked", keyguardLocked)
        .put("batterySaverOn", batterySaverOn)
        .put("ignoringBatteryOptimizations", ignoringBatteryOptimizations)
        .put("networkOnline", networkOnline)
        .put("musicActive", musicActive)
        .put("inCallOrCommunication", inCallOrCommunication)
        .put("bluetoothAudioConnected", bluetoothAudioConnected)
}

/**
 * Persists only non-audio wake-word experiment metrics, service lifecycle events,
 * and user-logged test results. Never stores raw microphone PCM or transcripts.
 */
object WakeWordDiagnostics {
    private const val FILE_NAME = "diagnostics.json"
    private const val MAX_DETECTIONS = 100
    private const val MAX_EVENTS = 100
    private val lock = Any()

    private var lastCpuTimeMs: Long = -1L
    private var lastWallTimeMs: Long = -1L
    private var cachedCpuPercent: Double = 0.0

    private fun file(context: Context): File {
        val dir = File(context.noBackupFilesDir, "wakeword")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, FILE_NAME)
    }

    private fun readLocked(context: Context): JSONObject {
        val f = file(context)
        if (f.isFile) {
            try {
                return JSONObject(f.readText())
            } catch (_: Exception) {
                // Fall back to clean defaults if unreadable.
            }
        }
        return JSONObject()
            .put("serviceState", "stopped")
            .put("lastStateReason", "Not started")
            .put("detectionCount", 0)
            .put("falsePositiveCount", 0)
            .put("missedActivationCount", 0)
            .put("framesProcessed", 0L)
            .put("totalInferenceMs", 0.0)
            .put("lastDetectionLatencyMs", 0.0)
            .put("avgDetectionLatencyMs", 0.0)
            .put("lastScore", 0.0)
            .put("peakScore", 0.0)
            .put("micCompetitionCount", 0)
            .put("detections", JSONArray())
            .put("lifecycleEvents", JSONArray())
            .put("scenarioResults", JSONObject())
    }

    private fun writeLocked(context: Context, root: JSONObject) {
        val f = file(context)
        val tmp = File(f.parentFile, "$FILE_NAME.tmp")
        tmp.writeText(root.toString())
        if (f.exists()) f.delete()
        tmp.renameTo(f)
    }

    fun updateServiceState(
        context: Context,
        state: String,
        reason: String,
        modelInfo: WakeWordModelInfo? = null
    ) {
        synchronized(lock) {
            val root = readLocked(context)
            root.put("serviceState", state)
            root.put("lastStateReason", reason)
            root.put("updatedAt", Instant.now().toString())
            if (state == "listening" && !root.has("startedAt")) {
                root.put("startedAt", Instant.now().toString())
            }
            if (state == "stopped") {
                root.put("stoppedAt", Instant.now().toString())
                root.remove("startedAt")
            }
            if (modelInfo != null) {
                root.put("loadedModel", modelInfo.toJson())
            }
            appendEventLocked(root, "state:$state", reason)
            writeLocked(context, root)
        }
    }

    fun recordMicCompetition(context: Context, reason: String) {
        synchronized(lock) {
            val root = readLocked(context)
            root.put("micCompetitionCount", root.optInt("micCompetitionCount", 0) + 1)
            appendEventLocked(root, "mic_competition", reason)
            writeLocked(context, root)
        }
    }

    fun recordInferenceBatch(
        context: Context,
        framesAdded: Long,
        inferenceMs: Double,
        peakScoreInBatch: Float
    ) {
        synchronized(lock) {
            val root = readLocked(context)
            val prevFrames = root.optLong("framesProcessed", 0L) + framesAdded
            val prevTotalMs = root.optDouble("totalInferenceMs", 0.0) + inferenceMs
            root.put("framesProcessed", prevFrames)
            root.put("totalInferenceMs", prevTotalMs)
            root.put("lastScore", peakScoreInBatch.toDouble())
            if (peakScoreInBatch.toDouble() > root.optDouble("peakScore", 0.0)) {
                root.put("peakScore", peakScoreInBatch.toDouble())
            }
            writeLocked(context, root)
        }
    }

    fun recordDetection(
        context: Context,
        modelInfo: WakeWordModelInfo,
        score: Float,
        inferenceLatencyMs: Double,
        env: DeviceEnvironmentSnapshot
    ): JSONObject {
        synchronized(lock) {
            val root = readLocked(context)
            val count = root.optInt("detectionCount", 0) + 1
            val prevAvg = root.optDouble("avgDetectionLatencyMs", 0.0)
            val newAvg = ((prevAvg * (count - 1)) + inferenceLatencyMs) / count
            val now = Instant.now().toString()

            root.put("detectionCount", count)
            root.put("lastDetectionAt", now)
            root.put("lastDetectionLatencyMs", inferenceLatencyMs)
            root.put("avgDetectionLatencyMs", newAvg)
            root.put("lastScore", score.toDouble())
            root.put("loadedModel", modelInfo.toJson())

            val event = JSONObject()
                .put("at", now)
                .put("modelId", modelInfo.modelId)
                .put("targetPhrase", modelInfo.targetPhrase)
                .put("isCustomHeyAtlasModel", modelInfo.isCustomHeyAtlasModel)
                .put("score", score.toDouble())
                .put("latencyMs", inferenceLatencyMs)
                .put("environment", env.toJson())

            val detections = root.optJSONArray("detections") ?: JSONArray()
            val bounded = JSONArray()
            bounded.put(event)
            for (i in 0 until minOf(detections.length(), MAX_DETECTIONS - 1)) {
                bounded.put(detections.get(i))
            }
            root.put("detections", bounded)
            appendEventLocked(
                root,
                "detection",
                "${modelInfo.targetPhrase} (score=${"%.3f".format(score)}, latency=${"%.1f".format(inferenceLatencyMs)}ms, locked=${env.keyguardLocked}, interactive=${env.interactive})"
            )
            writeLocked(context, root)
            return event
        }
    }

    fun markFalsePositive(context: Context): Int {
        synchronized(lock) {
            val root = readLocked(context)
            val next = root.optInt("falsePositiveCount", 0) + 1
            root.put("falsePositiveCount", next)
            appendEventLocked(root, "false_positive", "User marked false positive (#$next)")
            writeLocked(context, root)
            return next
        }
    }

    fun markMissedActivation(context: Context, note: String = ""): Int {
        synchronized(lock) {
            val root = readLocked(context)
            val next = root.optInt("missedActivationCount", 0) + 1
            root.put("missedActivationCount", next)
            appendEventLocked(
                root,
                "missed_activation",
                if (note.isBlank()) "User marked missed activation (#$next)" else note.take(160)
            )
            writeLocked(context, root)
            return next
        }
    }

    fun recordScenarioResult(
        context: Context,
        scenarioId: String,
        status: String,
        notes: String
    ) {
        synchronized(lock) {
            val root = readLocked(context)
            val scenarios = root.optJSONObject("scenarioResults") ?: JSONObject()
            scenarios.put(
                scenarioId.take(32),
                JSONObject()
                    .put("status", status.take(32))
                    .put("notes", notes.take(500))
                    .put("updatedAt", Instant.now().toString())
                    .put("environment", captureEnvironment(context).toJson())
            )
            root.put("scenarioResults", scenarios)
            appendEventLocked(root, "scenario:$scenarioId", "$status: ${notes.take(120)}")
            writeLocked(context, root)
        }
    }

    fun clear(context: Context) {
        synchronized(lock) {
            val f = file(context)
            if (f.exists()) f.delete()
        }
    }

    fun snapshot(context: Context): JSONObject {
        synchronized(lock) {
            val root = readLocked(context)
            val env = captureEnvironment(context)
            val memoryMb = estimateMemoryMb(context)
            val cpuPct = estimateCpuPercent()
            root.put("environment", env.toJson())
            root.put("memoryMbEstimate", memoryMb)
            root.put("cpuPercentEstimate", cpuPct)
            root.put("sdkInt", Build.VERSION.SDK_INT)
            root.put("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}")
            if (!root.has("loadedModel")) {
                root.put("loadedModel", WakeWordModelManager.getActiveModel(context).toJson())
            }
            return root
        }
    }

    fun captureEnvironment(context: Context): DeviceEnvironmentSnapshot {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

        val interactive = pm?.isInteractive ?: true
        val batterySaver = pm?.isPowerSaveMode ?: false
        val ignoringOptimizations = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            false
        }
        val keyguardLocked = km?.isKeyguardLocked ?: false
        val musicActive = am?.isMusicActive ?: false
        val mode = am?.mode ?: AudioManager.MODE_NORMAL
        val inCall = mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION

        var btAudio = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && am != null) {
            btAudio = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any {
                it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                    it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                    (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && it.type == AudioDeviceInfo.TYPE_BLE_HEADSET)
            }
        } else {
            val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter: BluetoothAdapter? = bm?.adapter
            if (adapter != null && adapter.isEnabled) {
                try {
                    btAudio = adapter.getProfileConnectionState(BluetoothProfile.HEADSET) == BluetoothProfile.STATE_CONNECTED
                } catch (_: SecurityException) {
                    btAudio = false
                }
            }
        }

        var online = false
        if (cm != null) {
            val net = cm.activeNetwork
            val caps = if (net != null) cm.getNetworkCapabilities(net) else null
            online = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        }

        return DeviceEnvironmentSnapshot(
            interactive = interactive,
            keyguardLocked = keyguardLocked,
            batterySaverOn = batterySaver,
            ignoringBatteryOptimizations = ignoringOptimizations,
            networkOnline = online,
            musicActive = musicActive,
            inCallOrCommunication = inCall,
            bluetoothAudioConnected = btAudio
        )
    }

    private fun estimateMemoryMb(context: Context): Double {
        return try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            val pids = intArrayOf(Process.myPid())
            val info = am?.getProcessMemoryInfo(pids)?.firstOrNull()
            if (info != null) {
                (info.totalPss / 1024.0)
            } else {
                val rt = Runtime.getRuntime()
                ((rt.totalMemory() - rt.freeMemory()) / (1024.0 * 1024.0))
            }
        } catch (_: Exception) {
            0.0
        }
    }

    private fun estimateCpuPercent(): Double {
        val nowWall = System.currentTimeMillis()
        val nowCpu = Process.getElapsedCpuTime()
        if (lastWallTimeMs > 0 && nowWall > lastWallTimeMs) {
            val wallDelta = (nowWall - lastWallTimeMs).toDouble()
            val cpuDelta = (nowCpu - lastCpuTimeMs).coerceAtLeast(0L).toDouble()
            val cores = Runtime.getRuntime().availableProcessors().coerceAtLeast(1)
            cachedCpuPercent = ((cpuDelta / (wallDelta * cores)) * 100.0).coerceIn(0.0, 100.0)
        }
        lastWallTimeMs = nowWall
        lastCpuTimeMs = nowCpu
        return cachedCpuPercent
    }

    private fun appendEventLocked(root: JSONObject, kind: String, detail: String) {
        val events = root.optJSONArray("lifecycleEvents") ?: JSONArray()
        val bounded = JSONArray()
        bounded.put(
            JSONObject()
                .put("at", Instant.now().toString())
                .put("kind", kind)
                .put("detail", detail)
        )
        for (i in 0 until minOf(events.length(), MAX_EVENTS - 1)) {
            bounded.put(events.get(i))
        }
        root.put("lifecycleEvents", bounded)
    }
}
