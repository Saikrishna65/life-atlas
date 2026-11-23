package com.lifeatlas.app.wakeword.activation

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import com.lifeatlas.app.wakeword.AtlasWakeWordPlugin
import com.lifeatlas.app.wakeword.AtlasWakeWordService

/** Window identity only. Never requests node trees, screenshots, audio or Google transcripts. */
class AtlasGoogleBridgeService : AccessibilityService() {
    companion object { @Volatile var connected = false; private set }
    private val handler = Handler(Looper.getMainLooper())
    private var dismissPackage = ""
    private var dismissClass = ""
    override fun onServiceConnected() { connected = true }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        if (AtlasActivationPreferences.mode(this) != AtlasActivationPreferences.GOOGLE || AtlasActivationRuntime.changing) return
        val pkg = event.packageName?.toString() ?: return
        val cls = event.className?.toString() ?: return
        val now = SystemClock.elapsedRealtime()
        // A dismissal must be observed before launching. Other packages are compared only in RAM,
        // never recorded, logged or exposed to JavaScript.
        if (AtlasActivationRuntime.gate.phase == GoogleBridgeGate.Phase.DISMISSING) {
            val freshTransition = SystemClock.uptimeMillis() - event.eventTime in 0L..500L
            val inputMethod = cls.startsWith("android.inputmethodservice.") || pkg.contains("inputmethod")
            if (freshTransition && !inputMethod && (pkg != dismissPackage || cls != dismissClass) && AtlasActivationRuntime.gate.dismissed(now)) {
                val token = AtlasActivationRuntime.prepareLaunch()
                try {
                    startActivity(Intent(this, AtlasGoogleBridgeActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        putExtra("activation_token", token)
                    })
                } catch (_: Exception) { AtlasActivationRuntime.failed("Android blocked opening Atlas. Try again while unlocked.") }
            }
            return
        }
        if (pkg !in AtlasActivationPreferences.GOOGLE_PACKAGES) return
        AtlasActivationRuntime.observed(pkg, cls)
        if (AtlasActivationPreferences.observeOnly(this)) {
            AtlasActivationRuntime.reason("Observed Google window. Confirm its exact class before enabling handoff.")
            return
        }
        val approved = AtlasActivationPreferences.overlay(this) == (pkg to cls)
        val fresh = android.os.SystemClock.uptimeMillis() - event.eventTime in 0L..500L
        if (!AtlasActivationRuntime.gate.candidate(now, fresh, approved,
                AtlasActivationRuntime.busy() || AtlasWakeWordService.isServiceRunning ||
                    AtlasWakeWordService.isMicActuallyCapturing || AtlasWakeWordService.activeVoiceCoordinator != null ||
                    AtlasWakeWordPlugin.isAppForeground())) return
        // BACK is global. Never issue it after launching Atlas, never repeat it blindly.
        dismissPackage = pkg
        dismissClass = cls
        if (!runCatching { performGlobalAction(GLOBAL_ACTION_BACK) }.getOrDefault(false)) {
            AtlasActivationRuntime.failed("Google dismissal was not accepted. No microphone was started.")
            return
        }
        handler.postDelayed({
            if (AtlasActivationRuntime.gate.phase == GoogleBridgeGate.Phase.DISMISSING)
                AtlasActivationRuntime.failed("Google dismissal was not observed. No microphone was started.")
        }, 1500L)
    }
    override fun onInterrupt() { AtlasActivationRuntime.stopBridge() }
    override fun onDestroy() {
        connected = false
        handler.removeCallbacksAndMessages(null)
        AtlasActivationRuntime.stopBridge()
        super.onDestroy()
    }
}
