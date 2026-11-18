package com.lifeatlas.app.wakeword.voice

import android.util.Log
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Deterministic single-owner audio/microphone ownership coordinator.
 *
 * Guarantees that the wake-word AudioRecord capture loop, Android SpeechRecognizer,
 * Atlas TextToSpeech playback, and external competing mic apps never own the
 * microphone at the same time.
 */
object AtlasAudioOwnershipCoordinator {
    private const val TAG = "AtlasAudioOwnership"

    enum class Owner {
        NONE,
        WAKE_WORD,
        SPEECH_RECOGNIZER,
        TTS,
        EXTERNAL_APP
    }

    private val lock = Any()

    @Volatile
    var currentOwner: Owner = Owner.NONE
        private set

    private val releaseWaiters = CopyOnWriteArrayList<Pair<Owner, () -> Unit>>()

    private fun logInfo(msg: String) {
        try {
            Log.i(TAG, msg)
        } catch (_: RuntimeException) {
            // Ignored in JVM unit tests where android.util.Log is unmocked.
        }
    }

    private fun logWarn(msg: String) {
        try {
            Log.w(TAG, msg)
        } catch (_: RuntimeException) {
            // Ignored in JVM unit tests where android.util.Log is unmocked.
        }
    }

    fun tryAcquire(requested: Owner): Boolean {
        synchronized(lock) {
            if (currentOwner == requested) return true
            if (currentOwner == Owner.NONE) {
                currentOwner = requested
                logInfo("Audio ownership acquired by $requested")
                return true
            }
            logWarn("Audio ownership denied for $requested; currently held by $currentOwner")
            return false
        }
    }

    fun release(owner: Owner) {
        val toNotify = mutableListOf<() -> Unit>()
        synchronized(lock) {
            if (currentOwner == owner || (owner == Owner.WAKE_WORD && currentOwner == Owner.NONE)) {
                if (currentOwner != Owner.NONE) {
                    logInfo("Audio ownership released by $owner")
                }
                currentOwner = Owner.NONE
                val remaining = mutableListOf<Pair<Owner, () -> Unit>>()
                for (entry in releaseWaiters) {
                    if (entry.first == owner) {
                        toNotify.add(entry.second)
                    } else {
                        remaining.add(entry)
                    }
                }
                releaseWaiters.clear()
                releaseWaiters.addAll(remaining)
            }
        }
        toNotify.forEach { callback ->
            runCatching { callback() }.onFailure { logWarn("Release waiter failed: ${it.message}") }
        }
    }

    fun forceExternalPreemption() {
        val toNotify = mutableListOf<() -> Unit>()
        synchronized(lock) {
            val prev = currentOwner
            currentOwner = Owner.EXTERNAL_APP
            logInfo("Audio ownership pre-empted by EXTERNAL_APP (was $prev)")
            for (entry in releaseWaiters) {
                toNotify.add(entry.second)
            }
            releaseWaiters.clear()
        }
        toNotify.forEach { callback ->
            runCatching { callback() }
        }
    }

    /**
     * Runs [onReleased] immediately if [awaitedOwner] does not hold ownership,
     * or as soon as [awaitedOwner] calls [release].
     */
    fun awaitRelease(awaitedOwner: Owner, onReleased: () -> Unit) {
        val alreadyReleased = synchronized(lock) {
            if (currentOwner != awaitedOwner) {
                true
            } else {
                releaseWaiters.add(awaitedOwner to onReleased)
                false
            }
        }
        if (alreadyReleased) {
            onReleased()
        }
    }
}
