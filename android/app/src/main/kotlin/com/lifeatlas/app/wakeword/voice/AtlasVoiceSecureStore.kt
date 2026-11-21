package com.lifeatlas.app.wakeword.voice

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Android Keystore AES-256-GCM encrypted at-rest storage for Atlas voice secrets
 * (Cloud AI API keys) and encrypted voice memories/preferences.
 *
 * Never stores secrets in SharedPreferences, WebView localStorage, logs, or diagnostics.
 */
class AtlasVoiceSecureStore(context: Context) {

    companion object {
        private const val ALIAS = "life-atlas-voice-secret-v1"
        private const val FILE_NAME = "voice_secure_state.bin"
        private val LOCK = Any()
    }

    private val dir = File(context.noBackupFilesDir, "wakeword").apply {
        if (!exists()) mkdirs()
    }
    private val atomicFile = AtomicFile(File(dir, FILE_NAME))

    private fun getOrCreateKey(createIfMissing: Boolean): SecretKey? {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (ks.containsAlias(ALIAS)) {
            return ks.getKey(ALIAS, null) as? SecretKey
        }
        if (!createIfMissing) return null
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private fun readLocked(): JSONObject {
        val base = atomicFile.baseFile
        if (!base.exists()) return JSONObject().put("version", 1)
        return try {
            val key = getOrCreateKey(createIfMissing = false) ?: return JSONObject().put("version", 1)
            atomicFile.openRead().use { input ->
                val iv = ByteArray(12)
                if (input.read(iv) != 12) return JSONObject().put("version", 1)
                val encrypted = input.readBytes()
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
                val plain = cipher.doFinal(encrypted)
                try {
                    JSONObject(String(plain, StandardCharsets.UTF_8))
                } finally {
                    plain.fill(0)
                }
            }
        } catch (_: Exception) {
            JSONObject().put("version", 1)
        }
    }

    private fun writeLocked(obj: JSONObject) {
        val key = getOrCreateKey(createIfMissing = true)
            ?: throw IllegalStateException("AndroidKeyStore key unavailable.")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val plain = obj.toString().toByteArray(StandardCharsets.UTF_8)
        var stream: java.io.FileOutputStream? = null
        try {
            val encrypted = cipher.doFinal(plain)
            stream = atomicFile.startWrite()
            stream.write(cipher.getIV())
            stream.write(encrypted)
            atomicFile.finishWrite(stream)
        } catch (e: Exception) {
            if (stream != null) atomicFile.failWrite(stream)
            throw e
        } finally {
            plain.fill(0)
        }
    }

    fun saveCloudConfig(consent: Boolean, provider: String, apiKey: String?) {
        synchronized(LOCK) {
            val obj = readLocked()
            obj.put("cloudConsent", consent)
            obj.put("cloudProvider", if (provider == "openai") "openai" else "gemini")
            if (apiKey != null) {
                val trimmed = apiKey.trim()
                if (trimmed.isEmpty()) {
                    obj.remove("cloudApiKey")
                } else {
                    obj.put("cloudApiKey", trimmed)
                }
            }
            writeLocked(obj)
        }
    }

    fun clearCloudApiKey() {
        synchronized(LOCK) {
            val obj = readLocked()
            obj.remove("cloudApiKey")
            writeLocked(obj)
        }
    }

    fun getPublicStatus(): JSONObject {
        synchronized(LOCK) {
            val obj = readLocked()
            return JSONObject()
                .put("cloudConsent", obj.optBoolean("cloudConsent", false))
                .put("cloudProvider", obj.optString("cloudProvider", "gemini"))
                .put("hasCloudApiKey", obj.optString("cloudApiKey", "").isNotBlank())
        }
    }

    /** Native-only credential read; never expose return value across Capacitor/WebView/logs. */
    internal fun getCloudCredentialsInternal(): Triple<Boolean, String, String> {
        synchronized(LOCK) {
            val obj = readLocked()
            return Triple(
                obj.optBoolean("cloudConsent", false),
                obj.optString("cloudProvider", "gemini"),
                obj.optString("cloudApiKey", "")
            )
        }
    }

    fun saveEncryptedMemories(memories: JSONArray) {
        synchronized(LOCK) {
            val obj = readLocked()
            // Cap at 60 memories to prevent unbounded storage growth
            val bounded = JSONArray()
            val max = memories.length().coerceAtMost(60)
            for (i in 0 until max) {
                bounded.put(memories.get(i))
            }
            obj.put("memories", bounded)
            writeLocked(obj)
        }
    }

    fun getEncryptedMemories(): JSONArray {
        synchronized(LOCK) {
            return readLocked().optJSONArray("memories") ?: JSONArray()
        }
    }

    fun savePersonality(personality: JSONObject) {
        synchronized(LOCK) {
            val obj = readLocked()
            obj.put("personality", personality)
            writeLocked(obj)
        }
    }

    fun getPersonality(): JSONObject? {
        synchronized(LOCK) {
            return readLocked().optJSONObject("personality")
        }
    }
}
