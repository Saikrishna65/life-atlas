package com.lifeatlas.app.security;

import static org.junit.Assert.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import javax.crypto.KeyGenerator;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class AtlasDeviceStoreTest {
  @Before
  public void clear() {
    File file =
        new File(
            RuntimeEnvironment.getApplication().getNoBackupFilesDir(), "atlas-assistant-device-v1");
    file.delete();
    new File(file + ".bak").delete();
  }

  @Test
  public void nativeStateIsAuthenticatedEncryptedAndStaleWritesPreserveTheWorkingCopy()
      throws Exception {
    var context = RuntimeEnvironment.getApplication();
    var generator = KeyGenerator.getInstance("AES");
    generator.init(256);
    var key = generator.generateKey();
    var store = new AtlasDeviceStore(context, () -> key);
    JSONObject data =
        new JSONObject()
            .put("version", 1)
            .put("conversations", new JSONArray())
            .put("memories", new JSONArray())
            .put(
                "personality",
                new JSONObject()
                    .put("tone", "Synthetic secret tone")
                    .put("behavior", "Be helpful"));
    assertEquals(1, store.save(data, 0).getLong("revision"));
    assertEquals(
        "Synthetic secret tone",
        store.read().getJSONObject("data").getJSONObject("personality").getString("tone"));
    File file = new File(context.getNoBackupFilesDir(), "atlas-assistant-device-v1");
    byte[] encrypted = java.nio.file.Files.readAllBytes(file.toPath());
    assertFalse(new String(encrypted, StandardCharsets.UTF_8).contains("Synthetic secret tone"));
    try {
      store.save(data, 0);
      fail("Stale writer must fail");
    } catch (IOException expected) {
    }
    assertEquals(1, store.read().getLong("revision"));
    encrypted[encrypted.length - 1] ^= 1;
    java.nio.file.Files.write(file.toPath(), encrypted);
    try {
      store.read();
      fail("Changed ciphertext must fail authentication");
    } catch (Exception expected) {
    }
  }
}
