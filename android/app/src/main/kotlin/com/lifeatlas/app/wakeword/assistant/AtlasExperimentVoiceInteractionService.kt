package com.lifeatlas.app.wakeword.assistant

import android.os.Bundle
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.util.Log

/**
 * Separate, optional VoiceInteractionService feasibility experiment.
 * Does NOT replace the user's default assistant automatically and never claims
 * access to Google's privileged DSP hotword hardware.
 */
class AtlasExperimentVoiceInteractionService : VoiceInteractionService() {

    companion object {
        private const val TAG = "AtlasExperimentVIS"

        @Volatile
        var instance: AtlasExperimentVoiceInteractionService? = null
            private set
    }

    override fun onReady() {
        super.onReady()
        instance = this
        Log.i(TAG, "Experimental VoiceInteractionService ready")
    }

    override fun onDestroy() {
        if (instance === this) {
            instance = null
        }
        super.onDestroy()
    }

    fun launchExperimentalSession(phrase: String, latencyMs: Double) {
        try {
            val args = Bundle().apply {
                putString("phrase", phrase)
                putDouble("latencyMs", latencyMs)
                putString("source", "wake_word_experiment")
            }
            showSession(args, VoiceInteractionSession.SHOW_WITH_ASSIST)
        } catch (e: Exception) {
            Log.w(TAG, "showSession failed", e)
        }
    }
}
