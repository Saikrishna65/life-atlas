package com.lifeatlas.app.wakeword.activation

import android.Manifest
import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.lifeatlas.app.MainActivity
import com.lifeatlas.app.wakeword.voice.AtlasVoiceCoordinator
import java.lang.ref.WeakReference

/** Minimal native lock-screen host. The normal unlocked path opens the existing Atlas voice UI. */
class AtlasGoogleBridgeActivity : Activity() {
    companion object {
        private var active: WeakReference<AtlasGoogleBridgeActivity>? = null
        fun closeActive() { active?.get()?.finish(); active = null }
    }
    private var nativeConversation = false
    private var started = false
    private var resumed = false
    private var startNative: (() -> Unit)? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        active = WeakReference(this)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setPadding(32, 48, 32, 48); setBackgroundColor(Color.rgb(19, 32, 27))
        }
        val title = TextView(this).apply { text = "Atlas"; textSize = 42f; setTextColor(Color.WHITE); gravity = Gravity.CENTER }
        val status = TextView(this).apply { text = "Preparing voice…"; textSize = 20f; setTextColor(Color.WHITE); gravity = Gravity.CENTER; setPadding(0, 32, 0, 32) }
        val note = TextView(this).apply { text = "Google bridge · experimental\nWait for the listening cue. Your device lock still protects private data."; textSize = 14f; setTextColor(Color.LTGRAY); gravity = Gravity.CENTER }
        val stop = Button(this).apply { text = "Stop"; setOnClickListener { AtlasActivationRuntime.stopBridge(); finish() } }
        panel.addView(title); panel.addView(status); panel.addView(note); panel.addView(stop)
        setContentView(panel)
        val token = intent.getStringExtra("activation_token")
        if (!AtlasActivationRuntime.valid(this, token)) { finish(); return }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            AtlasActivationRuntime.failed("Allow the microphone from Voice activation settings first."); finish(); return
        }
        val locked = (getSystemService(KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
        if (!locked) {
            if (!AtlasActivationRuntime.waitForApp(this, token!!)) { finish(); return }
            try {
                startActivity(Intent(this, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    putExtra("target_route", "/secret/atlas")
                })
                @Suppress("DEPRECATION")
                overridePendingTransition(0, 0)
            } catch (_: Exception) { AtlasActivationRuntime.failed("Android could not open the Atlas app.") }
            finish()
            return
        }
        // A locked device gets the coordinator's existing restricted native fallback. Never
        // show the private WebView or dismiss keyguard automatically.
        nativeConversation = true
        startNative = {
            if (!isFinishing && resumed && !started) {
                started = true
                if (!AtlasActivationRuntime.startConversation(this, token!!, observer = { state, detail ->
                    status.text = when (state) {
                        AtlasVoiceCoordinator.State.SPEAKING -> detail
                        AtlasVoiceCoordinator.State.COMMAND_LISTENING -> "Listening…"
                        AtlasVoiceCoordinator.State.FOLLOW_UP_LISTENING -> "Anything else?"
                        AtlasVoiceCoordinator.State.THINKING -> "Thinking…"
                        AtlasVoiceCoordinator.State.TRANSCRIBING -> "Hearing you…"
                        AtlasVoiceCoordinator.State.ERROR_RECOVERY -> "Voice could not continue. Try again."
                        else -> "Preparing voice…"
                    }
                })) finish()
            }
        }
    }
    override fun onResume() {
        super.onResume()
        resumed = true
        window.decorView.post { if (resumed) startNative?.invoke() }
    }
    override fun onPause() {
        resumed = false
        if (nativeConversation) AtlasActivationRuntime.leaving(this)
        super.onPause()
    }
    override fun onDestroy() {
        AtlasActivationRuntime.leaving(this)
        if (active?.get() === this) active = null
        super.onDestroy()
    }
}
