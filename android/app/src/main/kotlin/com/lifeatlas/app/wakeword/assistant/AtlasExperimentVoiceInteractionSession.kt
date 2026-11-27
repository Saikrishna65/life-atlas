package com.lifeatlas.app.wakeword.assistant

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.lifeatlas.app.wakeword.AtlasWakeWordService

/**
 * Minimal assistant overlay session for testing assistant gesture & lock-screen behavior.
 * Intentionally isolated from Atlas private vaults and cloud LLMs.
 */
class AtlasExperimentVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {

    private var titleView: TextView? = null
    private var statusView: TextView? = null

    override fun onCreateContentView(): View {
        val dp = context.resources.displayMetrics.density
        val pad = (20 * dp).toInt()

        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.BOTTOM
            setPadding(pad, pad, pad, (36 * dp).toInt())
        }

        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#EE11161C"))
                cornerRadius = 22f * dp
                setStroke((1 * dp).toInt(), Color.parseColor("#44F59E0B"))
            }
        }

        val eyebrow = TextView(context).apply {
            text = "ATLAS · ASSISTANT SESSION EXPERIMENT"
            setTextColor(Color.parseColor("#F59E0B"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
        }

        val title = TextView(context).apply {
            text = "Atlas Assistant Session"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            setPadding(0, (6 * dp).toInt(), 0, (6 * dp).toInt())
        }
        titleView = title

        val status = TextView(context).apply {
            text = "Checking lock-screen state…"
            setTextColor(Color.parseColor("#CBD5E1"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setPadding(0, 0, 0, (14 * dp).toInt())
        }
        statusView = status

        val closeBtn = Button(context).apply {
            text = "Close Session"
            setOnClickListener { hide() }
        }

        card.addView(eyebrow)
        card.addView(title)
        card.addView(status)
        card.addView(closeBtn)
        root.addView(card)
        return root
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val locked = km?.isKeyguardLocked ?: false
        val phrase = args?.getString("phrase")
        val latency = args?.getDouble("latencyMs", -1.0) ?: -1.0
        val source = args?.getString("source") ?: "system_assist_gesture"

        titleView?.text = if (!phrase.isNullOrBlank()) {
            "Detected: \"$phrase\""
        } else {
            "Atlas Assistant Session"
        }
        val latencyInfo = if (latency >= 0) " · Latency ${"%.1f".format(latency)} ms" else ""
        statusView?.text =
            "Trigger: $source$latencyInfo\nLock screen active: ${if (locked) "Yes (keyguard locked)" else "No (unlocked)"}\nIsolated experiment — no private vault or cloud LLM access."
    }

    override fun onHide() {
        super.onHide()
        if (AtlasWakeWordService.isServiceRunning && AtlasWakeWordService.isServicePaused) {
            runCatching {
                context.startService(
                    Intent(context, AtlasWakeWordService::class.java).apply {
                        action = AtlasWakeWordService.ACTION_RESUME
                    }
                )
            }
        }
    }
}
