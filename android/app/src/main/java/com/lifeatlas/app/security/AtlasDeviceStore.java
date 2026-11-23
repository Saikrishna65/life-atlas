package com.lifeatlas.app.security;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.*;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** Independent Keystore-encrypted AI state. Never replaces the earlier phrase-encrypted vault. */
public final class AtlasDeviceStore {
  private static final Object LOCK = new Object();
  private static final int LIMIT = 16 * 1024 * 1024;
  private static final String ALIAS = "atlas-assistant-device-v1";

  interface KeySource {
    javax.crypto.SecretKey get() throws Exception;
  }

  private final KeySource keySource;
  private final AtomicFile file;

  public AtlasDeviceStore(Context c) {
    this(c, null);
  }

  AtlasDeviceStore(Context c, KeySource source) {
    keySource = source;
    file = new AtomicFile(new File(c.getNoBackupFilesDir(), "atlas-assistant-device-v1"));
  }

  private javax.crypto.SecretKey key() throws Exception {
    if (keySource != null) return keySource.get();
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(ALIAS)) return (javax.crypto.SecretKey) store.getKey(ALIAS, null);
    if (file.getBaseFile().exists() || new File(file.getBaseFile() + ".bak").exists())
      throw new IOException("ASSISTANT_KEY_UNAVAILABLE");
    KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
    generator.init(
        new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
    return generator.generateKey();
  }

  public JSONObject read() throws Exception {
    synchronized (LOCK) {
      if (!file.getBaseFile().exists() && !new File(file.getBaseFile() + ".bak").exists())
        return new JSONObject().put("revision", 0);
      try (InputStream in = file.openRead()) {
        byte[] iv = new byte[12];
        new DataInputStream(in).readFully(iv);
        byte[] encrypted = AtlasSecurity.readLimited(in, LIMIT + 64);
        if (iv.length != 12 || encrypted.length > LIMIT + 64)
          throw new IOException("ASSISTANT_STORAGE_UNAVAILABLE");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        byte[] plain = cipher.doFinal(encrypted);
        try {
          return new JSONObject(new String(plain, java.nio.charset.StandardCharsets.UTF_8));
        } finally {
          Arrays.fill(plain, (byte) 0);
        }
      }
    }
  }

  public JSONObject save(JSONObject data, long expected) throws Exception {
    synchronized (LOCK) {
      JSONObject current = read();
      if (expected < 0 || current.getLong("revision") != expected)
        throw new IOException("ASSISTANT_CHANGED");
      if (data.optInt("version") != 1
          || data.optJSONArray("conversations") == null
          || data.optJSONArray("memories") == null
          || data.optJSONObject("personality") == null)
        throw new IOException("INVALID_ASSISTANT_DATA");
      JSONObject next = new JSONObject().put("revision", expected + 1).put("data", data);
      byte[] plain = next.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
      if (plain.length > LIMIT) {
        Arrays.fill(plain, (byte) 0);
        throw new IOException("ASSISTANT_STORAGE_FULL");
      }
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key());
      byte[] encrypted;
      try {
        encrypted = cipher.doFinal(plain);
      } finally {
        Arrays.fill(plain, (byte) 0);
      }
      FileOutputStream out = null;
      try {
        out = file.startWrite();
        out.write(cipher.getIV());
        out.write(encrypted);
        file.finishWrite(out);
      } catch (Exception e) {
        if (out != null) file.failWrite(out);
        throw e;
      } finally {
        Arrays.fill(encrypted, (byte) 0);
      }
      return next;
    }
  }
}
