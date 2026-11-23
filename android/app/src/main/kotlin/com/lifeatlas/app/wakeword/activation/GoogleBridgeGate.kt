package com.lifeatlas.app.wakeword.activation

/** Pure transition policy. No screen text, audio, Android APIs or wall-clock timestamps. */
class GoogleBridgeGate {
    enum class Phase { IDLE, DISMISSING, OPENING, SESSION }
    var phase = Phase.IDLE
        private set
    private var lastTrigger = Long.MIN_VALUE
    private var deadline = 0L
    fun candidate(now: Long, fresh: Boolean, approved: Boolean, busy: Boolean): Boolean {
        if (!fresh || !approved || busy || phase != Phase.IDLE) return false
        if (lastTrigger != Long.MIN_VALUE && now - lastTrigger < 2000L) return false
        lastTrigger = now
        deadline = now + 1500L
        phase = Phase.DISMISSING
        return true
    }
    fun dismissed(now: Long): Boolean {
        if (phase != Phase.DISMISSING || now > deadline) return false
        phase = Phase.OPENING
        return true
    }
    fun session() { phase = Phase.SESSION }
    fun reset() { phase = Phase.IDLE }
}
