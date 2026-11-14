package com.lifeatlas.app.wakeword

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OpenWakeWordFeatureBuffersTest {

    @Test
    fun pushAudio_accumulates1280StepAndIncludes480OverlapOnSubsequentChunks() {
        val buffers = OpenWakeWordFeatureBuffers(requiredEmbeddingFrames = 16)

        // Less than 1280 samples should buffer cleanly without emitting a window.
        val partial = ShortArray(600) { (it + 1).toShort() }
        assertTrue(buffers.pushAudio(partial).isEmpty())

        // Pushing 680 more completes the first 1280-sample chunk.
        val rest = ShortArray(680) { (601 + it).toShort() }
        val firstWindows = buffers.pushAudio(rest)
        assertEquals(1, firstWindows.size)
        assertEquals(OpenWakeWordFeatureBuffers.STEP_SAMPLES, firstWindows[0].size)
        assertEquals(1.0f, firstWindows[0][0], 0.0001f)
        assertEquals(1280.0f, firstWindows[0][1279], 0.0001f)

        // Second 1280-sample push must include 480 overlap samples + 1280 new samples = 1760.
        val second = ShortArray(1280) { (2000 + it).toShort() }
        val secondWindows = buffers.pushAudio(second)
        assertEquals(1, secondWindows.size)
        assertEquals(
            OpenWakeWordFeatureBuffers.STEP_SAMPLES + OpenWakeWordFeatureBuffers.MEL_OVERLAP_SAMPLES,
            secondWindows[0].size
        )
        // First 480 samples come from tail of first chunk (samples 801..1280).
        assertEquals(801.0f, secondWindows[0][0], 0.0001f)
        assertEquals(1280.0f, secondWindows[0][479], 0.0001f)
        assertEquals(2000.0f, secondWindows[0][480], 0.0001f)
        assertEquals(3279.0f, secondWindows[0][1759], 0.0001f)
    }

    @Test
    fun pushAudio_boundedRingWrapsCleanlyWithoutGrowing() {
        val buffers = OpenWakeWordFeatureBuffers()
        // Push more than RAW_BUFFER_MAX_SAMPLES (32000 samples = 25 chunks of 1280)
        repeat(30) { chunkIdx ->
            val samples = ShortArray(OpenWakeWordFeatureBuffers.STEP_SAMPLES) { (chunkIdx + 1).toShort() }
            val out = buffers.pushAudio(samples)
            assertEquals(1, out.size)
            if (chunkIdx > 0) {
                assertEquals(1760, out[0].size)
                assertEquals(chunkIdx.toFloat(), out[0][0], 0.0001f)
                assertEquals((chunkIdx + 1).toFloat(), out[0][1759], 0.0001f)
            }
        }
    }

    @Test
    fun pushMelFrames_appliesOpenWakeWordScalingAndReturns76x32Window() {
        val buffers = OpenWakeWordFeatureBuffers()
        val melFrames = FloatArray(8 * OpenWakeWordFeatureBuffers.MEL_BINS) { 10.0f }
        val windows = buffers.pushMelFramesAndTakeWindows(melFrames, 8)
        assertEquals(1, windows.size)
        val window = windows[0]
        assertEquals(OpenWakeWordFeatureBuffers.MEL_WINDOW_FRAMES * OpenWakeWordFeatureBuffers.MEL_BINS, window.size)

        // Seeded startup frames have value 1.0f; newest 8 frames have 10/10 + 2 = 3.0f.
        assertEquals(1.0f, window[0], 0.0001f)
        assertEquals(3.0f, window[window.size - 1], 0.0001f)
    }

    @Test
    fun pushEmbedding_gatesWarmupUntil16FramesAndSlidesFifo() {
        val buffers = OpenWakeWordFeatureBuffers(requiredEmbeddingFrames = 16)
        for (i in 1..15) {
            val emb = FloatArray(OpenWakeWordFeatureBuffers.EMBEDDING_DIM) { i.toFloat() }
            assertNull("Expected warmup null at frame $i", buffers.pushEmbeddingAndGetClassifierInput(emb))
        }

        val frame16 = FloatArray(OpenWakeWordFeatureBuffers.EMBEDDING_DIM) { 16.0f }
        val classifierInput16 = buffers.pushEmbeddingAndGetClassifierInput(frame16)
        assertNotNull(classifierInput16)
        assertEquals(16 * 96, classifierInput16!!.size)
        assertEquals(1.0f, classifierInput16[0], 0.0001f)
        assertEquals(16.0f, classifierInput16[classifierInput16.size - 1], 0.0001f)

        val frame17 = FloatArray(OpenWakeWordFeatureBuffers.EMBEDDING_DIM) { 17.0f }
        val classifierInput17 = buffers.pushEmbeddingAndGetClassifierInput(frame17)
        assertNotNull(classifierInput17)
        // Frame 1 evicted, Frame 2 is now first, Frame 17 is last.
        assertEquals(2.0f, classifierInput17!![0], 0.0001f)
        assertEquals(17.0f, classifierInput17[classifierInput17.size - 1], 0.0001f)
    }

    @Test
    fun reset_clearsHistoryAndRestartsWarmup() {
        val buffers = OpenWakeWordFeatureBuffers(requiredEmbeddingFrames = 4)
        repeat(4) { idx ->
            buffers.pushEmbeddingAndGetClassifierInput(FloatArray(96) { (idx + 1).toFloat() })
        }
        assertEquals(4L, buffers.embeddingsProduced)

        buffers.reset()
        assertEquals(0L, buffers.embeddingsProduced)
        assertNull(buffers.pushEmbeddingAndGetClassifierInput(FloatArray(96) { 9.0f }))
    }
}
