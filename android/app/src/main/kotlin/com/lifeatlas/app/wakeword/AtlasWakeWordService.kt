package com.lifeatlas.app.wakeword

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.Process
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.lifeatlas.app.MainActivity
import com.lifeatlas.app.R
import com.lifeatlas.app.wakeword.assistant.AtlasExperimentVoiceInteractionService
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.PI
import kotlin.math.sin

/**
 * Isolated Android Foreground Service (foregroundServiceType="microphone")
 * for the Hey Atlas offline wake-word feasibility experiment.
 *
 * Privacy guarantees:
 * - Bounded 1280-sample read chunk & bounded ring buffers only.
 * - Never writes microphone audio to disk, never uploads audio, never logs raw PCM.
 * - Starts only on explicit user action; provides an explicit Stop Listening notification action.
 */
class AtlasWakeWordService : Service() {

    private var engine: OpenWakeWordEngine? = null
    private var audioRecord: AudioRecord? = null
    private var captureThread: Thread? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val running = AtomicBoolean(false)
    private val paused = AtomicBoolean(false)
    private val destroyed = AtomicBoolean(false)

    private val mainHandler = Handler(Looper.getMainLooper())
    private var audioManager: AudioManager? = null
    private var recordingCallback: AudioManager.AudioRecordingCallback? = null
    private var lastSilencedFlag = false
    private var useAssistantSessionOnWake = false

    companion object {
        private const val TAG = "AtlasWakeWordService"
        const val ACTION_START = "com.lifeatlas.app.wakeword.START"
        const val ACTION_STOP = "com.lifeatlas.app.wakeword.STOP"
        const val ACTION_PAUSE = "com.lifeatlas.app.wakeword.PAUSE"
        const val ACTION_RESUME = "com.lifeatlas.app.wakeword.RESUME"
        const val ACTION_RELOAD_MODEL = "com.lifeatlas.app.wakeword.RELOAD_MODEL"
        const val EXTRA_FROM_NOTIFICATION = "fromNotification"
        const val EXTRA_USE_ASSISTANT_SESSION = "useAssistantSession"

        private const val CHANNEL_LISTENING = "atlas_wakeword_listening"
        private const val CHANNEL_ALERTS = "atlas_wakeword_alerts"
        private const val NOTIFICATION_ID_LISTENING = 4101
        private const val NOTIFICATION_ID_DETECTED = 4102

        @Volatile
        var isServiceRunning: Boolean = false
            private set

        @Volatile
        var isServicePaused: Boolean = false
            private set

        @Volatile
        var isMicSilenced: Boolean = false
            private set
    }

    override fun onCreate() {
        super.onCreate()
        createChannels()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        registerMicCompetitionCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            // Obey Android 14-16 FGS rules: do not attempt automatic background microphone restarts.
            WakeWordDiagnostics.updateServiceState(
                this,
                "stopped",
                "System null-intent restart ignored; manual restart required per Android 14-16 FGS policy."
            )
            stopSelf()
            return START_NOT_STICKY
        }

        if (intent.hasExtra(EXTRA_USE_ASSISTANT_SESSION)) {
            useAssistantSessionOnWake = intent.getBooleanExtra(EXTRA_USE_ASSISTANT_SESSION, false)
        }

        when (intent.action) {
            ACTION_START -> {
                if (!hasMicPermission()) {
                    WakeWordDiagnostics.updateServiceState(
                        this,
                        "error",
                        "RECORD_AUDIO permission missing or revoked."
                    )
                    AtlasWakeWordPlugin.emitStatusChange(this)
                    stopSelf()
                    return START_NOT_STICKY
                }

                try {
                    val model = WakeWordModelManager.getActiveModel(this)
                    promoteForeground(buildListeningNotification(model))
                } catch (e: SecurityException) {
                    Log.e(TAG, "Foreground microphone service start blocked by Android OS", e)
                    WakeWordDiagnostics.updateServiceState(
                        this,
                        "error",
                        "Android blocked microphone foreground start: ${e.message}"
                    )
                    AtlasWakeWordPlugin.emitStatusChange(this)
                    stopSelf()
                    return START_NOT_STICKY
                } catch (e: Exception) {
                    Log.e(TAG, "Foreground service start failed", e)
                    WakeWordDiagnostics.updateServiceState(
                        this,
                        "error",
                        "Foreground start error: ${e.message}"
                    )
                    AtlasWakeWordPlugin.emitStatusChange(this)
                    stopSelf()
                    return START_NOT_STICKY
                }

                if (!running.get()) {
                    startPipeline()
                } else if (paused.get()) {
                    paused.set(false)
                    isServicePaused = false
                    startCaptureLoopIfNeeded()
                }
            }

            ACTION_STOP -> {
                val fromNotification = intent.getBooleanExtra(EXTRA_FROM_NOTIFICATION, false)
                stopPipeline(
                    if (fromNotification) "Stopped from notification action"
                    else "Stopped by user"
                )
                stopForegroundCompat()
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_PAUSE -> {
                pausePipeline("Paused for active voice session or call")
            }

            ACTION_RESUME -> {
                resumePipeline()
            }

            ACTION_RELOAD_MODEL -> {
                if (running.get()) {
                    stopPipeline("Reloading wake-word model")
                    if (hasMicPermission()) {
                        startPipeline()
                    }
                }
            }
        }

        return START_NOT_STICKY
    }

