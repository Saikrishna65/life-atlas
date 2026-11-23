package com.lifeatlas.app.wakeword.activation

import org.junit.Assert.*
import org.junit.Test

class GoogleBridgeGateTest {
    @Test fun onlyFreshApprovedIdleEventsCanBeginDismissal() {
        val gate = GoogleBridgeGate()
        assertFalse(gate.candidate(1000, false, true, false))
        assertFalse(gate.candidate(1000, true, false, false))
        assertFalse(gate.candidate(1000, true, true, true))
        assertTrue(gate.candidate(1000, true, true, false))
        assertEquals(GoogleBridgeGate.Phase.DISMISSING, gate.phase)
        assertFalse(gate.candidate(1001, true, true, false))
    }
    @Test fun noLaunchWithoutTimelyObservedDismissal() {
        val gate = GoogleBridgeGate()
        assertFalse(gate.dismissed(1000))
        assertTrue(gate.candidate(1000, true, true, false))
        assertFalse(gate.dismissed(2501))
        gate.reset()
        assertFalse(gate.candidate(2501, true, true, false))
        assertTrue(gate.candidate(3000, true, true, false))
        assertTrue(gate.dismissed(3100))
        assertEquals(GoogleBridgeGate.Phase.OPENING, gate.phase)
        assertFalse(gate.dismissed(3101))
        gate.session()
        assertFalse(gate.candidate(6000, true, true, false))
        gate.reset()
        assertTrue(gate.candidate(6000, true, true, false))
    }
}
