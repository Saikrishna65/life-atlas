package com.lifeatlas.app.wakeword

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.os.SystemClock
import java.io.File
import java.nio.FloatBuffer

data class WakeWordInferenceResult(
    val detected: Boolean,
    val score: Float,
    val inferenceLatencyMs: Double,
    val framesProcessed: Long
)

/**
 * Offline 3-stage openWakeWord ONNX Runtime engine:
 *   1) melspectrogram.onnx ([1, N] -> [1, 1, F, 32], scaled via x/10 + 2)
 *   2) embedding_model.onnx ([1, 76, 32, 1] -> [1, 1, 1, 96])
 *   3) <wakeword>.onnx ([1, T, 96] -> [1, 1] probability)
 */
class OpenWakeWordEngine(
    context: Context,
    val modelInfo: WakeWordModelInfo
) : AutoCloseable {

    private val env: OrtEnvironment = OrtEnvironment.getEnvironment()
    private val melSession: OrtSession
    private val embeddingSession: OrtSession
    private val classifierSession: OrtSession

    private val melInputName: String
    private val embeddingInputName: String
    private val classifierInputName: String

    private val buffers = OpenWakeWordFeatureBuffers(modelInfo.requiredEmbeddingFrames)
    private var lastDetectionElapsedMs: Long = 0L

    init {
        val opts = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(1)
            setInterOpNumThreads(1)
        }
        val melBytes = context.assets.open(WakeWordModelManager.MEL_ASSET).use { it.readBytes() }
        val embBytes = context.assets.open(WakeWordModelManager.EMBEDDING_ASSET).use { it.readBytes() }
        val clsBytes = if (modelInfo.isAsset) {
            context.assets.open(modelInfo.modelPathOrAsset).use { it.readBytes() }
        } else {
            File(modelInfo.modelPathOrAsset).readBytes()
        }

        melSession = env.createSession(melBytes, opts)
        embeddingSession = env.createSession(embBytes, opts)
        classifierSession = env.createSession(clsBytes, opts)

        melInputName = melSession.inputNames.first()
        embeddingInputName = embeddingSession.inputNames.firstOrNull { it == "input_1" }
            ?: embeddingSession.inputNames.first()
        classifierInputName = classifierSession.inputNames.first()
    }

    fun reset() {
        buffers.reset()
        lastDetectionElapsedMs = 0L
    }

    fun processAudio(samples: ShortArray, length: Int): WakeWordInferenceResult? {
        val audioWindows = buffers.pushAudio(samples, length)
        if (audioWindows.isEmpty()) return null

        val startNs = SystemClock.elapsedRealtimeNanos()
        var bestScore = 0.0f
        var detected = false
        var chunksEvaluated = 0L

        for (audioWindow in audioWindows) {
            val melFlatAndFrames = runMelSpectrogram(audioWindow)
            val melWindows = buffers.pushMelFramesAndTakeWindows(
                melFlatAndFrames.first,
                melFlatAndFrames.second
            )
            for (melWindow in melWindows) {
                val embedding96 = runEmbedding(melWindow)
                val clsInput = buffers.pushEmbeddingAndGetClassifierInput(embedding96)
                if (clsInput != null) {
                    val score = runClassifier(clsInput)
                    if (score > bestScore) bestScore = score
                    chunksEvaluated++
                    val nowMs = SystemClock.elapsedRealtime()
                    if (score >= modelInfo.threshold &&
                        (nowMs - lastDetectionElapsedMs) >= modelInfo.cooldownMs
                    ) {
                        lastDetectionElapsedMs = nowMs
                        detected = true
                    }
                }
            }
        }

        val elapsedMs = (SystemClock.elapsedRealtimeNanos() - startNs) / 1_000_000.0
        return WakeWordInferenceResult(
            detected = detected,
            score = bestScore,
            inferenceLatencyMs = elapsedMs,
            framesProcessed = chunksEvaluated.coerceAtLeast(audioWindows.size.toLong())
        )
    }

    private fun runMelSpectrogram(audioSamples: FloatArray): Pair<FloatArray, Int> {
        val tensor = OnnxTensor.createTensor(
            env,
            FloatBuffer.wrap(audioSamples),
            longArrayOf(1L, audioSamples.size.toLong())
        )
        tensor.use {
            melSession.run(mapOf(melInputName to tensor)).use { results ->
                val outTensor = results[0] as OnnxTensor
                val buf = outTensor.floatBuffer
                val totalFloats = buf.remaining()
                val arr = FloatArray(totalFloats)
                buf.get(arr)
                val frameCount = totalFloats / OpenWakeWordFeatureBuffers.MEL_BINS
                return Pair(arr, frameCount)
            }
        }
    }

    private fun runEmbedding(melWindow76x32: FloatArray): FloatArray {
        val tensor = OnnxTensor.createTensor(
            env,
            FloatBuffer.wrap(melWindow76x32),
            longArrayOf(
                1L,
                OpenWakeWordFeatureBuffers.MEL_WINDOW_FRAMES.toLong(),
                OpenWakeWordFeatureBuffers.MEL_BINS.toLong(),
                1L
            )
        )
        tensor.use {
            embeddingSession.run(mapOf(embeddingInputName to tensor)).use { results ->
                val outTensor = results[0] as OnnxTensor
                val buf = outTensor.floatBuffer
                val arr = FloatArray(OpenWakeWordFeatureBuffers.EMBEDDING_DIM)
                val take = minOf(arr.size, buf.remaining())
                buf.get(arr, 0, take)
                return arr
            }
        }
    }

    private fun runClassifier(embeddingWindow: FloatArray): Float {
        val tensor = OnnxTensor.createTensor(
            env,
            FloatBuffer.wrap(embeddingWindow),
            longArrayOf(
                1L,
                modelInfo.requiredEmbeddingFrames.toLong(),
                OpenWakeWordFeatureBuffers.EMBEDDING_DIM.toLong()
            )
        )
        tensor.use {
            classifierSession.run(mapOf(classifierInputName to tensor)).use { results ->
                val outTensor = results[0] as OnnxTensor
                val buf = outTensor.floatBuffer
                return if (buf.hasRemaining()) buf.get() else 0.0f
            }
        }
    }

    override fun close() {
        runCatching { classifierSession.close() }
        runCatching { embeddingSession.close() }
        runCatching { melSession.close() }
    }
}
