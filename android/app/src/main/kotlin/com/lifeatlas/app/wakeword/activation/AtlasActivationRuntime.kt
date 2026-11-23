package com.lifeatlas.app.wakeword.activation

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.lifeatlas.app.wakeword.AtlasWakeWordPlugin
import com.lifeatlas.app.wakeword.AtlasWakeWordService
import com.lifeatlas.app.wakeword.voice.AtlasAudioOwnershipCoordinator
import com.lifeatlas.app.wakeword.voice.AtlasVoiceCoordinator
import org.json.JSONObject
import java.util.UUID

/** Session-only activation state and numeric diagnostics. No audio, text history or secret storage. */
object AtlasActivationRuntime {
    private val main = Handler(Looper.getMainLooper())
    val gate = GoogleBridgeGate()
    @Volatile var changing = false
        private set
    @Volatile var bridgeCoordinator: AtlasVoiceCoordinator? = null
        private set
    private var pending: String? = null
    private var waitingForApp = false
    private var requestedAt = 0L
    private var lastReason = "Not tested on this device"
    var observedPackage = ""
        private set
    var observedClass = ""
        private set
    private var attempts = 0L
    private var opened = 0L
    private var failures = 0L
    private var microphoneReadyAt = 0L
    private var listeningMs = 0L
    private var handoffTotalMs = 0L
    private var lastHandoffMs = 0L
    private var sessionActivity: Activity? = null
    private var pendingTimeout: Runnable? = null
    private var sessionTimeout: Runnable? = null

