package com.lifeatlas.app.wakeword.voice

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log

/**
 * Manages Android SpeechRecognizer for natural English (with Indian English support),
 * preferring on-device recognition and never sending audio to cloud without explicit user consent.
 */
class AtlasVoiceSpeechManager(private val context: Context) {

    companion object {
        private const val TAG = "AtlasVoiceSpeech"
    }

    data class Capabilities(
        val onDeviceAvailable: Boolean,
        val systemRecognizerAvailable: Boolean,
        val reason: String
    )

    interface Listener {
        fun onReadyForSpeech()
        fun onBeginningOfSpeech()
        fun onEndOfSpeech() {}
        fun onPartialResult(text: String)
        fun onFinalResult(text: String)
        fun onRecognitionError(errorCode: Int, message: String, isTimeoutOrNoMatch: Boolean)
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

    private var recognizer: SpeechRecognizer? = null
    private var focusRequest: AudioFocusRequest? = null
    private var hasFocus = false
    private var activeEpoch = 0
    private var silenceWatchdogRunnable: Runnable? = null

    fun checkCapabilities(): Capabilities {
        val onDevice = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
        val systemAvailable = SpeechRecognizer.isRecognitionAvailable(context)
        val reason = when {
            onDevice -> "On-device speech recognition is available (Android 12+)."
            systemAvailable -> "On-device recognizer unavailable; system recognizer exists (requires explicit online consent)."
            else -> "No Android SpeechRecognizer service is available on this device."
        }
        return Capabilities(onDevice, systemAvailable, reason)
    }

    fun startListening(
        isFollowUp: Boolean,
        allowOnlineFallback: Boolean,
        languageTag: String = "en-IN",
        listener: Listener
    ) {
        mainHandler.post {
            stopInternal()
            val caps = checkCapabilities()
            if (!caps.onDeviceAvailable && !(allowOnlineFallback && caps.systemRecognizerAvailable)) {
                listener.onRecognitionError(
                    SpeechRecognizer.ERROR_CLIENT,
                    "On-device speech recognition is unavailable and online fallback is disabled.",
                    false
                )
                return@post
            }

            if (!AtlasAudioOwnershipCoordinator.tryAcquire(AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER)) {
                listener.onRecognitionError(
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
                    "Microphone is currently owned by another component.",
                    false
                )
                return@post
            }

            if (!acquireSpeechFocus()) {
                AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER)
                listener.onRecognitionError(
                    SpeechRecognizer.ERROR_AUDIO,
                    "Audio focus denied by Android.",
                    false
                )
                return@post
            }

            val epoch = ++activeEpoch
            try {
                val rec = if (caps.onDeviceAvailable && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
                } else {
                    SpeechRecognizer.createSpeechRecognizer(context)
                }
                recognizer = rec

                rec.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        if (epoch != activeEpoch) return
                        scheduleWatchdog(epoch, if (isFollowUp) 5000L else 7500L, listener)
                        listener.onReadyForSpeech()
                    }

                    override fun onBeginningOfSpeech() {
                        if (epoch != activeEpoch) return
                        cancelWatchdog()
                        scheduleWatchdog(epoch, 15000L, listener)
                        listener.onBeginningOfSpeech()
                    }

                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {
                        if (epoch != activeEpoch) return
                        cancelWatchdog()
                        listener.onEndOfSpeech()
                    }

                    override fun onError(error: Int) {
                        if (epoch != activeEpoch) return
                        val isNoMatch = error == SpeechRecognizer.ERROR_NO_MATCH ||
                            error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                        val msg = mapErrorMessage(error)
                        stopInternal()
                        listener.onRecognitionError(error, msg, isNoMatch)
                    }

                    override fun onResults(results: Bundle?) {
                        if (epoch != activeEpoch) return
                        val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = list?.firstOrNull()?.trim().orEmpty()
                        stopInternal()
                        if (text.isEmpty()) {
                            listener.onRecognitionError(
                                SpeechRecognizer.ERROR_NO_MATCH,
                                "Did not catch any speech.",
                                true
                            )
                        } else {
                            listener.onFinalResult(text)
                        }
                    }

                    override fun onPartialResults(partialResults: Bundle?) {
                        if (epoch != activeEpoch) return
                        val list = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val partial = list?.firstOrNull()?.trim().orEmpty()
                        if (partial.isNotEmpty()) {
                            listener.onPartialResult(partial)
                        }
                    }

                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, languageTag)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    if (caps.onDeviceAvailable || !allowOnlineFallback) {
                        putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    }
                    // VAD & silence tuning for responsive end-of-utterance
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 350L)
                    putExtra(
                        RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS,
                        if (isFollowUp) 900L else 650L
                    )
                    putExtra(
                        RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
                        if (isFollowUp) 750L else 500L
                    )
                }
                rec.startListening(intent)
                Log.i(TAG, "SpeechRecognizer started (onDevice=${caps.onDeviceAvailable}, followUp=$isFollowUp, lang=$languageTag)")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start SpeechRecognizer", e)
                stopInternal()
                listener.onRecognitionError(
                    SpeechRecognizer.ERROR_CLIENT,
                    e.message ?: "Failed to start speech recognizer.",
                    false
                )
            }
        }
    }

    fun stop() {
        mainHandler.post { stopInternal() }
    }

    private fun stopInternal() {
        activeEpoch++
        cancelWatchdog()
        runCatching { recognizer?.cancel() }
        runCatching { recognizer?.destroy() }
        recognizer = null
        releaseSpeechFocus()
        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER)
    }

    private fun scheduleWatchdog(epoch: Int, timeoutMs: Long, listener: Listener) {
        cancelWatchdog()
        val r = Runnable {
            if (epoch != activeEpoch) return@Runnable
            Log.w(TAG, "Speech recognition silence watchdog fired after ${timeoutMs}ms")
            stopInternal()
            listener.onRecognitionError(
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                "Listening timed out waiting for speech.",
                true
            )
        }
        silenceWatchdogRunnable = r
        mainHandler.postDelayed(r, timeoutMs)
    }

    private fun cancelWatchdog() {
        silenceWatchdogRunnable?.let { mainHandler.removeCallbacks(it) }
        silenceWatchdogRunnable = null
    }

    private fun acquireSpeechFocus(): Boolean {
        val am = audioManager ?: return false
        val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setOnAudioFocusChangeListener { change ->
                    if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                        stop()
                    }
                }
                .build()
            focusRequest = req
            am.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        }
        hasFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        return hasFocus
    }

    private fun releaseSpeechFocus() {
        if (!hasFocus) return
        val am = audioManager ?: return
        hasFocus = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { runCatching { am.abandonAudioFocusRequest(it) } }
            focusRequest = null
        } else {
            @Suppress("DEPRECATION")
            am.abandonAudioFocus(null)
        }
    }

    private fun mapErrorMessage(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error during recognition."
        SpeechRecognizer.ERROR_CLIENT -> "Speech recognizer client error."
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission missing."
        SpeechRecognizer.ERROR_NETWORK -> "Network error during recognition."
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout during recognition."
        SpeechRecognizer.ERROR_NO_MATCH -> "No matching speech detected."
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy."
        SpeechRecognizer.ERROR_SERVER -> "Recognition service error."
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech heard."
        else -> "Speech recognition error ($error)."
    }
}
