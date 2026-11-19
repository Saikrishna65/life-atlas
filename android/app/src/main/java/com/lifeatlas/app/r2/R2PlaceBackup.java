package com.lifeatlas.app.r2;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/**
 * Immutable, authenticated encrypted sidecars. Never modifies media or a shared catalog pointer.
 */
final class R2PlaceBackup {
  static final int LIMIT = 16 * 1024 * 1024;

  static String prefix(byte[] keys) {
    return "encrypted/catalog/places/" + R2Crypto.keyId(keys) + "/";
  }

  static JSONObject validate(JSONObject catalog) throws Exception {
    if (catalog == null
        || !"life-atlas-places".equals(catalog.optString("format"))
        || catalog.optInt("version") != 1
        || catalog.optJSONArray("places") == null
        || catalog.optJSONArray("media") == null
        || catalog.toString().getBytes(StandardCharsets.UTF_8).length > LIMIT)
      throw new R2Exception("INVALID_PLACE_CATALOG");
    return catalog;
  }

  static JSONObject save(R2Repository repo, JSONObject catalog) throws Exception {
    if (!repo.store.snapshot().optBoolean("recoveryVerified"))
      throw new R2Exception("RECOVERY_VERIFICATION_REQUIRED");
    byte[] keys = repo.keyset();
    try {
      return save(new R2Client(repo.store.credentials("private")), keys, catalog);
    } finally {
      Arrays.fill(keys, (byte) 0);
    }
  }

  static JSONObject save(R2Transport client, byte[] keys, JSONObject catalog) throws Exception {
    byte[] plain = validate(catalog).toString().getBytes(StandardCharsets.UTF_8);
    String key = prefix(keys) + System.currentTimeMillis() + "-" + UUID.randomUUID() + ".atlas";
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try {
      R2Envelope.encrypt(
          new ByteArrayInputStream(plain),
          out,
          keys,
          key,
          new JSONObject()
              .put("size", plain.length)
              .put("sha256", R2Policy.digest(plain))
              .put("name", "places-catalog.json")
              .put("mimeType", "application/vnd.life-atlas.places+json"));
    } finally {
      Arrays.fill(plain, (byte) 0);
    }
    byte[] cipher = out.toByteArray();
    try (R2Client.Response response =
        client.request(
            "PUT",
            key,
            Collections.emptyMap(),
            Map.of(
                "content-type",
                "application/octet-stream",
                "if-none-match",
                "*",
                "x-amz-meta-sha256",
                R2Policy.digest(cipher),
                "cache-control",
                "no-store"),
            R2Client.bytes(cipher),
            null)) {}
    return new JSONObject().put("key", key).put("size", cipher.length);
  }

  static JSONObject restore(R2Repository repo, String key) throws Exception {
    byte[] keys = repo.keyset();
    try {
      return restore(new R2Client(repo.store.credentials("private")), keys, key);
    } finally {
      Arrays.fill(keys, (byte) 0);
    }
  }

  static JSONObject restore(R2Transport client, byte[] keys, String key) throws Exception {
    R2Policy.key(key);
    if (!key.startsWith(prefix(keys)) || !key.endsWith(".atlas"))
      throw new R2Exception("INVALID_PLACE_CATALOG");
    byte[] cipher;
    try (R2Client.Response response =
        client.request("GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
      cipher = response.read(LIMIT + 65536);
    }
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try {
      R2Envelope.decrypt(
          new ByteArrayInputStream(cipher),
          new OutputStream() {
            public void write(int b) throws IOException {
              if (out.size() >= LIMIT) throw new IOException("catalog limit");
              out.write(b);
            }

            public void write(byte[] b, int offset, int count) throws IOException {
              if (out.size() + count > LIMIT) throw new IOException("catalog limit");
              out.write(b, offset, count);
            }
          },
          keys,
          key);
    } catch (Exception e) {
      throw new R2Exception("DECRYPTION_FAILED");
    }
    return validate(new JSONObject(out.toString(StandardCharsets.UTF_8.name())));
  }
}
