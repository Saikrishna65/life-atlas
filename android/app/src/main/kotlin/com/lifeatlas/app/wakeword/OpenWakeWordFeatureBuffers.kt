package com.lifeatlas.app.wakeword

/**
 * Pure Kotlin bounded buffers for the 3-stage openWakeWord streaming pipeline.
 * Keeps audio, mel-spectrogram, and speech-embedding history strictly bounded in RAM.
 */
class OpenWakeWordFeatureBuffers(
    val requiredEmbeddingFrames: Int = 16
) {
    companion object {
        const val SAMPLE_RATE_HZ = 16000
        const val STEP_SAMPLES = 1280 // 80 ms at 16 kHz
        const val MEL_OVERLAP_SAMPLES = 480 // 3 * 160 samples
        const val RAW_BUFFER_MAX_SAMPLES = SAMPLE_RATE_HZ * 2 // 2s bounded ring
        const val MEL_WINDOW_FRAMES = 76
        const val MEL_STEP_FRAMES = 8
        const val MEL_BINS = 32
        const val MEL_BUFFER_MAX_FRAMES = 160
        const val EMBEDDING_DIM = 96
    }

    private val rawPcmRing = ShortArray(RAW_BUFFER_MAX_SAMPLES)
    private var rawCount = 0
    private var rawWritePos = 0

    private val remainder = ShortArray(STEP_SAMPLES)
    private var remainderLen = 0

    private val melRows = ArrayDeque<FloatArray>(MEL_BUFFER_MAX_FRAMES)
    private val embeddingRows = ArrayDeque<FloatArray>(requiredEmbeddingFrames)

    var embeddingsProduced: Long = 0L
        private set

    init {
        reset()
    }

    fun reset() {
        rawPcmRing.fill(0)
        // Pre-seed 480 overlap samples of silence so even the first 1280-sample chunk
        // feeds an exact 1760-sample window (exact 8 mel frames per 80 ms step).
        rawCount = MEL_OVERLAP_SAMPLES
        rawWritePos = MEL_OVERLAP_SAMPLES
        remainder.fill(0)
        remainderLen = 0
        melRows.clear()
        // Seed initial 76 frames with 1.0f matching openWakeWord reference startup.
        repeat(MEL_WINDOW_FRAMES) {
            melRows.addLast(FloatArray(MEL_BINS) { 1.0f })
        }
        embeddingRows.clear()
        embeddingsProduced = 0L
    }

    /**
     * Appends incoming 16 kHz PCM samples and returns one or more 1760-sample windows
     * (1280 new samples + 480-sample overlap context) ready for melspectrogram inference.
     */
    fun pushAudio(samples: ShortArray, length: Int = samples.size): List<FloatArray> {
        if (length <= 0) return emptyList()
        val windows = mutableListOf<FloatArray>()
        var offset = 0
        while (offset < length) {
            val needed = STEP_SAMPLES - remainderLen
            val take = minOf(needed, length - offset)
            System.arraycopy(samples, offset, remainder, remainderLen, take)
            remainderLen += take
            offset += take

            if (remainderLen == STEP_SAMPLES) {
                for (i in 0 until STEP_SAMPLES) {
                    rawPcmRing[rawWritePos] = remainder[i]
                    rawWritePos = (rawWritePos + 1) % RAW_BUFFER_MAX_SAMPLES
                    if (rawCount < RAW_BUFFER_MAX_SAMPLES) rawCount++
                }
                remainderLen = 0

                val contextLen = minOf(rawCount, STEP_SAMPLES + MEL_OVERLAP_SAMPLES)
                val out = FloatArray(contextLen)
                var readPos = (rawWritePos - contextLen + RAW_BUFFER_MAX_SAMPLES) % RAW_BUFFER_MAX_SAMPLES
                for (i in 0 until contextLen) {
                    out[i] = rawPcmRing[readPos].toFloat()
                    readPos = (readPos + 1) % RAW_BUFFER_MAX_SAMPLES
                }
                windows.add(out)
            }
        }
        return windows
    }

    /**
     * Appends mel-spectrogram frames (applying openWakeWord `x / 10 + 2` scaling)
     * and returns flattened [76, 32] windows ready for the speech-embedding model.
     */
    fun pushMelFramesAndTakeWindows(flatMel: FloatArray, frameCount: Int): List<FloatArray> {
        if (frameCount <= 0 || flatMel.size < frameCount * MEL_BINS) return emptyList()
        for (f in 0 until frameCount) {
            val row = FloatArray(MEL_BINS)
            val base = f * MEL_BINS
            for (b in 0 until MEL_BINS) {
                row[b] = flatMel[base + b] / 10.0f + 2.0f
            }
            if (melRows.size >= MEL_BUFFER_MAX_FRAMES) {
                melRows.removeFirst()
            }
            melRows.addLast(row)
        }

        // Emit one 76x32 embedding window corresponding to the latest frame block.
        if (melRows.size < MEL_WINDOW_FRAMES) return emptyList()
        val window = FloatArray(MEL_WINDOW_FRAMES * MEL_BINS)
        val startIdx = melRows.size - MEL_WINDOW_FRAMES
        var idx = 0
        for (r in 0 until MEL_WINDOW_FRAMES) {
            val row = melRows[startIdx + r]
            System.arraycopy(row, 0, window, idx, MEL_BINS)
            idx += MEL_BINS
        }
        return listOf(window)
    }

    /**
     * Pushes a 96-dim embedding vector and returns a flattened [requiredEmbeddingFrames * 96]
     * tensor input once the warm-up window is full.
     */
    fun pushEmbeddingAndGetClassifierInput(embedding96: FloatArray): FloatArray? {
        if (embedding96.size != EMBEDDING_DIM) return null
        if (embeddingRows.size >= requiredEmbeddingFrames) {
            embeddingRows.removeFirst()
        }
        embeddingRows.addLast(embedding96.copyOf())
        embeddingsProduced++

        if (embeddingRows.size < requiredEmbeddingFrames) {
            return null
        }
        val flat = FloatArray(requiredEmbeddingFrames * EMBEDDING_DIM)
        var offset = 0
        for (row in embeddingRows) {
            System.arraycopy(row, 0, flat, offset, EMBEDDING_DIM)
            offset += EMBEDDING_DIM
        }
        return flat
    }
}