    private fun promoteForeground(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(
                NOTIFICATION_ID_LISTENING,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID_LISTENING, notification)
        }
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun startPipeline() {
        try {
            val model = WakeWordModelManager.getActiveModel(this)
            engine?.close()
            engine = OpenWakeWordEngine(this, model)
            running.set(true)
            paused.set(false)
            isServiceRunning = true
            isServicePaused = false
            isMicSilenced = false
            acquireWakeLock()

            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.notify(NOTIFICATION_ID_LISTENING, buildListeningNotification(model))

            WakeWordDiagnostics.updateServiceState(
                this,
                "listening",
                "Listening offline with ${model.displayName}",
                model
            )
            AtlasWakeWordPlugin.emitStatusChange(this)
            startCaptureLoopIfNeeded()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize wake-word engine", e)
            WakeWordDiagnostics.updateServiceState(
                this,
                "error",
                "Engine initialization failed: ${e.message}"
            )
            stopPipeline("Engine initialization failed: ${e.message}")
            stopForegroundCompat()
            stopSelf()
        }
    }

    private fun startCaptureLoopIfNeeded() {
        if (captureThread?.isAlive == true) return
        captureThread = Thread({
            Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
            runCaptureLoop()
        }, "AtlasWakeWordCapture").apply { start() }
    }

