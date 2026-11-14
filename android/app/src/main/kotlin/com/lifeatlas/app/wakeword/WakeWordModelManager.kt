package com.lifeatlas.app.wakeword

import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import android.content.Context
import android.net.Uri
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest

data class WakeWordModelInfo(
    val modelId: String,
    val displayName: String,
    val targetPhrase: String,
    val isCustomHeyAtlasModel: Boolean,
    val sourceType: String, // "imported_custom" | "bundled_custom" | "bundled_test"
    val modelPathOrAsset: String,
    val isAsset: Boolean,
    val sha256: String,
    val threshold: Float,
    val cooldownMs: Long,
    val requiredEmbeddingFrames: Int,
    val licenseNote: String
) {
    fun toJson(): JSONObject = JSONObject()
        .put("modelId", modelId)
        .put("displayName", displayName)
        .put("targetPhrase", targetPhrase)
        .put("isCustomHeyAtlasModel", isCustomHeyAtlasModel)
        .put("sourceType", sourceType)
        .put("modelPathOrAsset", modelPathOrAsset)
        .put("isAsset", isAsset)
        .put("sha256", sha256)
        .put("threshold", threshold.toDouble())
        .put("cooldownMs", cooldownMs)
        .put("requiredEmbeddingFrames", requiredEmbeddingFrames)
        .put("licenseNote", licenseNote)
}

object WakeWordModelManager {
    private const val DIR_NAME = "wakeword"
    private const val CUSTOM_MODEL_FILE = "custom_hey_atlas.onnx"
    private const val CUSTOM_META_FILE = "custom_model.json"
    private const val BUNDLED_CUSTOM_ASSET = "wakeword/hey_atlas.onnx"
    private const val BUNDLED_TEST_ASSET = "wakeword/hey_jarvis_v0.1.onnx"
    const val MEL_ASSET = "wakeword/melspectrogram.onnx"
    const val EMBEDDING_ASSET = "wakeword/embedding_model.onnx"
    private const val MAX_CUSTOM_MODEL_BYTES = 32L * 1024L * 1024L

