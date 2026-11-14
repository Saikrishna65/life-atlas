package com.lifeatlas.app.wakeword.assistant

import android.content.Intent
import android.speech.RecognitionService
import android.speech.SpeechRecognizer

/**
 * Minimal offline-only RecognitionService placeholder required by VoiceInteractionService metadata.
 * Fails closed without performing background or network speech recognition.
 */
class AtlasExperimentRecognitionService : RecognitionService() {
    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) {
        listener?.error(SpeechRecognizer.ERROR_CLIENT)
    }

    override fun onCancel(listener: Callback?) {}

    override fun onStopListening(listener: Callback?) {}
}
