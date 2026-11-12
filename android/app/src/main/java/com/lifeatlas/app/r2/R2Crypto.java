package com.lifeatlas.app.r2;

import com.google.crypto.tink.*;
import com.google.crypto.tink.streamingaead.StreamingAeadConfig;
import com.google.crypto.tink.streamingaead.StreamingAeadKeyTemplates;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.json.JSONObject;

/** Tink's established segmented AES-GCM-HKDF construction; no custom streaming cipher. */
public final class R2Crypto {
  private static final byte[] RECOVERY_AAD =
      "life-atlas-r2-recovery-v1".getBytes(StandardCharsets.UTF_8);

  static {
    try {
      StreamingAeadConfig.register();
    } catch (Exception e) {
      throw new ExceptionInInitializerError(e);
    }
  }

  private R2Crypto() {}

  public static byte[] newKeyset() throws Exception {
    KeysetHandle handle = KeysetHandle.generateNew(StreamingAeadKeyTemplates.AES256_GCM_HKDF_1MB);
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    CleartextKeysetHandle.write(handle, BinaryKeysetWriter.withOutputStream(bytes));
    return bytes.toByteArray();
  }

  private static StreamingAead aead(byte[] keyset) throws Exception {
    return CleartextKeysetHandle.read(BinaryKeysetReader.withBytes(keyset))
        .getPrimitive(StreamingAead.class);
  }

  public static OutputStream encrypt(OutputStream output, byte[] keyset, String objectKey)
      throws Exception {
    return aead(keyset).newEncryptingStream(output, objectKey.getBytes(StandardCharsets.UTF_8));
  }

  public static InputStream decrypt(InputStream input, byte[] keyset, String objectKey)
      throws Exception {
    return aead(keyset).newDecryptingStream(input, objectKey.getBytes(StandardCharsets.UTF_8));
  }

  public static String keyId(byte[] keyset) {
    return R2Policy.digest(keyset).substring(0, 24);
  }

  private static SecretKey recoveryKey(char[] password, byte[] salt) throws Exception {
    if (password.length < 16 || password.length > 1024)
      throw new R2Exception("RECOVERY_PASSPHRASE_TOO_SHORT");
    PBEKeySpec spec = new PBEKeySpec(password, salt, 600000, 256);
    try {
      return new SecretKeySpec(
          SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(),
          "AES");
    } finally {
      spec.clearPassword();
    }
  }

  public static byte[] recoveryKit(byte[] keyset, char[] password) throws Exception {
    byte[] salt = new byte[32], iv = new byte[12];
    SecureRandom rng = new SecureRandom();
    rng.nextBytes(salt);
    rng.nextBytes(iv);
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, recoveryKey(password, salt), new GCMParameterSpec(128, iv));
      cipher.updateAAD(RECOVERY_AAD);
      JSONObject json =
          new JSONObject()
              .put("format", "life-atlas-r2-recovery")
              .put("version", 1)
              .put("kdf", "PBKDF2-HMAC-SHA256")
              .put("iterations", 600000)
              .put("salt", Base64.getEncoder().encodeToString(salt))
              .put("iv", Base64.getEncoder().encodeToString(iv))
              .put("ciphertext", Base64.getEncoder().encodeToString(cipher.doFinal(keyset)));
      return json.toString().getBytes(StandardCharsets.UTF_8);
    } finally {
      Arrays.fill(password, '\0');
    }
  }

  public static byte[] restoreKit(byte[] kit, char[] password) throws Exception {
    try {
      if (kit.length > 65536) throw new R2Exception("INVALID_RECOVERY_KIT");
      JSONObject json = new JSONObject(new String(kit, StandardCharsets.UTF_8));
      if (!json.getString("format").equals("life-atlas-r2-recovery")
          || json.getInt("version") != 1
          || json.getInt("iterations") != 600000
          || !json.getString("kdf").equals("PBKDF2-HMAC-SHA256"))
        throw new R2Exception("INVALID_RECOVERY_KIT");
      byte[] salt = Base64.getDecoder().decode(json.getString("salt")),
          iv = Base64.getDecoder().decode(json.getString("iv"));
      if (salt.length != 32 || iv.length != 12) throw new R2Exception("INVALID_RECOVERY_KIT");
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, recoveryKey(password, salt), new GCMParameterSpec(128, iv));
      cipher.updateAAD(RECOVERY_AAD);
      byte[] keyset = cipher.doFinal(Base64.getDecoder().decode(json.getString("ciphertext")));
      aead(keyset);
      return keyset;
    } catch (Exception e) {
      throw new R2Exception("RECOVERY_VERIFICATION_FAILED");
    } finally {
      Arrays.fill(password, '\0');
    }
  }
}
