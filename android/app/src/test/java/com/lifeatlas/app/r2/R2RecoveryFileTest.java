package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.io.*;
import java.util.*;
import org.json.JSONObject;
import org.junit.Test;

@org.junit.runner.RunWith(org.robolectric.RobolectricTestRunner.class)
@org.robolectric.annotation.Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2RecoveryFileTest {
  @Test
  public void portableRecoveryNeedsNoPhraseAndRestoresTheExactEncryptionKey() throws Exception {
    byte[] key = R2Crypto.newKeyset(),
        file = R2Crypto.recoveryFile(key),
        restored = R2Crypto.restoreFile(file);
    assertArrayEquals(key, restored);
    assertTrue(R2Policy.recoveryMaterial("atlas.atlasr2key", null));
    assertTrue(R2Policy.recoveryMaterial("renamed.json", file));
    assertFalse(R2Policy.recoveryMaterial("photo.jpg", new byte[] {1, 2, 3}));
    String json = new String(file, java.nio.charset.StandardCharsets.UTF_8);
    assertFalse(json.contains("accessKey"));
    assertFalse(json.contains("secretAccessKey"));
    assertFalse(json.contains("passphrase"));
    byte[] original = "Recovery rehearsal without a new password".getBytes();
    ByteArrayOutputStream encrypted = new ByteArrayOutputStream();
    try (OutputStream out = R2Crypto.encrypt(encrypted, key, "file-test")) {
      out.write(original);
    }
    try (InputStream in =
        R2Crypto.decrypt(
            new ByteArrayInputStream(encrypted.toByteArray()), restored, "file-test")) {
      assertArrayEquals(original, R2Io.read(in, 1024));
    }
    Arrays.fill(key, (byte) 0);
    Arrays.fill(restored, (byte) 0);
  }

  @Test
  public void corruptAndUnknownRecoveryFilesAreRejected() throws Exception {
    byte[] key = R2Crypto.newKeyset();
    JSONObject value =
        new JSONObject(
            new String(R2Crypto.recoveryFile(key), java.nio.charset.StandardCharsets.UTF_8));
    value.put("keyId", "wrong");
    try {
      R2Crypto.restoreFile(value.toString().getBytes());
      fail();
    } catch (Exception expected) {
    }
    value.put("format", "other");
    try {
      R2Crypto.restoreFile(value.toString().getBytes());
      fail();
    } catch (Exception expected) {
    }
    Arrays.fill(key, (byte) 0);
  }
}
