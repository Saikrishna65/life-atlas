package com.lifeatlas.app.wakeword.voice

import android.app.KeyguardManager
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.lifeatlas.app.wakeword.AtlasWakeWordPlugin
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.sin

/**
 * Central deterministic state machine for Hey Atlas full AI voice sessions.
 *
 * Coordinates:
 * - Wake-word AudioRecord pause & deterministic release
 * - SpeechRecognizer (on-device preferred, en-IN / en-US)
 * - JS Atlas AI & ActionGateway bridge (with lock-screen & offline native fallback)
 * - Natural TTS playback & ~5-second follow-up listening window
 * - Clean resumption back to offline wake-word listening
 */
class AtlasVoiceCoordinator(
    private val context: Context,
    private val serviceActions: ServiceActions
) {
    companion object {
        private const val TAG = "AtlasVoiceCoordinator"
        private const val JS_REPLY_TIMEOUT_MS = 8500L
    }

    enum class State {
        IDLE,
        WAKE_LISTENING,
        WAKE_DETECTED,
        SESSION_STARTING,
        COMMAND_LISTENING,
        TRANSCRIBING,
        THINKING,
        SPEAKING,
        FOLLOW_UP_LISTENING,
        SESSION_ENDING,
        ERROR_RECOVERY
    }

    interface ServiceActions {
        fun isWakeListeningActive(): Boolean
        fun pauseWakeWordForVoiceSession(reason: String)
        fun resumeWakeWordFromVoiceSession()
        fun isInPhoneCall(): Boolean
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val speechManager = AtlasVoiceSpeechManager(context)
    private val ttsManager = AtlasVoiceTtsManager(context)

    @Volatile
    var state: State = State.IDLE
        private set

    @Volatile
    var currentSessionId: String? = null
        private set

    private var currentTurnId: String? = null
    private var pendingEndSession = false
    private var allowOnlineSpeechFallback = false
    @Volatile
    var greetOnWake: Boolean = true
    private var jsReplyTimeoutRunnable: Runnable? = null

    fun setAllowOnlineSpeechFallback(allow: Boolean) {
        allowOnlineSpeechFallback = allow
    }

    fun getSpeechCapabilities(): AtlasVoiceSpeechManager.Capabilities = speechManager.checkCapabilities()

    fun isSessionActive(): Boolean {
        return state != State.IDLE && state != State.WAKE_LISTENING
    }

    fun onWakeServiceStarted() {
        mainHandler.post {
            ttsManager.warmUp()
            if (!isSessionActive()) {
                transitionTo(State.WAKE_LISTENING, "Wake-word service listening")
            }
        }
    }

    fun onWakeServiceStopped() {
        mainHandler.post {
            cancelTimers()
            speechManager.stop()
            ttsManager.stop()
            currentSessionId = null
            currentTurnId = null
            pendingEndSession = false
            transitionTo(State.IDLE, "Wake-word service stopped")
        }
    }

    fun onExternalMicOrCallInterruption(reason: String) {
        mainHandler.post {
            if (isSessionActive()) {
                Log.i(TAG, "Ending voice session due to external mic/call: $reason")
                endSessionInternal(resumeWakeWord = false, reason = reason)
            }
        }
    }

    /**
     * Triggered when Hey Atlas wake-word fires. Prevents duplicate sessions.
     */
    fun onWakeWordDetected(phrase: String, score: Float, @Suppress("UNUSED_PARAMETER") latencyMs: Double) {
        startSessionInternal(phrase = phrase, score = score, speakGreeting = greetOnWake)
    }

    /**
     * Manual push-to-talk or programmatic start from UI while wake service is running.
     */
    fun startManualSession() {
        startSessionInternal(phrase = "Manual trigger", score = 1.0f, speakGreeting = false)
    }

    private fun startSessionInternal(phrase: String, score: Float, speakGreeting: Boolean) {
        mainHandler.post {
            if (isSessionActive()) {
                Log.w(TAG, "Ignoring wake detection; voice session already active (state=$state)")
                return@post
            }
            if (serviceActions.isInPhoneCall()) {
                Log.i(TAG, "Ignoring wake detection during active phone/VoIP call")
                return@post
            }

            val sessionId = UUID.randomUUID().toString()
            currentSessionId = sessionId
            currentTurnId = null
            pendingEndSession = false

            transitionTo(State.WAKE_DETECTED, "Wake word \"$phrase\" detected (score=${"%.2f".format(score)})")
            transitionTo(State.SESSION_STARTING, "Handing off microphone from wake-word loop")

            serviceActions.pauseWakeWordForVoiceSession("Voice session $sessionId starting")

            // Deterministically wait until AudioRecord has closed and released WAKE_WORD ownership.
            AtlasAudioOwnershipCoordinator.awaitRelease(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD) {
                mainHandler.post {
                    if (currentSessionId == sessionId && state == State.SESSION_STARTING) {
                        playActivationCue {
                            if (currentSessionId == sessionId && state == State.SESSION_STARTING) {
                                if (speakGreeting) {
                                    speakGreetingThenListen(sessionId)
                                } else {
                                    beginListeningTurn(isFollowUp = false)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private fun speakGreetingThenListen(sessionId: String) {
        val greeting = "Hey! What's up?"
        transitionTo(State.SPEAKING, greeting)
        ttsManager.speak(greeting, object : AtlasVoiceTtsManager.Listener {
            override fun onSpeakStarted() {}

            override fun onSpeakCompleted() {
                if (currentSessionId == sessionId) {
                    beginListeningTurn(isFollowUp = false)
                }
            }

            override fun onSpeakError(message: String) {
                if (currentSessionId == sessionId) {
                    beginListeningTurn(isFollowUp = false)
                }
            }
        })
    }

    fun stopSession(reason: String = "Stopped by user") {
        mainHandler.post {
            if (!isSessionActive()) return@post
            endSessionInternal(resumeWakeWord = serviceActions.isWakeListeningActive(), reason = reason)
        }
    }

    fun submitJsReply(sessionId: String, turnId: String, replyText: String, endSession: Boolean) {
        mainHandler.post {
            if (currentSessionId != sessionId || currentTurnId != turnId) {
                Log.w(TAG, "Discarding stale JS voice reply (expected=$currentSessionId/$currentTurnId, got=$sessionId/$turnId)")
                return@post
            }
            cancelTimers()
            pendingEndSession = endSession
            speakResponse(replyText)
        }
    }

    fun releaseResources() {
        mainHandler.post {
            cancelTimers()
            speechManager.stop()
            ttsManager.release()
            currentSessionId = null
            currentTurnId = null
            state = State.IDLE
        }
    }

    private fun beginListeningTurn(isFollowUp: Boolean) {
        val sessionId = currentSessionId ?: return
        val targetState = if (isFollowUp) State.FOLLOW_UP_LISTENING else State.COMMAND_LISTENING
        transitionTo(
            targetState,
            if (isFollowUp) "Listening for follow-up (~5s window)" else "Listening for command"
        )

        speechManager.startListening(
            isFollowUp = isFollowUp,
            allowOnlineFallback = allowOnlineSpeechFallback,
            languageTag = "en-IN",
            listener = object : AtlasVoiceSpeechManager.Listener {
                override fun onReadyForSpeech() {
                    emitTranscriptEvent("", isFinal = false)
                }

                override fun onBeginningOfSpeech() {
                    if (currentSessionId != sessionId) return
                    transitionTo(State.TRANSCRIBING, "Speech detected")
                }

                override fun onPartialResult(text: String) {
                    if (currentSessionId != sessionId) return
                    if (state == State.COMMAND_LISTENING || state == State.FOLLOW_UP_LISTENING) {
                        transitionTo(State.TRANSCRIBING, "Receiving partial transcript")
                    }
                    emitTranscriptEvent(text, isFinal = false)
                }

                override fun onFinalResult(text: String) {
                    if (currentSessionId != sessionId) return
                    Log.i(TAG, "Final transcript (followUp=$isFollowUp): \"$text\"")
                    emitTranscriptEvent(text, isFinal = true)
                    handleRecognizedTranscript(sessionId, text, isFollowUp)
                }

                override fun onRecognitionError(errorCode: Int, message: String, isTimeoutOrNoMatch: Boolean) {
                    if (currentSessionId != sessionId) return
                    if (isFollowUp && isTimeoutOrNoMatch) {
                        // Silent follow-up timeout ends the conversation naturally
                        endSessionInternal(resumeWakeWord = true, reason = "Follow-up window closed")
                        return
                    }
                    if (!isFollowUp && isTimeoutOrNoMatch) {
                        transitionTo(State.ERROR_RECOVERY, message)
                        pendingEndSession = true
                        speakResponse("I didn't catch that. Just say Hey Atlas whenever you need me.")
                        return
                    }
                    transitionTo(State.ERROR_RECOVERY, message)
                    endSessionInternal(resumeWakeWord = true, reason = message)
                }
            }
        )
    }

    private fun handleRecognizedTranscript(sessionId: String, transcript: String, isFollowUp: Boolean) {
        val normalized = transcript.trim().lowercase(Locale.ROOT)
        if (isExplicitStopPhrase(normalized)) {
            pendingEndSession = true
            speakResponse("Okay, going back to sleep.")
            return
        }

        transitionTo(State.THINKING, "Processing: \"$transcript\"")

        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val isLocked = km?.isKeyguardLocked ?: false

        val turnId = UUID.randomUUID().toString()
        currentTurnId = turnId

        if (AtlasWakeWordPlugin.hasActivePlugin()) {
            val payload = JSONObject()
                .put("sessionId", sessionId)
                .put("turnId", turnId)
                .put("transcript", transcript)
                .put("isLocked", isLocked)
                .put("isFollowUp", isFollowUp)
            AtlasWakeWordPlugin.emitVoiceCommand(payload)

            cancelTimers()
            val timeout = Runnable {
                if (currentSessionId == sessionId && currentTurnId == turnId && state == State.THINKING) {
                    Log.w(TAG, "JS bridge reply timed out; using native fallback")
                    val fallback = buildNativeFallbackReply(transcript, isLocked)
                    pendingEndSession = fallback.second
                    speakResponse(fallback.first)
                }
            }
            jsReplyTimeoutRunnable = timeout
            mainHandler.postDelayed(timeout, JS_REPLY_TIMEOUT_MS)
        } else {
            val fallback = buildNativeFallbackReply(transcript, isLocked)
            pendingEndSession = fallback.second
            speakResponse(fallback.first)
        }
    }

    private fun speakResponse(text: String) {
        val sessionId = currentSessionId ?: return
        val clean = text.trim()
        if (clean.isEmpty()) {
            if (pendingEndSession) {
                endSessionInternal(resumeWakeWord = true, reason = "Completed")
            } else {
                beginListeningTurn(isFollowUp = true)
            }
            return
        }

        transitionTo(State.SPEAKING, clean)
        ttsManager.speak(clean, object : AtlasVoiceTtsManager.Listener {
            override fun onSpeakStarted() {}

            override fun onSpeakCompleted() {
                if (currentSessionId != sessionId) return
                if (pendingEndSession) {
                    endSessionInternal(resumeWakeWord = true, reason = "Session completed")
                } else {
                    beginListeningTurn(isFollowUp = true)
                }
            }

            override fun onSpeakError(message: String) {
                if (currentSessionId != sessionId) return
                Log.w(TAG, "TTS error: $message")
                if (pendingEndSession) {
                    endSessionInternal(resumeWakeWord = true, reason = message)
                } else {
                    beginListeningTurn(isFollowUp = true)
                }
            }
        })
    }

    private fun endSessionInternal(resumeWakeWord: Boolean, reason: String) {
        transitionTo(State.SESSION_ENDING, reason)
        cancelTimers()
        speechManager.stop()
        ttsManager.stop()
        currentSessionId = null
        currentTurnId = null
        pendingEndSession = false

        if (resumeWakeWord && !serviceActions.isInPhoneCall()) {
            transitionTo(State.WAKE_LISTENING, "Resuming offline wake-word detection")
            serviceActions.resumeWakeWordFromVoiceSession()
        } else {
            transitionTo(State.IDLE, reason)
        }
    }

    private fun transitionTo(next: State, detail: String) {
        if (state == next && next != State.THINKING && next != State.SPEAKING) return
        state = next
        Log.i(TAG, "Voice state -> $next ($detail)")
        val json = JSONObject()
            .put("state", next.name)
            .put("sessionId", currentSessionId ?: JSONObject.NULL)
            .put("detail", detail)
        AtlasWakeWordPlugin.emitVoiceSessionState(json)
    }

    private fun emitTranscriptEvent(text: String, isFinal: Boolean) {
        val json = JSONObject()
            .put("sessionId", currentSessionId ?: JSONObject.NULL)
            .put("text", text)
            .put("isFinal", isFinal)
        AtlasWakeWordPlugin.emitVoiceTranscript(json)
    }

    private fun cancelTimers() {
        jsReplyTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        jsReplyTimeoutRunnable = null
    }

    private fun isExplicitStopPhrase(normalized: String): Boolean {
        val exact = setOf(
            "stop", "cancel", "that's all", "thats all", "go to sleep",
            "never mind", "nevermind", "bye", "bye atlas", "goodbye", "exit", "nothing"
        )
        if (exact.contains(normalized)) return true
        return normalized.startsWith("stop ") || normalized == "that is all"
    }

    private fun buildNativeFallbackReply(transcript: String, isLocked: Boolean): Pair<String, Boolean> {
        val lower = transcript.lowercase(Locale.ROOT)
        if (isLocked && (
                lower.contains("finance") || lower.contains("balance") || lower.contains("bank") ||
                    lower.contains("expense") || lower.contains("money") || lower.contains("memory") ||
                    lower.contains("memories") || lower.contains("vault") || lower.contains("trip") ||
                    lower.contains("itinerary") || lower.contains("password")
                )
        ) {
            return "Your phone is locked, so I can't access private Life Atlas vault data right now. Unlock your device and ask again." to true
        }
        if (lower == "hey atlas" || lower == "atlas" || lower.contains("hello") || lower.contains("hi atlas") || lower.contains("what's up")) {
            return "Hey! What's up?" to false
        }
        if (lower.contains("time")) {
            val now = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date())
            return "It's $now." to false
        }
        if (lower.contains("date") || lower.contains("day is it")) {
            val today = SimpleDateFormat("EEEE, MMMM d", Locale.getDefault()).format(Date())
            return "Today is $today." to false
        }
        if (isLocked) {
            return "I'm listening in lock-screen mode. Unlock your phone and open Life Atlas for full AI chat and vault actions." to true
        }
        return "Open Life Atlas to use full AI conversation and vault actions." to true
    }

    private fun playActivationCue(onDone: () -> Unit) {
        Thread({
            try {
                val sr = 16000
                val samples = (sr * 0.11).toInt()
                val pcm = ShortArray(samples)
                for (i in 0 until samples) {
                    val t = i.toDouble() / sr
                    val freq = if (i < samples / 2) 587.33 else 880.0
                    val env = kotlin.math.sin(Math.PI * i / samples)
                    pcm[i] = (sin(2.0 * Math.PI * freq * t) * 3800 * env).toInt().toShort()
                }
                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANT)
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
                Thread.sleep(125)
                track.stop()
                track.release()
            } catch (_: Exception) {
            } finally {
                mainHandler.post { onDone() }
            }
        }, "AtlasActivationCue").start()
    }
}