    private fun storageDir(context: Context): File {
        val dir = File(context.noBackupFilesDir, DIR_NAME)
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    fun getActiveModel(context: Context): WakeWordModelInfo {
        val dir = storageDir(context)
        val customFile = File(dir, CUSTOM_MODEL_FILE)
        val customMetaFile = File(dir, CUSTOM_META_FILE)
        if (customFile.isFile && customFile.length() > 0 && customMetaFile.isFile) {
            try {
                val meta = JSONObject(customMetaFile.readText())
                return WakeWordModelInfo(
                    modelId = meta.optString("modelId", "custom_hey_atlas"),
                    displayName = meta.optString("displayName", "Custom Hey Atlas (.onnx)"),
                    targetPhrase = meta.optString("targetPhrase", "Hey Atlas"),
                    isCustomHeyAtlasModel = true,
                    sourceType = "imported_custom",
                    modelPathOrAsset = customFile.absolutePath,
                    isAsset = false,
                    sha256 = meta.optString("sha256", sha256File(customFile)),
                    threshold = meta.optDouble("threshold", 0.5).toFloat().coerceIn(0.1f, 0.95f),
                    cooldownMs = meta.optLong("cooldownMs", 1500L),
                    requiredEmbeddingFrames = meta.optInt("requiredEmbeddingFrames", 16).coerceIn(1, 64),
                    licenseNote = "User-imported custom ONNX model"
                )
            } catch (_: Exception) {
                // Fall through if metadata was corrupted.
            }
        }

        if (assetExists(context, BUNDLED_CUSTOM_ASSET)) {
            val bytes = context.assets.open(BUNDLED_CUSTOM_ASSET).use { it.readBytes() }
            return WakeWordModelInfo(
                modelId = "hey_atlas_bundled",
                displayName = "Hey Atlas (Bundled Custom ONNX)",
                targetPhrase = "Hey Atlas",
                isCustomHeyAtlasModel = true,
                sourceType = "bundled_custom",
                modelPathOrAsset = BUNDLED_CUSTOM_ASSET,
                isAsset = true,
                sha256 = sha256Bytes(bytes),
                threshold = 0.5f,
                cooldownMs = 1500L,
                requiredEmbeddingFrames = inspectEmbeddingFrames(bytes),
                licenseNote = "Bundled custom Hey Atlas model"
            )
        }

        val testBytes = context.assets.open(BUNDLED_TEST_ASSET).use { it.readBytes() }
        return WakeWordModelInfo(
            modelId = "hey_jarvis_v0.1",
            displayName = "Hey Jarvis v0.1 (Pipeline Test Model)",
            targetPhrase = "Hey Jarvis",
            isCustomHeyAtlasModel = false,
            sourceType = "bundled_test",
            modelPathOrAsset = BUNDLED_TEST_ASSET,
            isAsset = true,
            sha256 = sha256Bytes(testBytes),
            threshold = 0.5f,
            cooldownMs = 1500L,
            requiredEmbeddingFrames = 16,
            licenseNote = "openWakeWord v0.5.1 test model (CC BY-NC-SA 4.0) — NOT trained for 'Hey Atlas'"
        )
    }

    fun importCustomModelFromUri(
        context: Context,
        uri: Uri,
        displayName: String,
        threshold: Float = 0.5f
    ): WakeWordModelInfo {
        val dir = storageDir(context)
        val tempFile = File.createTempFile("import-", ".onnx.part", dir)
        val destFile = File(dir, CUSTOM_MODEL_FILE)
        val metaFile = File(dir, CUSTOM_META_FILE)
        try {
            var total = 0L
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(tempFile).use { output ->
                    val buffer = ByteArray(16384)
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        total += read
                        if (total > MAX_CUSTOM_MODEL_BYTES) {
                            throw IllegalArgumentException("Model file exceeds 32 MB limit.")
                        }
                        output.write(buffer, 0, read)
                    }
                    output.fd.sync()
                }
            } ?: throw IllegalArgumentException("Could not open selected model file.")

            if (total == 0L) {
                throw IllegalArgumentException("Selected model file is empty.")
            }

            val modelBytes = tempFile.readBytes()
            val frames = inspectEmbeddingFrames(modelBytes)
            val hash = sha256Bytes(modelBytes)
            if (destFile.exists()) destFile.delete()
            if (!tempFile.renameTo(destFile)) {
                throw IllegalStateException("Could not store imported model.")
            }

            val sanitizedName = displayName.ifBlank { "Custom Hey Atlas (.onnx)" }.take(80)
            val meta = JSONObject()
                .put("modelId", "custom_hey_atlas")
                .put("displayName", sanitizedName)
                .put("targetPhrase", "Hey Atlas")
                .put("sha256", hash)
                .put("threshold", threshold.coerceIn(0.1f, 0.95f).toDouble())
                .put("cooldownMs", 1500L)
                .put("requiredEmbeddingFrames", frames)
            metaFile.writeText(meta.toString())
            return getActiveModel(context)
        } finally {
            if (tempFile.exists()) tempFile.delete()
        }
    }

    fun resetToTestModel(context: Context): WakeWordModelInfo {
        val dir = storageDir(context)
        File(dir, CUSTOM_MODEL_FILE).delete()
        File(dir, CUSTOM_META_FILE).delete()
        return getActiveModel(context)
    }

    fun inspectEmbeddingFrames(modelBytes: ByteArray): Int {
        val env = OrtEnvironment.getEnvironment()
        var session: OrtSession? = null
        try {
            session = env.createSession(modelBytes)
            val inputName = session.inputNames.firstOrNull()
                ?: throw IllegalArgumentException("ONNX model has no inputs.")
            val info = session.inputInfo[inputName]?.info as? TensorInfo
                ?: throw IllegalArgumentException("ONNX model input must be a float tensor.")
            val shape = info.shape
            // Expected openWakeWord classifier input: [batch, timeFrames(16), 96]
            if (shape.size != 3 || shape[2] != 96L) {
                throw IllegalArgumentException(
                    "Incompatible ONNX wake-word shape ${shape.contentToString()}; expected [batch, frames, 96]."
                )
            }
            val frames = if (shape[1] > 0) shape[1].toInt() else 16
            if (frames < 1 || frames > 64) {
                throw IllegalArgumentException("Unsupported embedding window length: $frames")
            }
            return frames
        } finally {
            session?.close()
        }
    }

    private fun assetExists(context: Context, path: String): Boolean {
        return try {
            context.assets.open(path).close()
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun sha256File(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buf = ByteArray(16384)
            while (true) {
                val n = input.read(buf)
                if (n == -1) break
                digest.update(buf, 0, n)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun sha256Bytes(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(bytes).joinToString("") { "%02x".format(it) }
    }
}
