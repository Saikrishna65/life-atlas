package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.io.*;
import java.net.*;
import java.util.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@GraphicsMode(GraphicsMode.Mode.LEGACY)
public class R2PlaceBackupTest {
  static class Store implements R2Transport {
    Map<String, byte[]> files = new HashMap<>();

    public R2Client.Response request(
        String method,
        String key,
        Map<String, String> query,
        Map<String, String> headers,
        R2Client.Body body,
        R2Client.Progress progress)
        throws Exception {
      if (method.equals("PUT")) {
        assertEquals("*", headers.get("if-none-match"));
        assertFalse(files.containsKey(key));
        try (InputStream in = body.open()) {
          files.put(key, R2Io.read(in, 20 * 1024 * 1024));
        }
        assertEquals(R2Policy.digest(files.get(key)), headers.get("x-amz-meta-sha256"));
      }
      byte[] value = files.getOrDefault(key, new byte[0]);
      return new R2Client.Response(
          new HttpURLConnection(new URL("https://synthetic.invalid")) {
            public int getResponseCode() {
              return 200;
            }

            public Map<String, List<String>> getHeaderFields() {
              return Collections.emptyMap();
            }

            public InputStream getInputStream() {
              return new ByteArrayInputStream(value);
            }

            public void disconnect() {}

            public boolean usingProxy() {
              return false;
            }

            public void connect() {}
          });
    }

    public JSONObject head(String key) throws Exception {
      return new JSONObject().put("size", files.get(key).length);
    }

    public void delete(String key) {
      throw new AssertionError("Backups never delete existing objects");
    }
  }

  static JSONObject catalog() throws Exception {
    return new JSONObject()
        .put("format", "life-atlas-places")
        .put("version", 1)
        .put("places", new JSONArray().put(new JSONObject().put("name", "Tungnath private visit")))
        .put("media", new JSONArray())
        .put("privateLocation", "30.488,79.217");
  }

  @Test
  public void immutableSnapshotsEncryptAndRestoreExactCatalog() throws Exception {
    Store store = new Store();
    byte[] keys = R2Crypto.newKeyset();
    JSONObject source = catalog(),
        one = R2PlaceBackup.save(store, keys, source),
        two = R2PlaceBackup.save(store, keys, source);
    String key = one.getString("key");
    assertNotEquals(key, two.getString("key"));
    String bytes = new String(store.files.get(key), java.nio.charset.StandardCharsets.UTF_8);
    assertFalse(bytes.contains("Tungnath"));
    assertFalse(bytes.contains("30.488"));
    assertEquals(source.toString(), R2PlaceBackup.restore(store, keys, key).toString());
    assertEquals(2, store.files.size());
  }

  @Test
  public void tamperedCiphertextAndForeignKeysCannotRestore() throws Exception {
    Store store = new Store();
    byte[] keys = R2Crypto.newKeyset();
    String key = R2PlaceBackup.save(store, keys, catalog()).getString("key");
    byte[] value = store.files.get(key);
    value[value.length - 1] ^= 1;
    try {
      R2PlaceBackup.restore(store, keys, key);
      fail();
    } catch (Exception expected) {
    }
    try {
      R2PlaceBackup.restore(store, R2Crypto.newKeyset(), key);
      fail();
    } catch (R2Exception expected) {
      assertEquals("INVALID_PLACE_CATALOG", expected.code);
    }
  }

  @Test
  public void recoveryVerificationIsRequiredBeforeAnyCloudWrite() throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    try {
      R2PlaceBackup.save(repo, catalog());
      fail();
    } catch (R2Exception e) {
      assertEquals("RECOVERY_VERIFICATION_REQUIRED", e.code);
    }
    assertEquals(0, repo.jobs().length());
  }

  @Test
  public void unsupportedCatalogIsRejectedBeforeUpload() throws Exception {
    Store store = new Store();
    try {
      R2PlaceBackup.save(store, R2Crypto.newKeyset(), new JSONObject().put("format", "wrong"));
      fail();
    } catch (R2Exception e) {
      assertEquals("INVALID_PLACE_CATALOG", e.code);
    }
    assertTrue(store.files.isEmpty());
  }
}
