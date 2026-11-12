package com.lifeatlas.app.r2;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.*;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** Atomic, authenticated at-rest storage, excluded from Android backup and device transfer. */
public final class R2SecureStore {
  private static final Object LOCK = new Object();
  private static final String ALIAS = "life-atlas-r2-storage-v1";

  interface KeySource {
    SecretKey get() throws Exception;
  }

  private final KeySource keySource;
  private final AtomicFile file;
  private final File directory;

  public R2SecureStore(Context context) {
    this(context, null);
  }

  R2SecureStore(Context context, KeySource source) {
    keySource = source;
    directory = new File(context.getNoBackupFilesDir(), "r2");
    if (!directory.exists() && !directory.mkdirs())
      throw new IllegalStateException("LOCAL_STORAGE_UNAVAILABLE");
    file = new AtomicFile(new File(directory, "secure-state"));
  }

  public File directory() {
    return directory;
  }

  private SecretKey key() throws Exception {
    if (keySource != null) return keySource.get();
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
    if (file.getBaseFile().exists()) throw new R2Exception("KEYSTORE_UNAVAILABLE");
    KeyGenerator generator =
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(
        new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build());
    return generator.generateKey();
  }

  private JSONObject read() throws Exception {
    if (!file.getBaseFile().exists()) return new JSONObject().put("version", 1);
    try (InputStream input = file.openRead()) {
      byte[] iv = new byte[12];
      if (input.read(iv) != 12) throw new R2Exception("KEYSTORE_UNAVAILABLE");
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
      byte[] decoded = cipher.doFinal(R2Io.read(input, 16 * 1024 * 1024));
      try {
        return new JSONObject(new String(decoded, java.nio.charset.StandardCharsets.UTF_8));
      } finally {
        java.util.Arrays.fill(decoded, (byte) 0);
      }
    } catch (R2Exception error) {
      throw error;
    } catch (Exception error) {
      throw new R2Exception("KEYSTORE_UNAVAILABLE");
    }
  }

  private void write(JSONObject value) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key());
    byte[] plain = value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    FileOutputStream stream = null;
    try {
      byte[] encrypted = cipher.doFinal(plain);
      stream = file.startWrite();
      stream.write(cipher.getIV());
      stream.write(encrypted);
      file.finishWrite(stream);
    } catch (Exception e) {
      if (stream != null) file.failWrite(stream);
      throw new R2Exception("SECURE_SAVE_FAILED");
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
  }

  static void resetUnavailable(Context context) throws Exception {
    R2SecureStore current = new R2SecureStore(context);
    try {
      current.snapshot();
      throw new R2Exception("KEYSTORE_RESET_NOT_NEEDED");
    } catch (R2Exception error) {
      if (!error.code.equals("KEYSTORE_UNAVAILABLE")) throw error;
    }
    File quarantine =
        new File(context.getNoBackupFilesDir(), "r2-unavailable-" + java.util.UUID.randomUUID());
    if (!current.directory.renameTo(quarantine)) throw new R2Exception("SECURE_RESET_FAILED");
    KeyStore keys = KeyStore.getInstance("AndroidKeyStore");
    keys.load(null);
    keys.deleteEntry(ALIAS);
  }

  public interface Edit {
    void apply(JSONObject value) throws Exception;
  }

  public void edit(Edit edit) throws Exception {
    synchronized (LOCK) {
      JSONObject value = read();
      edit.apply(value);
      write(value);
    }
  }

  public JSONObject snapshot() throws Exception {
    synchronized (LOCK) {
      return read();
    }
  }

  public R2Credentials credentials(String slot) throws Exception {
    JSONObject record = snapshot().optJSONObject(R2Policy.slot(slot));
    if (record == null) throw new R2Exception("NOT_CONFIGURED");
    return new R2Credentials(record);
  }

  public boolean hardwareBacked() {
    try {
      return ((KeyInfo)
              SecretKeyFactory.getInstance("AES", "AndroidKeyStore")
                  .getKeySpec(key(), KeyInfo.class))
          .isInsideSecureHardware();
    } catch (Exception e) {
      return false;
    }
  }
}