    private fun runCaptureLoop() {
        val sampleRate = OpenWakeWordFeatureBuffers.SAMPLE_RATE_HZ
        val minBufBytes = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(OpenWakeWordFeatureBuffers.STEP_SAMPLES * 4)

        val record = createAudioRecord(sampleRate, minBufBytes)
        if (record == null) {
            WakeWordDiagnostics.updateServiceState(
                this,
                "error",
                "AudioRecord unavailable (microphone permission or hardware busy)."
            )
            AtlasWakeWordPlugin.emitStatusChange(this)
            mainHandler.post {
                stopPipeline("AudioRecord unavailable")
                stopForegroundCompat()
                stopSelf()
            }
            return
        }

        audioRecord = record
        val readChunk = ShortArray(OpenWakeWordFeatureBuffers.STEP_SAMPLES)
        var batchFrames = 0L
        var batchInferenceMs = 0.0
        var batchPeakScore = 0.0f
        var lastStatsFlushMs = System.currentTimeMillis()

        try {
            record.startRecording()
            if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
                throw IllegalStateException("AudioRecord failed to enter RECORDING state.")
            }

            while (running.get() && !paused.get() && !destroyed.get()) {
                if (!hasMicPermission()) {
                    WakeWordDiagnostics.updateServiceState(
                        this,
                        "error",
                        "Microphone permission revoked during listening."
                    )
                    AtlasWakeWordPlugin.emitStatusChange(this)
                    mainHandler.post {
                        stopPipeline("Microphone permission revoked")
                        stopForegroundCompat()
                        stopSelf()
                    }
                    break
                }

                // Respect phone calls: never interfere with active voice/VoIP calls.
                val mode = audioManager?.mode ?: AudioManager.MODE_NORMAL
                if (mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION) {
                    WakeWordDiagnostics.recordMicCompetition(this, "Paused for active phone/VoIP call")
                    WakeWordDiagnostics.updateServiceState(
                        this,
                        "paused_for_call",
                        "Paused automatically while phone call is active"
                    )
                    AtlasWakeWordPlugin.emitStatusChange(this)
                    Thread.sleep(500)
                    continue
                }

                val read = record.read(readChunk, 0, readChunk.size)
                if (read < 0) {
                    Log.w(TAG, "AudioRecord read error: $read")
                    WakeWordDiagnostics.recordMicCompetition(this, "AudioRecord read error ($read)")
                    Thread.sleep(150)
                    continue
                }
                if (read == 0) continue

                val localEngine = engine ?: break
                val result = localEngine.processAudio(readChunk, read) ?: continue
                batchFrames += result.framesProcessed
                batchInferenceMs += result.inferenceLatencyMs
                if (result.score > batchPeakScore) batchPeakScore = result.score

                val now = System.currentTimeMillis()
                if (now - lastStatsFlushMs >= 1000L) {
                    WakeWordDiagnostics.recordInferenceBatch(
                        this,
                        batchFrames,
                        batchInferenceMs,
                        batchPeakScore
                    )
                    batchFrames = 0L
                    batchInferenceMs = 0.0
                    batchPeakScore = 0.0f
                    lastStatsFlushMs = now
                }

                if (result.detected) {
                    handleDetection(localEngine.modelInfo, result.score, result.inferenceLatencyMs)
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException in AudioRecord loop", e)
            WakeWordDiagnostics.updateServiceState(
                this,
                "error",
                "Microphone access denied by Android: ${e.message}"
            )
            AtlasWakeWordPlugin.emitStatusChange(this)
        } catch (e: Exception) {
            if (running.get() && !paused.get()) {
                Log.e(TAG, "Capture loop error", e)
                WakeWordDiagnostics.updateServiceState(
                    this,
                    "error",
                    "Audio capture error: ${e.message}"
                )
                AtlasWakeWordPlugin.emitStatusChange(this)
            }
        } finally {
            runCatching {
                if (record.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    record.stop()
                }
            }
            runCatching { record.release() }
            if (audioRecord === record) {
                audioRecord = null
            }
        }
    }

    private fun createAudioRecord(sampleRate: Int, bufferBytes: Int): AudioRecord? {
        if (!hasMicPermission()) return null
        val sources = intArrayOf(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            MediaRecorder.AudioSource.MIC
        )
        for (source in sources) {
            try {
                val rec = AudioRecord(
                    source,
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferBytes
                )
                if (rec.state == AudioRecord.STATE_INITIALIZED) {
                    return rec
                }
                rec.release()
            } catch (_: SecurityException) {
                return null
            } catch (_: Exception) {
                // Try fallback source.
            }
        }
        return null
    }

    private fun handleDetection(
        modelInfo: WakeWordModelInfo,
        score: Float,
        inferenceLatencyMs: Double
    ) {
        val env = WakeWordDiagnostics.captureEnvironment(this)
        val eventJson = WakeWordDiagnostics.recordDetection(
            this,
            modelInfo,
            score,
            inferenceLatencyMs,
            env
        )
        AtlasWakeWordPlugin.emitWakeWordDetected(eventJson)
        AtlasWakeWordPlugin.emitStatusChange(this)

        // Minimal local wake response (no cloud LLM, no private vault actions, no forced background startActivity).
        mainHandler.post {
            vibrateBriefly()
            playShortChime(env)
            postDetectionNotification(modelInfo, score, inferenceLatencyMs, env)

            if (useAssistantSessionOnWake) {
                val vis = AtlasExperimentVoiceInteractionService.instance
                if (vis != null) {
                    // Pause mic briefly so assistant session does not conflict with wake chime/STT.
                    pausePipeline("Paused for experimental VoiceInteractionSession")
                    vis.launchExperimentalSession(modelInfo.targetPhrase, inferenceLatencyMs)
                }
            }
        }
    }

    private fun pausePipeline(reason: String) {
        if (!running.get() || paused.get()) return
        paused.set(true)
        isServicePaused = true
        releaseWakeLock()
        WakeWordDiagnostics.updateServiceState(this, "paused_for_voice", reason)
        AtlasWakeWordPlugin.emitStatusChange(this)
    }

    private fun resumePipeline() {
        if (!running.get() || !paused.get()) return
        if (!hasMicPermission()) {
            stopPipeline("Cannot resume: microphone permission revoked")
            stopForegroundCompat()
            stopSelf()
            return
        }
        paused.set(false)
        isServicePaused = false
        engine?.reset()
        acquireWakeLock()
        val model = engine?.modelInfo ?: WakeWordModelManager.getActiveModel(this)
        WakeWordDiagnostics.updateServiceState(this, "listening", "Resumed listening (${model.targetPhrase})", model)
        AtlasWakeWordPlugin.emitStatusChange(this)
        startCaptureLoopIfNeeded()
    }

    private fun stopPipeline(reason: String) {
        running.set(false)
        paused.set(false)
        isServiceRunning = false
        isServicePaused = false
        isMicSilenced = false
        runCatching { audioRecord?.stop() }
        captureThread?.interrupt()
        captureThread = null
        engine?.close()
        engine = null
        releaseWakeLock()
        WakeWordDiagnostics.updateServiceState(this, "stopped", reason)
        AtlasWakeWordPlugin.emitStatusChange(this)
    }

    private fun registerMicCompetitionCallback() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val am = audioManager ?: return
        val cb = object : AudioManager.AudioRecordingCallback() {
            override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>) {
                if (!running.get()) return
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val oursSilenced = configs.any {
                        it.clientAudioSessionId == audioRecord?.audioSessionId && it.isClientSilenced
                    }
                    if (oursSilenced != lastSilencedFlag) {
                        lastSilencedFlag = oursSilenced
                        isMicSilenced = oursSilenced
                        if (oursSilenced) {
                            WakeWordDiagnostics.recordMicCompetition(
                                this@AtlasWakeWordService,
                                "Android silenced Atlas microphone (another app holds higher-priority mic)"
                            )
                            WakeWordDiagnostics.updateServiceState(
                                this@AtlasWakeWordService,
                                "silenced_by_mic_competition",
                                "Microphone silenced by higher-priority app or system audio"
                            )
                        } else {
                            WakeWordDiagnostics.updateServiceState(
                                this@AtlasWakeWordService,
                                "listening",
                                "Microphone focus restored"
                            )
                        }
                        AtlasWakeWordPlugin.emitStatusChange(this@AtlasWakeWordService)
                    }
                }
            }
        }
        recordingCallback = cb
        am.registerAudioRecordingCallback(cb, mainHandler)
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LifeAtlas:HeyAtlasWakeWordPoC").apply {
            setReferenceCounted(false)
            acquire(4 * 60 * 60 * 1000L) // 4h max safety bound per experimental session
        }
    }

    private fun releaseWakeLock() {
        runCatching {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        }
        wakeLock = null
    }

    private fun vibrateBriefly() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            if (vibrator?.hasVibrator() == true) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(55L, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(55L)
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun playShortChime(env: DeviceEnvironmentSnapshot) {
        if (env.inCallOrCommunication) return
        val ringerMode = audioManager?.ringerMode ?: AudioManager.RINGER_MODE_NORMAL
        if (ringerMode == AudioManager.RINGER_MODE_SILENT) return

        Thread({
            try {
                val sr = 22050
                val samples = (sr * 0.14).toInt()
                val pcm = ShortArray(samples)
                for (i in 0 until samples) {
                    val t = i.toDouble() / sr
                    val freq = if (i < samples / 2) 523.25 else 659.25 // C5 -> E5 soft chime
                    val envAmp = sin(PI * (i.toDouble() / samples))
                    pcm[i] = (sin(2.0 * PI * freq * t) * 4500.0 * envAmp).toInt().toShort()
                }
                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sr)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(pcm.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()
                track.write(pcm, 0, pcm.size)
                track.play()
                Thread.sleep(180)
                track.stop()
                track.release()
            } catch (_: Exception) {
            }
        }, "AtlasWakeChime").start()
    }

    private fun postDetectionNotification(
        modelInfo: WakeWordModelInfo,
        score: Float,
        latencyMs: Double,
        env: DeviceEnvironmentSnapshot
    ) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            this,
            10,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val title = if (modelInfo.isCustomHeyAtlasModel) {
            "Hey Atlas detected"
        } else {
            "Test wake word detected (${modelInfo.targetPhrase})"
        }
        val lockText = if (env.keyguardLocked) "Locked" else "Unlocked"
        val screenText = if (env.interactive) "Screen on" else "Screen off"
        val body = "Latency ${"%.1f".format(latencyMs)} ms · Score ${"%.2f".format(score)} · $screenText / $lockText"

        val notif = NotificationCompat.Builder(this, CHANNEL_ALERTS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        nm.notify(NOTIFICATION_ID_DETECTED, notif)
    }

    private fun buildListeningNotification(modelInfo: WakeWordModelInfo): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, AtlasWakeWordService::class.java).apply {
                action = ACTION_STOP
                putExtra(EXTRA_FROM_NOTIFICATION, true)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val label = if (modelInfo.isCustomHeyAtlasModel) {
            "Listening offline for \"Hey Atlas\""
        } else {
            "Listening offline (TEST MODEL: \"${modelInfo.targetPhrase}\")"
        }
        return NotificationCompat.Builder(this, CHANNEL_LISTENING)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Atlas Wake-Word Experiment")
            .setContentText(label)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openIntent)
            .addAction(0, "Stop Listening", stopIntent)
            .build()
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        val listening = NotificationChannel(
            CHANNEL_LISTENING,
            "Atlas Wake-Word Experiment",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Persistent indicator while the experimental wake-word detector listens."
            setShowBadge(false)
        }
        val alerts = NotificationChannel(
            CHANNEL_ALERTS,
            "Atlas Wake-Word Detections",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Minimal wake-response notifications for Hey Atlas PoC detections."
        }
        nm.createNotificationChannel(listening)
        nm.createNotificationChannel(alerts)
    }

    private fun hasMicPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        destroyed.set(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            recordingCallback?.let { cb -> audioManager?.unregisterAudioRecordingCallback(cb) }
        }
        if (running.get()) {
            stopPipeline("Service destroyed by system")
        } else {
            releaseWakeLock()
            engine?.close()
            engine = null
        }
        super.onDestroy()
    }
}
