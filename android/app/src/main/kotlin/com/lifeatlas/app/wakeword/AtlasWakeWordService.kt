package com.lifeatlas.app.wakeword

import com.lifeatlas.app.wakeword.activation.AtlasActivationPreferences
import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.lifeatlas.app.MainActivity
import com.lifeatlas.app.R
import com.lifeatlas.app.wakeword.assistant.AtlasExperimentVoiceInteractionService
import com.lifeatlas.app.wakeword.voice.AtlasAudioOwnershipCoordinator
import com.lifeatlas.app.wakeword.voice.AtlasVoiceCoordinator
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
    @Volatile
    private var audioRecord: AudioRecord? = null
    private var captureThread: Thread? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val running = AtomicBoolean(false)
    private val paused = AtomicBoolean(false)
    private val pausedForMic = AtomicBoolean(false)
    private val pausedForVoiceSession = AtomicBoolean(false)
    private val destroyed = AtomicBoolean(false)
    private var voiceCoordinator: AtlasVoiceCoordinator? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private var micMonitorThread: HandlerThread? = null
    private var micMonitorHandler: Handler? = null
    private var audioManager: AudioManager? = null
    private var recordingCallback: AudioManager.AudioRecordingCallback? = null
    @Volatile
    private var activeAudioSessionId: Int = -1
    @Volatile
    private var ignoreAudioUntilElapsedMs: Long = 0L
    private var useAssistantSessionOnWake = false
    private var screenReceiverRegistered = false

    // AudioFocus listener: releases mic the instant any other app requests audio focus for recording,
    // giving it a ~300ms head start before it opens AudioRecord — eliminating the hardware conflict window.
    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        if (focusChange == AudioManager.AUDIOFOCUS_LOSS ||
            focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            val h = micMonitorHandler ?: mainHandler
            h.post {
                if (running.get() && !pausedForMic.get() && !pausedForVoiceSession.get() && !paused.get() && !destroyed.get()) {
                    pauseForMicCompetition("Pre-emptive release: audio focus lost to another recording/call app")
                }
            }
        }
    }
    private var audioFocusRequest: AudioFocusRequest? = null

    private val micRecoveryPollRunnable = object : Runnable {
        override fun run() {
            if (!running.get() || !pausedForMic.get() || destroyed.get()) return
            if (!isExternalAppRecording() && !isInCallMode()) {
                resumeFromMicCompetition()
            } else {
                val h = micMonitorHandler ?: mainHandler
                h.postDelayed(this, 25_000L)
            }
        }
    }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_OFF) {
                // If the user locked the screen, they are finished with on-screen recording/call apps.
                val h = micMonitorHandler ?: mainHandler
                h.post {
                    if (running.get() && pausedForMic.get() && !isExternalAppRecording() && !isInCallMode()) {
                        resumeFromMicCompetition()
                    }
                }
            }
        }
    }

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

        @Volatile
        var isMicActuallyCapturing: Boolean = false
            private set

        @Volatile
        var voiceAssistantEnabled: Boolean = true

        @Volatile
        var activeVoiceCoordinator: AtlasVoiceCoordinator? = null
            private set
    }

    override fun onCreate() {
        super.onCreate()
        createChannels()
        micMonitorThread = HandlerThread("AtlasMicMonitor", Process.THREAD_PRIORITY_URGENT_AUDIO).apply { start() }
        micMonitorHandler = Handler(micMonitorThread!!.looper)
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        voiceCoordinator = AtlasVoiceCoordinator(
            this,
            object : AtlasVoiceCoordinator.ServiceActions {
                override fun isWakeListeningActive(): Boolean = running.get() && !destroyed.get()

                override fun pauseWakeWordForVoiceSession(reason: String) {
                    if (!running.get() || destroyed.get()) {
                        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD)
                        return
                    }
                    pausedForVoiceSession.set(true)
                    isServicePaused = true
                    abandonAudioFocus()
                    val rec = audioRecord
                    audioRecord = null
                    activeAudioSessionId = -1
                    runCatching { rec?.stop() }
                    runCatching { rec?.release() }
                    val threadAlive = captureThread?.isAlive == true
                    captureThread?.interrupt()
                    if (!threadAlive) {
                        isMicActuallyCapturing = false
                        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD)
                    }
                    WakeWordDiagnostics.updateServiceState(this@AtlasWakeWordService, "paused_for_voice", reason)
                    AtlasWakeWordPlugin.emitStatusChange(this@AtlasWakeWordService)
                    refreshListeningNotification()
                }

                override fun resumeWakeWordFromVoiceSession() {
                    if (AtlasActivationPreferences.mode(this@AtlasWakeWordService) != AtlasActivationPreferences.MICROPHONE ||
                        !running.get() || paused.get() || pausedForMic.get() || destroyed.get()) return
                    pausedForVoiceSession.set(false)
                    isServicePaused = false
                    captureThread?.join(300L)
                    engine?.reset()
                    ignoreAudioUntilElapsedMs = SystemClock.elapsedRealtime() + 400L
                    val model = engine?.modelInfo ?: WakeWordModelManager.getActiveModel(this@AtlasWakeWordService)
                    WakeWordDiagnostics.updateServiceState(
                        this@AtlasWakeWordService,
                        "listening",
                        "Resumed offline wake-word listening (${model.targetPhrase})",
                        model
                    )
                    AtlasWakeWordPlugin.emitStatusChange(this@AtlasWakeWordService)
                    refreshListeningNotification()
                    requestAudioFocusForListening()
                    startCaptureLoopIfNeeded()
                }

                override fun isInPhoneCall(): Boolean = isInCallMode()
            }
        ).also { activeVoiceCoordinator = it }
        registerMicCompetitionCallback()
        try {
            registerReceiver(screenReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF))
            screenReceiverRegistered = true
        } catch (e: Exception) {
            Log.w(TAG, "Failed to register screenReceiver: ${e.message}")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent != null && intent.action != ACTION_STOP &&
            AtlasActivationPreferences.mode(this) != AtlasActivationPreferences.MICROPHONE) {
            stopSelf()
            return START_NOT_STICKY
        }
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
                runCatching { AtlasActivationPreferences.mode(this, AtlasActivationPreferences.OFF) }
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
            requestAudioFocusForListening()

            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.notify(NOTIFICATION_ID_LISTENING, buildListeningNotification(model))

            WakeWordDiagnostics.updateServiceState(
                this,
                "listening",
                "Listening offline with ${model.displayName}",
                model
            )
            AtlasWakeWordPlugin.emitStatusChange(this)
            voiceCoordinator?.onWakeServiceStarted()
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
        if (AtlasActivationPreferences.mode(this) != AtlasActivationPreferences.MICROPHONE) return
        if (captureThread?.isAlive == true) return
        captureThread = Thread({
            Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
            runCaptureLoop()
        }, "AtlasWakeWordCapture").apply { start() }
    }

    private fun runCaptureLoop() {
        if (!AtlasAudioOwnershipCoordinator.tryAcquire(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD)) {
            Log.w(TAG, "Cannot start wake-word capture: audio ownership held by ${AtlasAudioOwnershipCoordinator.currentOwner}")
            return
        }

        val sampleRate = OpenWakeWordFeatureBuffers.SAMPLE_RATE_HZ
        // Keep >= 1 second internal AudioRecord ring buffer so screen-off CPU scaling or app switches never drop PCM chunks.
        val minBufBytes = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(sampleRate * 2)

        val record = createAudioRecord(sampleRate, minBufBytes)
        if (record == null) {
            AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD)
            handleAudioStartFailure("AudioRecord unavailable (microphone hardware busy or blocked in background).")
            return
        }

        audioRecord = record
        activeAudioSessionId = record.audioSessionId
        // Read in 20 ms slices (320 samples) so competing recorder callbacks unblock and release the mic in <20 ms.
        val sliceSamples = 320
        val readSlice = ShortArray(sliceSamples)
        val stepChunk = ShortArray(OpenWakeWordFeatureBuffers.STEP_SAMPLES)
        var stepFilled = 0
        var batchFrames = 0L
        var batchInferenceMs = 0.0
        var batchPeakScore = 0.0f
        var lastStatsFlushMs = System.currentTimeMillis()
        var lastAudioTickElapsed = SystemClock.elapsedRealtime()

        try {
            record.startRecording()
            if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
                throw IllegalStateException("AudioRecord failed to enter RECORDING state.")
            }
            isMicActuallyCapturing = true
            Log.i(TAG, "AudioRecord started (session=$activeAudioSessionId, bufBytes=$minBufBytes)")

            while (running.get() && !paused.get() && !pausedForMic.get() && !pausedForVoiceSession.get() && !destroyed.get()) {
                if (!hasMicPermission()) {
                    WakeWordDiagnostics.updateServiceState(
                        this,
                        "error",
                        "Microphone permission revoked during listening."
                    )
                    OvernightTestManager.onServiceStateChanged(
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

                // Respect phone calls: release hardware mic during active voice/VoIP calls.
                if (isInCallMode()) {
                    (micMonitorHandler ?: mainHandler).post {
                        pauseForMicCompetition("Paused and released mic for active phone/VoIP call")
                    }
                    break
                }

                val needed = (stepChunk.size - stepFilled).coerceAtMost(readSlice.size)
                val read = record.read(readSlice, 0, needed)
                if (read < 0) {
                    if (pausedForMic.get() || pausedForVoiceSession.get() || paused.get() || !running.get() || destroyed.get()) {
                        break
                    }
                    Log.w(TAG, "AudioRecord read error: $read")
                    WakeWordDiagnostics.recordMicCompetition(this, "AudioRecord read error ($read)")
                    Thread.sleep(100)
                    continue
                }
                if (read == 0) continue

                if (pausedForMic.get() || pausedForVoiceSession.get() || paused.get() || !running.get() || destroyed.get()) {
                    break
                }

                // Duck briefly while playing our own confirmation chime so the chime cannot echo back into mel frames.
                if (SystemClock.elapsedRealtime() < ignoreAudioUntilElapsedMs) {
                    stepFilled = 0
                    continue
                }

                System.arraycopy(readSlice, 0, stepChunk, stepFilled, read)
                stepFilled += read
                if (stepFilled < stepChunk.size) continue
                stepFilled = 0

                if (pausedForMic.get() || pausedForVoiceSession.get() || paused.get() || !running.get() || destroyed.get()) {
                    break
                }

                val localEngine = engine ?: break
                val result = localEngine.processAudio(stepChunk, stepChunk.size) ?: continue
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
                    val nowElapsed = SystemClock.elapsedRealtime()
                    if (OvernightTestManager.isTestRunning(this)) {
                        OvernightTestManager.onAudioTick(this, nowElapsed, lastAudioTickElapsed)
                    }
                    lastAudioTickElapsed = nowElapsed
                    batchFrames = 0L
                    batchInferenceMs = 0.0
                    batchPeakScore = 0.0f
                    lastStatsFlushMs = now
                }

                if (result.detected) {
                    ignoreAudioUntilElapsedMs = SystemClock.elapsedRealtime() + 500L
                    handleDetection(localEngine.modelInfo, result.score, result.inferenceLatencyMs)
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException in AudioRecord loop", e)
            handleAudioStartFailure("Microphone access denied by Android: ${e.message}")
        } catch (e: Exception) {
            if (running.get() && !paused.get() && !pausedForMic.get()) {
                Log.e(TAG, "Capture loop error", e)
                WakeWordDiagnostics.updateServiceState(
                    this,
                    "error",
                    "Audio capture error: ${e.message}"
                )
                OvernightTestManager.onServiceStateChanged(
                    this,
                    "error",
                    "Audio capture error: ${e.message}"
                )
                AtlasWakeWordPlugin.emitStatusChange(this)
            }
        } finally {
            isMicActuallyCapturing = false
            runCatching {
                if (record.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    record.stop()
                }
            }
            runCatching { record.release() }
            if (audioRecord === record) {
                audioRecord = null
            }
            activeAudioSessionId = -1
            AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD)
        }
    }

    private fun handleAudioStartFailure(reason: String) {
        Log.w(TAG, "handleAudioStartFailure: $reason")
        if (pausedForMic.get()) {
            // If Android blocked background AudioRecord re-open after another app finished recording,
            // fall back cleanly to an explicit paused state with a Resume button instead of dying silently.
            pausedForMic.set(false)
            paused.set(true)
            isServicePaused = true
            isMicSilenced = true
            releaseWakeLock()
            WakeWordDiagnostics.updateServiceState(this, "paused_mic_blocked", reason)
            OvernightTestManager.onServiceStateChanged(this, "paused_mic_blocked", reason)
            AtlasWakeWordPlugin.emitStatusChange(this)
            mainHandler.post { refreshListeningNotification() }
            return
        }
        WakeWordDiagnostics.updateServiceState(this, "error", reason)
        OvernightTestManager.onInterruption(this, "audio_start_failure", reason)
        AtlasWakeWordPlugin.emitStatusChange(this)
        mainHandler.post {
            stopPipeline(reason)
            stopForegroundCompat()
            stopSelf()
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
        OvernightTestManager.onDetection(this, modelInfo.targetPhrase, score, inferenceLatencyMs)
        AtlasWakeWordPlugin.emitWakeWordDetected(eventJson)
        AtlasWakeWordPlugin.emitStatusChange(this)

        // Minimal local wake response (no cloud LLM, no private vault actions, no forced background startActivity).
        mainHandler.post {
            vibrateBriefly()
            postDetectionNotification(modelInfo, score, inferenceLatencyMs, env)

            if (useAssistantSessionOnWake) {
                playShortChime(env)
                val vis = AtlasExperimentVoiceInteractionService.instance
                if (vis != null) {
                    // Pause mic briefly so assistant session does not conflict with wake chime/STT.
                    pausePipeline("Paused for experimental VoiceInteractionSession")
                    vis.launchExperimentalSession(modelInfo.targetPhrase, inferenceLatencyMs)
                }
            } else if (voiceAssistantEnabled) {
                voiceCoordinator?.onWakeWordDetected(modelInfo.targetPhrase, score, inferenceLatencyMs)
            } else {
                playShortChime(env)
            }
        }
    }

    private fun pausePipeline(reason: String) {
        if (!running.get() || paused.get()) return
        paused.set(true)
        isServicePaused = true
        runCatching { audioRecord?.stop() }
        releaseWakeLock()
        WakeWordDiagnostics.updateServiceState(this, "paused_for_voice", reason)
        AtlasWakeWordPlugin.emitStatusChange(this)
        refreshListeningNotification()
    }

    private fun clearMicRecoveryCallbacks() {
        micMonitorHandler?.removeCallbacks(micRecoveryPollRunnable)
        mainHandler.removeCallbacks(micRecoveryPollRunnable)
    }

    private fun resumePipeline() {
        if (!running.get() || (!paused.get() && !pausedForMic.get())) return
        if (!hasMicPermission()) {
            stopPipeline("Cannot resume: microphone permission revoked")
            stopForegroundCompat()
            stopSelf()
            return
        }
        paused.set(false)
        pausedForMic.set(false)
        isServicePaused = false
        isMicSilenced = false
        clearMicRecoveryCallbacks()
        captureThread?.join(300L)
        engine?.reset()
        acquireWakeLock()
        val model = engine?.modelInfo ?: WakeWordModelManager.getActiveModel(this)
        WakeWordDiagnostics.updateServiceState(this, "listening", "Resumed listening (${model.targetPhrase})", model)
        AtlasWakeWordPlugin.emitStatusChange(this)
        refreshListeningNotification()
        startCaptureLoopIfNeeded()
    }

    private fun stopPipeline(reason: String) {
        running.set(false)
        paused.set(false)
        pausedForMic.set(false)
        pausedForVoiceSession.set(false)
        isServiceRunning = false
        isServicePaused = false
        isMicSilenced = false
        voiceCoordinator?.onWakeServiceStopped()
        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.EXTERNAL_APP)
        clearMicRecoveryCallbacks()
        abandonAudioFocus()
        runCatching { audioRecord?.stop() }
        captureThread?.interrupt()
        captureThread = null
        engine?.close()
        engine = null
        releaseWakeLock()
        WakeWordDiagnostics.updateServiceState(this, "stopped", reason)
        OvernightTestManager.onServiceStateChanged(this, "stopped", reason)
        AtlasWakeWordPlugin.emitStatusChange(this)
    }

    private fun requestAudioFocusForListening() {
        val am = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attrs)
                .setAcceptsDelayedFocusGain(false)
                .setWillPauseWhenDucked(true)
                .setOnAudioFocusChangeListener(audioFocusChangeListener, micMonitorHandler ?: mainHandler)
                .build()
            audioFocusRequest = req
            am.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            )
        }
        Log.d(TAG, "Audio focus requested for wake-word listening")
    }

    private fun abandonAudioFocus() {
        val am = audioManager ?: return
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus(audioFocusChangeListener)
            }
        }
        Log.d(TAG, "Audio focus abandoned")
    }

    private fun isInCallMode(): Boolean {
        val mode = audioManager?.mode ?: AudioManager.MODE_NORMAL
        return mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION
    }

    private fun isExternalAppRecording(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        val am = audioManager ?: return false
        val ours = activeAudioSessionId
        return am.activeRecordingConfigurations.any { cfg ->
            val silenced = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) cfg.isClientSilenced else false
            cfg.clientAudioSessionId != ours && !silenced
        }
    }

    private fun pauseForMicCompetition(reason: String) {
        if (!running.get() || destroyed.get()) return
        if (pausedForVoiceSession.get() && !isInCallMode()) return
        if (pausedForMic.getAndSet(true)) return
        isMicSilenced = true
        AtlasAudioOwnershipCoordinator.forceExternalPreemption()
        voiceCoordinator?.onExternalMicOrCallInterruption(reason)
        // Abandon audio focus first so the competing app gets notified we are out of the way,
        // then immediately release the hardware AudioRecord handle (0 ms).
        abandonAudioFocus()
        val rec = audioRecord
        audioRecord = null
        activeAudioSessionId = -1
        runCatching { rec?.stop() }
        runCatching { rec?.release() }
        captureThread?.interrupt()
        Log.i(TAG, "Released AudioRecord hardware handle for competing mic app: $reason")
        val h = micMonitorHandler ?: mainHandler
        clearMicRecoveryCallbacks()
        h.postDelayed(micRecoveryPollRunnable, 25_000L)
        mainHandler.post {
            WakeWordDiagnostics.recordMicCompetition(this, reason)
            WakeWordDiagnostics.updateServiceState(this, "silenced_by_mic_competition", reason)
            OvernightTestManager.onInterruption(this, "mic_competition", reason)
            AtlasWakeWordPlugin.emitStatusChange(this)
            refreshListeningNotification()
        }
    }

    private fun resumeFromMicCompetition() {
        if (!running.get() || !pausedForMic.get() || paused.get() || destroyed.get()) return
        if (isExternalAppRecording() || isInCallMode()) {
            val h = micMonitorHandler ?: mainHandler
            clearMicRecoveryCallbacks()
            h.postDelayed(micRecoveryPollRunnable, 25_000L)
            return
        }
        Log.i(TAG, "External mic app closed; attempting AudioRecord re-acquisition")
        pausedForMic.set(false)
        isMicSilenced = false
        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.EXTERNAL_APP)
        clearMicRecoveryCallbacks()
        captureThread?.join(350L)
        engine?.reset()
        mainHandler.post {
            if (!running.get() || paused.get() || pausedForMic.get() || destroyed.get()) return@post
            WakeWordDiagnostics.updateServiceState(
                this,
                "listening",
                "Microphone released for other app and restored cleanly"
            )
            AtlasWakeWordPlugin.emitStatusChange(this)
            refreshListeningNotification()
            requestAudioFocusForListening()
            startCaptureLoopIfNeeded()
        }
    }

    private fun registerMicCompetitionCallback() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val am = audioManager ?: return
        val cb = object : AudioManager.AudioRecordingCallback() {
            override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>) {
                if (!running.get() || paused.get() || pausedForVoiceSession.get() || destroyed.get()) return
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val ours = activeAudioSessionId
                    val oursSilenced = ours != -1 && configs.any {
                        it.clientAudioSessionId == ours && it.isClientSilenced
                    }
                    val externalActive = configs.any {
                        it.clientAudioSessionId != ours && !it.isClientSilenced
                    }
                    if (oursSilenced || externalActive) {
                        pauseForMicCompetition("Released Atlas mic so external recording/call app has full access")
                    } else if (pausedForMic.get() && !externalActive && !isInCallMode()) {
                        val h = micMonitorHandler ?: mainHandler
                        clearMicRecoveryCallbacks()
                        h.postDelayed(micRecoveryPollRunnable, 25_000L)
                    }
                }
            }
        }
        recordingCallback = cb
        am.registerAudioRecordingCallback(cb, micMonitorHandler ?: mainHandler)
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Atlas:HeyAtlasWakeWordPoC").apply {
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
                    vibrator.vibrate(VibrationEffect.createOneShot(85L, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(85L)
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
                    pcm[i] = (sin(2.0 * PI * freq * t) * 14000.0 * envAmp).toInt().toShort()
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
            .setSilent(true)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        nm.notify(NOTIFICATION_ID_DETECTED, notif)
    }

    private fun refreshListeningNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        val model = engine?.modelInfo ?: WakeWordModelManager.getActiveModel(this)
        nm.notify(NOTIFICATION_ID_LISTENING, buildListeningNotification(model))
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
        val resumeIntent = PendingIntent.getService(
            this,
            2,
            Intent(this, AtlasWakeWordService::class.java).apply {
                action = ACTION_RESUME
                putExtra(EXTRA_FROM_NOTIFICATION, true)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val label = when {
            pausedForMic.get() -> "Mic released for other recording/call app — tap Resume"
            paused.get() -> "Listening paused — tap Resume to continue"
            modelInfo.isCustomHeyAtlasModel -> "Listening offline for \"Hey Atlas\""
            else -> "Listening offline (TEST MODEL: \"${modelInfo.targetPhrase}\")"
        }
        val builder = NotificationCompat.Builder(this, CHANNEL_LISTENING)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Atlas Wake-Word Experiment")
            .setContentText(label)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openIntent)
            .addAction(0, "Stop Listening", stopIntent)
        if (paused.get() || pausedForMic.get()) {
            builder.addAction(0, "Resume", resumeIntent)
        }
        return builder.build()
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
        if (screenReceiverRegistered) {
            runCatching { unregisterReceiver(screenReceiver) }
            screenReceiverRegistered = false
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            recordingCallback?.let { cb -> audioManager?.unregisterAudioRecordingCallback(cb) }
        }
        if (running.get()) {
            stopPipeline("Service destroyed by system")
        } else {
            abandonAudioFocus()
            releaseWakeLock()
            engine?.close()
            engine = null
        }
        voiceCoordinator?.releaseResources()
        if (activeVoiceCoordinator === voiceCoordinator) {
            activeVoiceCoordinator = null
        }
        micMonitorThread?.quitSafely()
        micMonitorThread = null
        micMonitorHandler = null
        super.onDestroy()
    }
}
