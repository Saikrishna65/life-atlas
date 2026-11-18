package com.lifeatlas.app.wakeword.voice

import org.junit.Assert.assertTrue
import org.junit.Test

class AtlasVoicePolicyTest {

    @Test
    fun buildPersonalityPrompt_defaultsAndRespectsTraits() {
        val defaultPrompt = AtlasVoiceCoordinator.buildPersonalityPrompt(null)
        assertTrue(defaultPrompt.contains("Atlas"))

        val customPrompt = AtlasVoiceCoordinator.buildPersonalityPrompt(
            humor = 9,
            playfulness = 8,
            sweetness = 7,
            directness = 6,
            teasing = 5,
            responseLength = "brief"
        )
        assertTrue(customPrompt.contains("ultra concise"))
        assertTrue(customPrompt.contains("humor=9/10"))
        assertTrue(customPrompt.contains("never joke during serious/safety situations"))
    }
}
