package com.lifeatlas.app.wakeword.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AtlasAudioOwnershipCoordinatorTest {

    @Before
    fun reset() {
        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD)
        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER)
        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.TTS)
        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.EXTERNAL_APP)
    }

    @Test
    fun tryAcquire_enforcesSingleOwnerAtAnyTime() {
        assertTrue(AtlasAudioOwnershipCoordinator.tryAcquire(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD))
        assertFalse(AtlasAudioOwnershipCoordinator.tryAcquire(AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER))
        assertEquals(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD, AtlasAudioOwnershipCoordinator.currentOwner)

        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD)
        assertEquals(AtlasAudioOwnershipCoordinator.Owner.NONE, AtlasAudioOwnershipCoordinator.currentOwner)
        assertTrue(AtlasAudioOwnershipCoordinator.tryAcquire(AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER))
    }

    @Test
    fun awaitRelease_firesDeterministicallyWhenOwnerReleases() {
        assertTrue(AtlasAudioOwnershipCoordinator.tryAcquire(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD))
        var callbackFired = false
        AtlasAudioOwnershipCoordinator.awaitRelease(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD) {
            callbackFired = true
        }
        assertFalse(callbackFired)

        AtlasAudioOwnershipCoordinator.release(AtlasAudioOwnershipCoordinator.Owner.WAKE_WORD)
        assertTrue(callbackFired)
    }

    @Test
    fun forceExternalPreemption_overridesCurrentOwnerAndNotifiesWaiters() {
        assertTrue(AtlasAudioOwnershipCoordinator.tryAcquire(AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER))
        var notified = false
        AtlasAudioOwnershipCoordinator.awaitRelease(AtlasAudioOwnershipCoordinator.Owner.SPEECH_RECOGNIZER) {
            notified = true
        }

        AtlasAudioOwnershipCoordinator.forceExternalPreemption()
        assertEquals(AtlasAudioOwnershipCoordinator.Owner.EXTERNAL_APP, AtlasAudioOwnershipCoordinator.currentOwner)
        assertTrue(notified)
    }
}