    fun voiceCoordinator(): AtlasVoiceCoordinator? = bridgeCoordinator ?: AtlasWakeWordService.activeVoiceCoordinator
    fun busy() = changing || pending != null || bridgeCoordinator != null || gate.phase != GoogleBridgeGate.Phase.IDLE
    fun observed(pkg: String, cls: String) { observedPackage = pkg.take(240); observedClass = cls.take(240) }
    fun reason(value: String) { lastReason = value }
    fun failed(value: String) {
        failures++; lastReason = value; pending = null; waitingForApp = false; gate.reset()
        pendingTimeout?.let { main.removeCallbacks(it) }; pendingTimeout = null
    }
    fun resetMetrics() {
        attempts = 0; opened = 0; failures = 0; listeningMs = 0; handoffTotalMs = 0; lastHandoffMs = 0
        microphoneReadyAt = if (microphoneReadyAt > 0L) SystemClock.elapsedRealtime() else 0L
    }
    fun status(context: Context): JSONObject {
        val overlay = AtlasActivationPreferences.overlay(context)
        return JSONObject().put("mode", AtlasActivationPreferences.mode(context)).put("changing", changing)
            .put("supported", true).put("listenerRunning", AtlasWakeWordService.isServiceRunning)
            .put("listenerCapturing", AtlasWakeWordService.isMicActuallyCapturing)
            .put("accessibilityEnabled", AtlasActivationPreferences.accessibilityEnabled(context))
            .put("bridgeConnected", AtlasGoogleBridgeService.connected)
            .put("disclosureAccepted", AtlasActivationPreferences.consent(context))
            .put("observeOnly", AtlasActivationPreferences.observeOnly(context))
            .put("overlayPackage", overlay.first).put("overlayClass", overlay.second)
            .put("observedPackage", observedPackage).put("observedClass", observedClass)
            .put("phase", gate.phase.name).put("reason", lastReason)
            .put("microphoneGranted", ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
            .put("attempts", attempts).put("opened", opened).put("failures", failures)
            .put("lastHandoffMs", lastHandoffMs).put("averageHandoffMs", if (opened == 0L) 0L else handoffTotalMs / opened)
            .put("listeningMs", listeningMs + if (microphoneReadyAt == 0L) 0L else SystemClock.elapsedRealtime() - microphoneReadyAt)
    }
    fun switch(context: Context, target: String, assistantSession: Boolean = false, done: (String?) -> Unit) {
        main.post {
            if (changing) { done("MODE_SWITCH_IN_PROGRESS"); return@post }
            changing = true
            try { AtlasActivationPreferences.mode(context, AtlasActivationPreferences.OFF) }
            catch (_: Exception) { changing = false; done("ACTIVATION_SETTINGS_FAILED"); return@post }
            try {
                stopBridge()
                context.stopService(Intent(context, AtlasWakeWordService::class.java))
            } catch (_: Exception) {
                changing = false; done("ACTIVATION_STOP_FAILED"); return@post
            }
            val until = SystemClock.elapsedRealtime() + 4000L
            fun finishSwitch() {
                val owner = AtlasAudioOwnershipCoordinator.currentOwner
                if (AtlasWakeWordService.isServiceRunning || AtlasWakeWordService.isMicActuallyCapturing ||
                    AtlasWakeWordService.activeVoiceCoordinator != null ||
                    owner in setOf(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD, AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER, AtlasAudioOwnershipCoordinator.Owner.TTS)) {
                    if (SystemClock.elapsedRealtime() < until) { main.postDelayed({ finishSwitch() }, 50L); return }
                    changing = false; lastReason = "Audio has not released. Activation remains off; retry."; done("AUDIO_RELEASE_TIMEOUT"); return
                }
                try {
                    AtlasActivationPreferences.mode(context, target)
                    if (target == AtlasActivationPreferences.MICROPHONE) {
                        ContextCompat.startForegroundService(context, Intent(context, AtlasWakeWordService::class.java).apply {
                            action = AtlasWakeWordService.ACTION_START
                            putExtra(AtlasWakeWordService.EXTRA_USE_ASSISTANT_SESSION, assistantSession)
                        })
                    }
                    lastReason = when (target) {
                        AtlasActivationPreferences.GOOGLE -> "Google bridge selected. Check accessibility and observed overlay settings."
                        AtlasActivationPreferences.MICROPHONE -> "Microphone listener start requested."
                        else -> "Automatic voice activation is off."
                    }
                    changing = false; done(null)
                } catch (_: Exception) {
                    runCatching { AtlasActivationPreferences.mode(context, AtlasActivationPreferences.OFF) }
                    changing = false; lastReason = "Could not change activation. Both methods remain off."; done("ACTIVATION_START_FAILED")
                }
            }
            finishSwitch()
        }
    }
    fun prepareLaunch(): String {
        val token = UUID.randomUUID().toString()
        pending = token; waitingForApp = false; requestedAt = SystemClock.elapsedRealtime(); attempts++
        pendingTimeout?.let { main.removeCallbacks(it) }
        pendingTimeout = Runnable { if (pending == token) failed("Atlas did not become ready within 15 seconds. Try again.") }.also { main.postDelayed(it, 15000L) }
        return token
    }
    fun valid(context: Context, token: String?) = token != null && token == pending && !changing &&
        AtlasActivationPreferences.mode(context) == AtlasActivationPreferences.GOOGLE &&
        SystemClock.elapsedRealtime() - requestedAt < 15000L
    fun waitForApp(context: Context, token: String): Boolean {
        if (!valid(context, token)) return false
        waitingForApp = true
        return true
    }
    fun hasPendingInApp() = pending != null && waitingForApp
    fun consumeInApp(activity: Activity): Boolean {
        val token = pending ?: return false
        if (!waitingForApp || !AtlasWakeWordPlugin.isAppForeground()) return false
        return startConversation(activity, token)
    }
    fun startConversation(activity: Activity, token: String, observer: ((AtlasVoiceCoordinator.State, String) -> Unit)? = null): Boolean {
        if (!valid(activity, token) || AtlasWakeWordService.isServiceRunning || AtlasWakeWordService.isMicActuallyCapturing || AtlasWakeWordService.activeVoiceCoordinator != null ||
            bridgeCoordinator != null || AtlasAudioOwnershipCoordinator.currentOwner in setOf(
                AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD, AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER,
                AtlasAudioOwnershipCoordinator.Owner.TTS) || ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            failed("Voice could not start. Check microphone permission and listener state."); return false
        }
        val audio = activity.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: run { failed("Android audio service is unavailable."); return false }
        if (audio.mode in setOf(AudioManager.MODE_IN_CALL, AudioManager.MODE_IN_COMMUNICATION)) { failed("Voice activation skipped during a call."); return false }
        pending = null; waitingForApp = false; gate.session(); sessionActivity = activity
        pendingTimeout?.let { main.removeCallbacks(it) }; pendingTimeout = null
        lateinit var coordinator: AtlasVoiceCoordinator
        try {
        coordinator = AtlasVoiceCoordinator(activity, object : AtlasVoiceCoordinator.ServiceActions {
            override fun isWakeListeningActive() = false
            override fun pauseWakeWordForVoiceSession(reason: String) { /* No idle microphone in bridge mode. */ }
            override fun resumeWakeWordFromVoiceSession() { /* Never starts the wake-word engine. */ }
            override fun isInPhoneCall() = audio.mode in setOf(AudioManager.MODE_IN_CALL, AudioManager.MODE_IN_COMMUNICATION)
        }, googleHandoff = true, stateObserver = observer@{ state, detail ->
            if (bridgeCoordinator !== coordinator) return@observer
            val listening = state in setOf(AtlasVoiceCoordinator.State.COMMAND_LISTENING, AtlasVoiceCoordinator.State.FOLLOW_UP_LISTENING, AtlasVoiceCoordinator.State.TRANSCRIBING)
            if (listening && microphoneReadyAt == 0L) microphoneReadyAt = SystemClock.elapsedRealtime()
            if (!listening && microphoneReadyAt > 0L) { listeningMs += SystemClock.elapsedRealtime() - microphoneReadyAt; microphoneReadyAt = 0L }
            if (state == AtlasVoiceCoordinator.State.ERROR_RECOVERY) {
                failures++; lastReason = "The voice recognizer could not continue after handoff."
            }
            observer?.invoke(state, detail)
            if (state == AtlasVoiceCoordinator.State.IDLE) {
                lastReason = "Conversation ended. Waiting for the next approved Google overlay."
                main.post { stopBridge() }
            }
        })
        } catch (_: Exception) {
            sessionActivity = null
            failed("Voice components could not initialise. Your existing settings are unchanged.")
            return false
        }
        bridgeCoordinator = coordinator
        lastHandoffMs = SystemClock.elapsedRealtime() - requestedAt; handoffTotalMs += lastHandoffMs; opened++
        lastReason = "Conversation active"
        coordinator.startManualSession()
        main.postDelayed({
            if (bridgeCoordinator === coordinator && coordinator.currentSessionId == null) {
                failed("Voice did not start, possibly because a call began during handoff.")
                stopBridge()
            }
        }, 500L)
        // Every active conversation is bounded, even if a provider never calls back.
        sessionTimeout = Runnable { if (bridgeCoordinator === coordinator) stopBridge() }.also { main.postDelayed(it, 120000L) }
        return true
    }
    fun stopBridge() {
        pendingTimeout?.let { main.removeCallbacks(it) }; pendingTimeout = null
        sessionTimeout?.let { main.removeCallbacks(it) }; sessionTimeout = null
        if (bridgeCoordinator != null) lastReason = "Voice conversation stopped. No idle bridge microphone is active."
        if (microphoneReadyAt > 0L) { listeningMs += SystemClock.elapsedRealtime() - microphoneReadyAt; microphoneReadyAt = 0L }
        val previous = bridgeCoordinator
        bridgeCoordinator = null; sessionActivity = null
        previous?.stopSession("Voice activation stopped")
        previous?.releaseResources()
        pending = null; waitingForApp = false; gate.reset()
        AtlasGoogleBridgeActivity.closeActive()
    }
    fun leaving(activity: Activity) { if (sessionActivity === activity) stopBridge() }
}
