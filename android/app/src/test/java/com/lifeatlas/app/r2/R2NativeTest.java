package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.io.*;
import java.util.*;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2NativeTest {
  @Test
  public void endpointsAreAccountBoundAndHttpsOnly() {
    String id = "0123456789abcdef0123456789abcdef";
    assertEquals("https://" + id + ".r2.cloudflarestorage.com", R2Policy.endpoint(id, ""));
    for (String url :
        new String[] {
          "http://" + id + ".r2.cloudflarestorage.com",
          "https://evil.example",
          "https://" + id + ".r2.cloudflarestorage.com@evil.example",
          "https://" + id + ".r2.cloudflarestorage.com/path"
        })
      try {
        R2Policy.endpoint(id, url);
        fail(url);
      } catch (IllegalArgumentException expected) {
      }
  }

  @Test
  public void unsafeKeysAndCredentialUrlsAreRejected() {
    for (String key : new String[] {"../secret", "a/../b", "/absolute", "a\\b", "a//b", "a/\n"})
      try {
        R2Policy.key(key);
        fail(key);
      } catch (IllegalArgumentException expected) {
      }
    try {
      R2Policy.publicBase("https://user:secret@media.example");
      fail();
    } catch (IllegalArgumentException expected) {
    }
    assertTrue(R2Policy.partSize(500L * 1024 * 1024 * 1024) * 10000 >= 500L * 1024 * 1024 * 1024);
  }

  @Test
  public void streamingOriginalAndRecoveryRoundTrip() throws Exception {
    byte[] original = new byte[3 * 1024 * 1024 + 37];
    new Random(42).nextBytes(original);
    byte[] key = R2Crypto.newKeyset();
    JSONObject meta =
        new JSONObject()
            .put("name", "original.mov")
            .put("mimeType", "video/quicktime")
            .put("size", original.length)
            .put("sha256", R2Policy.digest(original));
    ByteArrayOutputStream encrypted = new ByteArrayOutputStream();
    R2Envelope.encrypt(
        new ByteArrayInputStream(original), encrypted, key, "encrypted/videos/test.atlasenc", meta);
    assertFalse(Arrays.equals(original, encrypted.toByteArray()));
    byte[] kit = R2Crypto.recoveryKit(key, "a strong independent passphrase".toCharArray());
    byte[] restored = R2Crypto.restoreKit(kit, "a strong independent passphrase".toCharArray());
    assertArrayEquals(key, restored);
    ByteArrayOutputStream plain = new ByteArrayOutputStream();
    JSONObject decoded =
        R2Envelope.decrypt(
            new ByteArrayInputStream(encrypted.toByteArray()),
            plain,
            restored,
            "encrypted/videos/test.atlasenc");
    assertArrayEquals(original, plain.toByteArray());
    assertEquals("original.mov", decoded.getString("name"));
  }

  @Test
  public void tamperingAndWrongAssociatedObjectFail() throws Exception {
    byte[] original = "unchanged original bytes".getBytes();
    byte[] key = R2Crypto.newKeyset();
    JSONObject meta =
        new JSONObject()
            .put("name", "photo.raw")
            .put("size", original.length)
            .put("sha256", R2Policy.digest(original));
    ByteArrayOutputStream encrypted = new ByteArrayOutputStream();
    R2Envelope.encrypt(
        new ByteArrayInputStream(original), encrypted, key, "encrypted/photos/one", meta);
    byte[] bytes = encrypted.toByteArray();
    bytes[bytes.length - 1] ^= 1;
    try {
      R2Envelope.decrypt(
          new ByteArrayInputStream(bytes),
          new ByteArrayOutputStream(),
          key,
          "encrypted/photos/one");
      fail();
    } catch (R2Exception expected) {
    }
    try {
      R2Envelope.decrypt(
          new ByteArrayInputStream(encrypted.toByteArray()),
          new ByteArrayOutputStream(),
          key,
          "encrypted/photos/two");
      fail();
    } catch (R2Exception expected) {
    }
  }

  @Test
  public void recoveryRejectsWrongPassphrase() throws Exception {
    byte[] kit =
        R2Crypto.recoveryKit(R2Crypto.newKeyset(), "correct recovery phrase 123".toCharArray());
    try {
      R2Crypto.restoreKit(kit, "wrong recovery phrase 12345".toCharArray());
      fail();
    } catch (R2Exception expected) {
      assertEquals("RECOVERY_VERIFICATION_FAILED", expected.code);
    }
  }

  @Test
  public void secureStoreCiphertextAndSummaryDoNotExposeKeys() throws Exception {
    android.content.Context context = org.robolectric.RuntimeEnvironment.getApplication();
    File state = new File(context.getNoBackupFilesDir(), "r2/secure-state");
    state.delete();
    KeyGenerator gen = KeyGenerator.getInstance("AES");
    gen.init(256);
    SecretKey key = gen.generateKey();
    R2SecureStore store = new R2SecureStore(context, () -> key);
    JSONObject record =
        new JSONObject()
            .put("accountId", "0123456789abcdef0123456789abcdef")
            .put("endpoint", "")
            .put("bucket", "life-atlas-public")
            .put("accessKeyId", "synthetic-access-only")
            .put("secretAccessKey", "synthetic-secret-only-not-a-real-token")
            .put("revision", "test");
    store.edit(value -> value.put("public", record));
    String disk =
        new String(
            java.nio.file.Files.readAllBytes(state.toPath()),
            java.nio.charset.StandardCharsets.ISO_8859_1);
    assertFalse(disk.contains("synthetic-secret"));
    assertTrue(
        state.getCanonicalPath().startsWith(context.getNoBackupFilesDir().getCanonicalPath()));
    JSONObject summary =
        new R2Credentials(store.snapshot().getJSONObject("public")).summary("public");
    assertFalse(summary.has("secretAccessKey"));
    assertFalse(summary.has("accessKeyId"));
    KeyGenerator other = KeyGenerator.getInstance("AES");
    other.init(256);
    SecretKey wrong = other.generateKey();
    try {
      new R2SecureStore(context, () -> wrong).snapshot();
      fail();
    } catch (R2Exception expected) {
      assertEquals("KEYSTORE_UNAVAILABLE", expected.code);
    }
    assertTrue(store.snapshot().has("public"));
    state.delete();
  }

  @Test
  public void xmlExternalEntitiesAreBlocked() throws Exception {
    try {
      R2Client.xml(
          "<!DOCTYPE x [<!ENTITY secret SYSTEM 'file:///etc/passwd'>]><x>&secret;</x>".getBytes());
      fail();
    } catch (R2Exception expected) {
      assertEquals("INVALID_XML_RESPONSE", expected.code);
    }
  }
}
