package com.lifeatlas.app.wakeword.voice

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.Locale
import java.util.UUID

/**
 * Manages natural conversational Text-to-Speech for Atlas voice sessions.
 *
 * - Prefers installed offline female/natural English voices (en-IN / en-GB / en-US).
 * - Uses USAGE_ASSISTANT + AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK for clean headphone routing
 *   and media ducking.
 * - Reports completion and error callbacks deterministically.
 */
class AtlasVoiceTtsManager(private val context: Context) {

    companion object {
        private const val TAG = "AtlasVoiceTTS"
    }

    interface Listener {
        fun onSpeakStarted()
        fun onSpeakCompleted()
        fun onSpeakError(message: String)
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var initializing = false
    private var pendingSpeak: (() -> Unit)? = null

    private var activeUtteranceId: String? = null
    private var activeListener: Listener? = null
    private var focusRequest: AudioFocusRequest? = null
    private var hasFocus = false
    private var receiverRegistered = false

    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                stop()
            }
        }
    }

    fun hasOfflineEnglishVoice(): Boolean {
        val engine = tts ?: return true // Assume possible until initialized, or check when ready
        if (!ttsReady) return true
        return selectBestOfflineVoice(engine) != null
    }

    fun speak(text: String, listener: Listener) {
        val clean = text.trim().take(4000)
        if (clean.isEmpty()) {
            listener.onSpeakCompleted()
            return
        }

        mainHandler.post {
            ensureInitialized { ok ->
                if (!ok) {
                    listener.onSpeakError("Android Text-to-Speech engine failed to initialize.")
                    return@ensureInitialized
                }
                startSpeakInternal(clean, listener)
            }
        }
    }

    fun stop() {
        mainHandler.post {
            activeUtteranceId = null
            val cb = activeListener
            activeListener = null
            runCatching { tts?.stop() }
            releaseDuckFocus()
            AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.TTS)
            cb?.onSpeakCompleted()
        }
    }

    fun release() {
        mainHandler.post {
            activeUtteranceId = null
            activeListener = null
            pendingSpeak = null
            runCatching { tts?.stop() }
            runCatching { tts?.shutdown() }
            tts = null
            ttsReady = false
            initializing = false
            releaseDuckFocus()
            if (receiverRegistered) {
                runCatching { context.unregisterReceiver(noisyReceiver) }
                receiverRegistered = false
            }
            AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.TTS)
        }
    }

    private fun ensureInitialized(onReady: (Boolean) -> Unit) {
        if (ttsReady && tts != null) {
            onReady(true)
            return
        }
        pendingSpeak = { onReady(ttsReady) }
        if (initializing) return

        initializing = true
        if (!receiverRegistered) {
            runCatching {
                ContextCompat.registerReceiver(
                    context,
                    noisyReceiver,
                    IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),
                    ContextCompat.RECEIVER_NOT_EXPORTED
                )
                receiverRegistered = true
            }
        }

        tts = TextToSpeech(context.applicationContext) { status ->
            mainHandler.post {
                initializing = false
                ttsReady = status == TextToSpeech.SUCCESS
                val engine = tts
                if (ttsReady && engine != null) {
                    engine.setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANT)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    selectBestOfflineVoice(engine)?.let { v ->
                        engine.voice = v
                        Log.i(TAG, "Selected TTS voice: ${v.name} (${v.locale})")
                    }
                    // Warm, soft, natural conversational cadence
                    engine.setPitch(1.04f)
                    engine.setSpeechRate(0.98f)
                    engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {
                            mainHandler.post {
                                if (utteranceId == activeUtteranceId) {
                                    activeListener?.onSpeakStarted()
                                }
                            }
                        }

                        override fun onDone(utteranceId: String?) {
                            mainHandler.post {
                                if (utteranceId == activeUtteranceId) {
                                    activeUtteranceId = null
                                    val cb = activeListener
                                    activeListener = null
                                    releaseDuckFocus()
                                    AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.TTS)
                                    cb?.onSpeakCompleted()
                                }
                            }
                        }

                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            handleError(utteranceId)
                        }

                        override fun onError(utteranceId: String?, errorCode: Int) {
                            handleError(utteranceId)
                        }

                        private fun handleError(utteranceId: String?) {
                            mainHandler.post {
                                if (utteranceId == activeUtteranceId) {
                                    activeUtteranceId = null
                                    val cb = activeListener
                                    activeListener = null
                                    releaseDuckFocus()
                                    AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.TTS)
                                    cb?.onSpeakError("Speech playback failed.")
                                }
                            }
                        }
                    })
                }
                val next = pendingSpeak
                pendingSpeak = null
                next?.invoke()
            }
        }
    }

    private fun startSpeakInternal(text: String, listener: Listener) {
        val engine = tts
        if (!ttsReady || engine == null) {
            listener.onSpeakError("TTS engine is not ready.")
            return
        }

        if (!AtlasAudioOwnershipCoordinator.tryAcquire(AtlasAudioOwnershipCoordinator.Owner.TTS)) {
            listener.onSpeakError("Audio channel busy with another owner.")
            return
        }

        val voice = selectBestOfflineVoice(engine)
        if (voice == null) {
            AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.TTS)
            listener.onSpeakError("No offline English TTS voice is installed on this device.")
            return
        }
        engine.voice = voice

        acquireDuckFocus()
        val id = UUID.randomUUID().toString()
        activeUtteranceId = id
        activeListener = listener

        val params = Bundle().apply {
            putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC)
        }
        val res = engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, id)
        if (res == TextToSpeech.ERROR) {
            activeUtteranceId = null
            activeListener = null
            releaseDuckFocus()
            AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.TTS)
            listener.onSpeakError("TextToSpeech.speak failed.")
        }
    }

    private fun selectBestOfflineVoice(engine: TextToSpeech): Voice? {
        val voices = runCatching { engine.voices }.getOrNull() ?: return null
        val offlineEnglish = voices.filter { v ->
            !v.isNetworkConnectionRequired &&
                !v.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) &&
                v.locale.language == Locale.ENGLISH.language
        }
        if (offlineEnglish.isEmpty()) return null

        // Score voices to prefer natural/female en-IN or en-US/en-GB voices when exposed by OEM/Google TTS
        return offlineEnglish.maxByOrNull { v ->
            var score = 0
            val name = v.name.lowercase(Locale.ROOT)
            val country = v.locale.country.uppercase(Locale.ROOT)
            if (country == "IN") score += 40
            else if (country == "GB" || country == "US") score += 25
            if (name.contains("female") || name.contains("sfg") || name.contains("tpf") || name.contains("iom") || name.contains("iob")) score += 30
            if (name.contains("network").not() && (name.contains("local") || name.contains("high"))) score += 10
            if (v.quality >= Voice.QUALITY_HIGH) score += 20
            else if (v.quality >= Voice.QUALITY_NORMAL) score += 10
            score
        }
    }

    private fun acquireDuckFocus() {
        val am = audioManager ?: return
        val res = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
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
            am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        }
        hasFocus = res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun releaseDuckFocus() {
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
}
