package com.lifeatlas.app.wakeword.voice

import android.app.KeyguardManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.KeyEvent
import androidx.core.app.NotificationCompat
import com.lifeatlas.app.MainActivity
import com.lifeatlas.app.R
import com.lifeatlas.app.wakeword.AtlasWakeWordPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
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

        fun buildPersonalityPrompt(
            humor: Int,
            playfulness: Int,
            sweetness: Int,
            directness: Int,
            teasing: Int,
            responseLength: String
        ): String {
            val lengthGuide = when (responseLength) {
                "brief" -> "Keep replies ultra concise (1-2 short spoken sentences)."
                "detailed" -> "Give warm, helpful detail (2-4 spoken sentences)."
                else -> "Keep replies natural and concise (1-3 spoken sentences)."
            }
            return "You are Atlas, a warm, soft-spoken female personal companion inside Life Atlas. Casual friendly English; humor=$humor/10, playfulness=$playfulness/10, warmth=$sweetness/10, directness=$directness/10, playful teasing=$teasing/10. $lengthGuide Admit uncertainty honestly, never invent user data, and never joke during serious/safety situations."
        }

        fun buildPersonalityPrompt(personalityJson: JSONObject?): String {
            if (personalityJson == null) {
                return "You are Atlas, a warm, friendly, playful female voice companion inside Life Atlas. Speak naturally in 1 to 3 concise conversational English sentences."
            }
            return buildPersonalityPrompt(
                humor = personalityJson.optInt("humor", 6),
                playfulness = personalityJson.optInt("playfulness", 7),
                sweetness = personalityJson.optInt("sweetness", 8),
                directness = personalityJson.optInt("directness", 7),
                teasing = personalityJson.optInt("teasing", 4),
                responseLength = personalityJson.optString("responseLength", "balanced")
            )
        }

        // Legacy cloud transport is disabled. An unlocked, explicitly approved
        // foreground request is required; no voice history is sent automatically.
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
    private val secureStore = AtlasVoiceSecureStore(context)

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
    private val nativeTurns = mutableListOf<Pair<String, String>>()

    // Monotonic pipeline latency markers (elapsedRealtime ms)
    private var wakeDetectedAtMs = 0L
    private var greetingCompletedAtMs = 0L
    private var speechEndedAtMs = 0L
    private var transcriptFinalAtMs = 0L
    private var aiResponseReadyAtMs = 0L
    private var sessionEndingAtMs = 0L

    private var wakeToGreetingMs = -1L
    private var greetingToListenMs = -1L
    private var speechEndToTranscriptMs = -1L
    private var transcriptToAiResponseMs = -1L
    private var aiResponseToFirstAudioMs = -1L
    private var sessionEndToWakeMs = -1L

    fun getLatencyMetricsJson(): JSONObject = JSONObject()
        .put("wakeToGreetingMs", wakeToGreetingMs)
        .put("greetingToListenMs", greetingToListenMs)
        .put("speechEndToTranscriptMs", speechEndToTranscriptMs)
        .put("transcriptToAiResponseMs", transcriptToAiResponseMs)
        .put("aiResponseToFirstAudioMs", aiResponseToFirstAudioMs)
        .put("sessionEndToWakeMs", sessionEndToWakeMs)
        .put("updatedAt", System.currentTimeMillis())

    private fun emitLatencyMetrics() {
        AtlasWakeWordPlugin.emitVoiceLatencyMetrics(getLatencyMetricsJson())
    }

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
            nativeTurns.clear()
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
            wakeDetectedAtMs = SystemClock.elapsedRealtime()
            greetingCompletedAtMs = 0L
            speechEndedAtMs = 0L
            transcriptFinalAtMs = 0L
            aiResponseReadyAtMs = 0L
            sessionEndingAtMs = 0L

            transitionTo(State.WAKE_DETECTED, "Wake word \"$phrase\" detected (score=${"%.2f".format(score)})")
            transitionTo(State.SESSION_STARTING, "Handing off microphone from wake-word loop")

            serviceActions.pauseWakeWordForVoiceSession("Voice session $sessionId starting")

            // Deterministically wait until AudioRecord has closed and released WAKE_WORD ownership.
            AtlasAudioOwnershipCoordinator.awaitRelease(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD) {
                mainHandler.post {
                    if (currentSessionId == sessionId && state == State.SESSION_STARTING) {
                        if (speakGreeting) {
                            // Speak greeting immediately with zero chime delay
                            speakGreetingThenListen(sessionId)
                        } else {
                            playActivationCue {
                                if (currentSessionId == sessionId && state == State.SESSION_STARTING) {
                                    beginListeningTurn(isFollowUp = false)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private fun pickNativeGreeting(): String {
        val personality = secureStore.getPersonality()
        val playfulness = personality?.optInt("playfulness", 75) ?: 75
        val greetings = if (playfulness >= 65) {
            listOf("Hey! What's up?", "Yes? I'm listening!", "Hey there, what are we thinking?")
        } else {
            listOf("Hello, how can I help?", "Listening.")
        }
        return greetings[(SystemClock.elapsedRealtime() % greetings.size).toInt()]
    }

    private fun speakGreetingThenListen(sessionId: String) {
        val greeting = pickNativeGreeting()
        transitionTo(State.SPEAKING, greeting)
        ttsManager.speak(greeting, object : AtlasVoiceTtsManager.Listener {
            override fun onSpeakStarted() {
                if (wakeDetectedAtMs > 0L) {
                    wakeToGreetingMs = SystemClock.elapsedRealtime() - wakeDetectedAtMs
                    emitLatencyMetrics()
                }
            }

            override fun onSpeakCompleted() {
                if (currentSessionId == sessionId) {
                    greetingCompletedAtMs = SystemClock.elapsedRealtime()
                    beginListeningTurn(isFollowUp = false)
                }
            }

            override fun onSpeakError(message: String) {
                if (currentSessionId == sessionId) {
                    greetingCompletedAtMs = SystemClock.elapsedRealtime()
                    beginListeningTurn(isFollowUp = false)
                }
            }
        })
    }

    /** Tap-to-interrupt while Atlas is speaking TTS, transitioning directly into listening. */
    fun interruptSpeaking() {
        mainHandler.post {
            if (!isSessionActive()) return@post
            if (state == State.SPEAKING) {
                ttsManager.stop()
                pendingEndSession = false
                beginListeningTurn(isFollowUp = true)
            }
        }
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
        if (!isFollowUp && greetingCompletedAtMs > 0L) {
            greetingToListenMs = SystemClock.elapsedRealtime() - greetingCompletedAtMs
            emitLatencyMetrics()
        }
        speechEndedAtMs = 0L
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

                override fun onEndOfSpeech() {
                    if (currentSessionId != sessionId) return
                    speechEndedAtMs = SystemClock.elapsedRealtime()
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
                    transcriptFinalAtMs = SystemClock.elapsedRealtime()
                    if (speechEndedAtMs > 0L) {
                        speechEndToTranscriptMs = transcriptFinalAtMs - speechEndedAtMs
                        emitLatencyMetrics()
                    }
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
                        // Dismiss silently (like standard voice assistants) so ambient chatter doesn't cause a spoken error.
                        endSessionInternal(resumeWakeWord = true, reason = "No command heard")
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

        if (AtlasWakeWordPlugin.isAppForeground()) {
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
                    Log.w(TAG, "JS bridge reply timed out; using native handler")
                    resolveNativeTurnAsync(sessionId, turnId, transcript, isLocked)
                }
            }
            jsReplyTimeoutRunnable = timeout
            mainHandler.postDelayed(timeout, JS_REPLY_TIMEOUT_MS)
        } else {
            resolveNativeTurnAsync(sessionId, turnId, transcript, isLocked)
        }
    }

    private fun speakResponse(text: String) {
        val sessionId = currentSessionId ?: return
        val clean = text.trim()
        aiResponseReadyAtMs = SystemClock.elapsedRealtime()
        if (transcriptFinalAtMs > 0L) {
            transcriptToAiResponseMs = aiResponseReadyAtMs - transcriptFinalAtMs
            emitLatencyMetrics()
        }
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
            override fun onSpeakStarted() {
                if (aiResponseReadyAtMs > 0L) {
                    aiResponseToFirstAudioMs = SystemClock.elapsedRealtime() - aiResponseReadyAtMs
                    emitLatencyMetrics()
                }
            }

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
        sessionEndingAtMs = SystemClock.elapsedRealtime()
        transitionTo(State.SESSION_ENDING, reason)
        cancelTimers()
        speechManager.stop()
        ttsManager.stop()
        currentSessionId = null
        currentTurnId = null
        pendingEndSession = false
        nativeTurns.clear()

        if (resumeWakeWord && !serviceActions.isInPhoneCall()) {
            transitionTo(State.WAKE_LISTENING, "Resuming offline wake-word detection")
            serviceActions.resumeWakeWordFromVoiceSession()
            if (sessionEndingAtMs > 0L) {
                sessionEndToWakeMs = SystemClock.elapsedRealtime() - sessionEndingAtMs
                emitLatencyMetrics()
            }
        } else {
            transitionTo(State.IDLE, reason)
            emitLatencyMetrics()
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

    private fun recordNativeTurn(role: String, text: String) {
        nativeTurns.add(role to text)
        while (nativeTurns.size > 10) {
            nativeTurns.removeAt(0)
        }
    }

    private fun resolveNativeTurnAsync(sessionId: String, turnId: String, transcript: String, isLocked: Boolean) {
        recordNativeTurn("user", transcript)
        val quick = buildNativeFallbackReply(transcript, isLocked)
        if (quick != null) {
            recordNativeTurn("assistant", quick.first)
            pendingEndSession = quick.second
            speakResponse(quick.first)
            return
        }

        pendingEndSession = false
        speakResponse(if (isLocked) "Unlock your phone and open Atlas for more help." else "Open Atlas for an approved online question. Automatic cloud requests are disabled.")
    }

    private fun buildNativeFallbackReply(transcript: String, isLocked: Boolean): Pair<String, Boolean>? {
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

        // Social & basic queries
        if (lower == "hey atlas" || lower == "atlas" || lower == "hi" || lower == "hello" || lower == "hi atlas" || lower.contains("what's up")) {
            return "Hey! What's up?" to false
        }
        if (lower.contains("how are you") || lower.contains("how you doing")) {
            return "I'm doing great, thanks for asking! How can I help?" to false
        }
        if (lower.contains("who are you") || lower.contains("your name")) {
            return "I'm Atlas, your voice assistant for Life Atlas." to false
        }
        if (lower.contains("time")) {
            val now = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date())
            return "It's $now." to false
        }
        if (lower.contains("date") || lower.contains("day is it")) {
            val today = SimpleDateFormat("EEEE, MMMM d", Locale.getDefault()).format(Date())
            return "Today is $today." to false
        }

        // Media controls via Android system media keys
        if (lower.contains("pause music") || lower == "pause" || lower.contains("stop music")) {
            dispatchMediaKey(KeyEvent.KEYCODE_MEDIA_PAUSE)
            return "Paused music." to false
        }
        if (lower.contains("resume music") || lower == "resume" || lower.contains("play music")) {
            dispatchMediaKey(KeyEvent.KEYCODE_MEDIA_PLAY)
            return "Resuming playback." to false
        }
        if (lower.contains("next song") || lower.contains("next track") || lower == "skip") {
            dispatchMediaKey(KeyEvent.KEYCODE_MEDIA_NEXT)
            return "Skipping to the next track." to false
        }

        // Native reminder capture (synced into JS reminders on next app foreground)
        if (lower.startsWith("remind me to ") || lower.startsWith("remind me ") || lower.startsWith("set a reminder ")) {
            val title = transcript
                .replace(Regex("^(remind me to|remind me|set a reminder to|set a reminder)\\s+", RegexOption.IGNORE_CASE), "")
                .trim()
            if (title.isNotEmpty()) {
                savePendingNativeReminder(title)
                return "Got it. I saved a reminder: $title." to false
            }
        }

        // Opening Life Atlas routes when unlocked
        val routeRequest: Pair<String, String>? = when {
            lower.contains("open music") || lower.contains("music vault") -> "/secret/music" to "Music Vault"
            lower.contains("open trip") || lower.contains("trip vault") -> "/secret/vault" to "Trip Vault"
            lower.contains("open finance") || lower.contains("finance vault") -> "/secret/finance" to "Finance Vault"
            lower.contains("open life atlas") || lower.contains("open atlas") || lower.contains("open the app") || lower.contains("open app") ->
                "/secret/atlas" to "Life Atlas"
            else -> null
        }
        if (routeRequest != null) {
            if (isLocked) {
                return "Unlock your phone first so I can open ${routeRequest.second}." to true
            }
            val openedDirectly = tryOpenAppRoute(routeRequest.first, routeRequest.second)
            return if (openedDirectly) {
                "Opening ${routeRequest.second}." to true
            } else {
                "Sent notification to open ${routeRequest.second}. Allow Display over other apps in settings for direct launch." to true
            }
        }

        return null
    }

    private fun dispatchMediaKey(keyCode: Int) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        val now = SystemClock.uptimeMillis()
        runCatching {
            am.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0))
            am.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0))
        }
    }

    private fun savePendingNativeReminder(title: String) {
        val prefs = context.getSharedPreferences("atlas_voice_prefs", Context.MODE_PRIVATE)
        val existing = try {
            JSONArray(prefs.getString("pendingRemindersJson", "[]") ?: "[]")
        } catch (_: Exception) {
            JSONArray()
        }
        existing.put(
            JSONObject()
                .put("title", title.take(180))
                .put("createdAt", java.time.Instant.now().toString())
        )
        prefs.edit().putString("pendingRemindersJson", existing.toString()).apply()
    }

    private fun tryOpenAppRoute(route: String, label: String): Boolean {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_route", route)
        }
        val pi = PendingIntent.getActivity(
            context,
            route.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        nm?.notify(
            4105,
            NotificationCompat.Builder(context, "atlas_wakeword_alerts")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Open $label")
                .setContentText("Tap to open $label")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build()
        )
        val canLaunchFromBackground = AtlasWakeWordPlugin.isAppForeground() ||
            (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M || Settings.canDrawOverlays(context))
        if (!canLaunchFromBackground) {
            return false
        }
        return try {
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Background launch blocked by Android BAL for $route: ${e.message}")
            false
        }
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
