package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.io.*;
import java.net.*;
import java.util.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2DuplicatesTest {
  static final String BODY = "synthetic original bytes, not a user photograph";
  static final String HASH =
      R2Policy.digest(BODY.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  static final String OLD = "11111111-1111-4111-8111-111111111111",
      NEW = "22222222-2222-4222-8222-222222222222";

  static JSONObject job(String id) throws Exception {
    return R2CatalogTest.job(id)
        .put("revision", "test")
        .put("sha256", HASH)
        .put("totalBytes", BODY.length())
        .put("name", "photo.jpg")
        .put("verified", id.equals(OLD))
        .put("uploadedBytes", 0);
  }

  static R2Repository repository() throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    repo.store.edit(
        state -> {
          JSONObject config =
              new JSONObject()
                  .put("accountId", "0123456789abcdef0123456789abcdef")
                  .put("bucket", "life-atlas-public")
                  .put("accessKeyId", "synthetic-access-only")
                  .put("secretAccessKey", "synthetic-secret-only-not-a-real-token")
                  .put("publicBaseUrl", "https://media.example.com")
                  .put("revision", "test");
          state.put("public", config).put("private", config);
        });
    return repo;
  }

  static class Cloud implements R2Transport {
    int gets, heads, writes, deletes;
    boolean missing, corrupt, fail;
    byte[] bytes = BODY.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    String hash = HASH;

    public JSONObject head(String key) throws Exception {
      heads++;
      if (missing) throw new R2Exception("OBJECT_NOT_FOUND");
      if (fail) throw new R2Exception("NETWORK_UNAVAILABLE");
      return new JSONObject().put("size", bytes.length).put("sha256", hash);
    }

    public R2Client.Response request(
        String method,
        String key,
        Map<String, String> query,
        Map<String, String> headers,
        R2Client.Body body,
        R2Client.Progress progress)
        throws Exception {
      if (!method.equals("GET")) {
        writes++;
        fail("Duplicate detection must never write an original");
      }
      gets++;
      final byte[] result = bytes.clone();
      if (corrupt) result[0] ^= 1;
      return new R2Client.Response(
          new HttpURLConnection(new URL("https://synthetic.invalid")) {
            public int getResponseCode() {
              return 200;
            }

            public Map<String, List<String>> getHeaderFields() {
              return Collections.emptyMap();
            }

            public InputStream getInputStream() {
              return new ByteArrayInputStream(result);
            }

            public void disconnect() {}

            public boolean usingProxy() {
              return false;
            }

            public void connect() {}
          });
    }

    public void delete(String key) {
      deletes++;
      fail("Duplicate detection must never delete an original");
    }
  }

  @Test
  public void identicalBytesUnderDifferentNamesReuseOneVerifiedObjectAndStableMediaId()
      throws Exception {
    R2Repository repo = repository();
    JSONObject old = job(OLD).put("thumbnailKey", "galleries/previews/old.jpg"),
        next = job(NEW).put("status", "uploading").put("name", "renamed-copy.jpg");
    repo.job(old);
    repo.job(next);
    Cloud cloud = new Cloud();
    assertTrue(R2Duplicates.reuse(repo, next, R2CatalogTest.credentials(), cloud, () -> {}));
    JSONObject result = repo.job(NEW);
    assertEquals("complete", result.getString("status"));
    assertTrue(result.getBoolean("reused"));
    assertTrue(result.getBoolean("verified"));
    assertEquals(old.getString("key"), result.getString("key"));
    assertEquals(OLD, result.getString("mediaId"));
    assertEquals("renamed-copy.jpg", result.getString("name"));
    assertEquals(0, result.getLong("uploadedBytes"));
    assertEquals(1, cloud.gets);
    assertEquals(0, cloud.writes);
    assertEquals(0, cloud.deletes);
    assertEquals(
        "https://media.example.com/galleries/previews/old.jpg", result.getString("thumbnailUrl"));
    assertEquals("complete", repo.job(OLD).getString("status"));
  }

  @Test
  public void anotherTripReusesBytesButKeepsIndependentPublicationIdentity() throws Exception {
    R2Repository repo = repository();
    JSONObject old = job(OLD).put("tripCollection", "trip-one");
    JSONObject next = job(NEW).put("status", "uploading").put("tripCollection", "trip-two");
    repo.job(old);
    repo.job(next);
    Cloud cloud = new Cloud();
    assertTrue(R2Duplicates.reuse(repo, next, R2CatalogTest.credentials(), cloud, () -> {}));
    assertEquals(old.getString("key"), repo.job(NEW).getString("key"));
    assertEquals(NEW, repo.job(NEW).getString("mediaId"));
    assertEquals("trip-one", repo.job(OLD).getString("tripCollection"));
    assertEquals("trip-two", repo.job(NEW).getString("tripCollection"));
    assertEquals(0, cloud.writes);
  }

  @Test
  public void repeatWithinSecondTripRetainsItsExistingMediaId() throws Exception {
    R2Repository repo = repository();
    JSONObject original = job(OLD).put("tripCollection", "one").put("createdAt", 1);
    JSONObject alias =
        job(NEW)
            .put("status", "complete")
            .put("verified", true)
            .put("mediaId", NEW)
            .put("key", original.getString("key"))
            .put("tripCollection", "two")
            .put("createdAt", 2);
    JSONObject next =
        job("33333333-3333-4333-8333-333333333333")
            .put("status", "uploading")
            .put("tripCollection", "two")
            .put("createdAt", 3);
    repo.job(original);
    repo.job(alias);
    repo.job(next);
    Cloud cloud = new Cloud();
    assertTrue(R2Duplicates.reuse(repo, next, R2CatalogTest.credentials(), cloud, () -> {}));
    assertEquals(NEW, repo.job(next.getString("id")).getString("mediaId"));
    assertEquals(0, cloud.writes);
  }

  @Test
  public void sameFilenameDifferentBytesUnverifiedDownloadsAndOtherBucketsNeverMatch()
      throws Exception {
    JSONObject current = job(NEW), previous = job(OLD);
    R2Credentials c = R2CatalogTest.credentials();
    assertFalse(R2Duplicates.matches(current, job(OLD).put("sha256", "a".repeat(64)), c));
    assertFalse(R2Duplicates.matches(current, job(OLD).put("verified", false), c));
    assertFalse(R2Duplicates.matches(current, job(OLD).put("direction", "download"), c));
    assertFalse(R2Duplicates.matches(current, job(OLD).put("status", "failed"), c));
    assertFalse(R2Duplicates.matches(current, job(OLD).put("slot", "private"), c));
    assertFalse(R2Duplicates.matches(current, job(OLD).put("stripMetadata", true), c));
    assertFalse(R2Duplicates.matches(current, job(OLD).put("storageScope", "another-bucket"), c));
    assertFalse(R2Duplicates.matches(current, job(OLD).put("revision", "old"), c));
    previous.put("storageScope", R2Duplicates.scope(c)).put("revision", "rotated-token");
    assertTrue(R2Duplicates.matches(current, previous, c));
  }

  @Test
  public void privateFilesMatchPlaintextOnlyInSecureHistoryAndRequireTheSameRecoveryKey()
      throws Exception {
    JSONObject current =
        job(NEW).put("slot", "private").put("contentSha256", HASH).put("keyId", "key-a");
    JSONObject previous =
        job(OLD)
            .put("slot", "private")
            .put("contentSha256", HASH)
            .put("sha256", "a".repeat(64))
            .put("keyId", "key-a");
    assertTrue(R2Duplicates.matches(current, previous, R2CatalogTest.credentials()));
    previous.put("keyId", "key-b");
    assertFalse(R2Duplicates.matches(current, previous, R2CatalogTest.credentials()));
    previous.remove("contentSha256");
    previous.put("sha256", HASH);
    assertFalse(R2Duplicates.matches(current, previous, R2CatalogTest.credentials()));
    assertFalse(repository().safeJob(current).has("contentSha256"));
  }

  @Test
  public void missingObjectAllowsFreshUploadButNetworkOrCorruptionNeverClaimSuccess()
      throws Exception {
    for (String mode : List.of("missing", "network", "corrupt")) {
      R2Repository repo = repository();
      JSONObject next = job(NEW).put("status", "uploading");
      repo.job(job(OLD));
      repo.job(next);
      Cloud cloud = new Cloud();
      cloud.missing = mode.equals("missing");
      cloud.fail = mode.equals("network");
      cloud.corrupt = mode.equals("corrupt");
      if (cloud.missing)
        assertFalse(R2Duplicates.reuse(repo, next, R2CatalogTest.credentials(), cloud, () -> {}));
      else
        try {
          R2Duplicates.reuse(repo, next, R2CatalogTest.credentials(), cloud, () -> {});
          fail();
        } catch (R2Exception expected) {
          assertEquals(cloud.fail ? "NETWORK_UNAVAILABLE" : "INTEGRITY_FAILED", expected.code);
        }
      assertFalse(repo.job(NEW).optBoolean("reused"));
      assertFalse(repo.job(NEW).optBoolean("verified"));
      assertEquals(next.getString("key"), repo.job(NEW).getString("key"));
      assertEquals(0, cloud.writes);
    }
  }

  @Test
  public void interruptedVerificationDoesNotBindOrDeleteTheSharedObject() throws Exception {
    R2Repository repo = repository();
    JSONObject next = job(NEW).put("status", "uploading");
    repo.job(job(OLD));
    repo.job(next);
    Cloud cloud = new Cloud();
    int[] checks = {0};
    try {
      R2Duplicates.reuse(
          repo,
          next,
          R2CatalogTest.credentials(),
          cloud,
          () -> {
            if (++checks[0] > 1) throw new R2Exception("TRANSFER_INTERRUPTED");
          });
      fail();
    } catch (R2Exception expected) {
      assertEquals("TRANSFER_INTERRUPTED", expected.code);
    }
    assertFalse(repo.job(NEW).optBoolean("reused"));
    assertEquals(next.getString("key"), repo.job(NEW).getString("key"));
    // Even a delayed cancellation cleanup of a completed alias never deletes its shared original.
    repo.update(NEW, j -> j.put("reused", true).put("key", job(OLD).getString("key")));
    repo.cleanupCancelled(NEW);
    assertEquals("complete", repo.job(OLD).getString("status"));
  }

  @Test
  public void privateReuseKeepsAuthenticatedObjectKeyAndRestoresExactOriginalBytes()
      throws Exception {
    R2Repository repo = repository();
    byte[] keyset = R2Crypto.newKeyset(),
        original = BODY.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    String objectKey = "encrypted/photos/" + OLD + ".atlasenc";
    ByteArrayOutputStream encrypted = new ByteArrayOutputStream();
    R2Envelope.encrypt(
        new ByteArrayInputStream(original),
        encrypted,
        keyset,
        objectKey,
        new JSONObject()
            .put("name", "original.jpg")
            .put("mimeType", "image/jpeg")
            .put("size", original.length)
            .put("sha256", HASH));
    Cloud cloud = new Cloud();
    cloud.bytes = encrypted.toByteArray();
    cloud.hash = R2Policy.digest(cloud.bytes);
    JSONObject old =
        job(OLD)
            .put("slot", "private")
            .put("key", objectKey)
            .put("keyId", R2Crypto.keyId(keyset))
            .put("contentSha256", HASH)
            .put("sha256", cloud.hash)
            .put("totalBytes", cloud.bytes.length);
    JSONObject next =
        job(NEW)
            .put("slot", "private")
            .put("status", "uploading")
            .put("contentSha256", HASH)
            .put("keyId", R2Crypto.keyId(keyset));
    repo.job(old);
    repo.job(next);
    assertTrue(R2Duplicates.reuse(repo, next, R2CatalogTest.credentials(), cloud, () -> {}));
    ByteArrayOutputStream restored = new ByteArrayOutputStream();
    R2Envelope.decrypt(
        new ByteArrayInputStream(cloud.bytes), restored, keyset, repo.job(NEW).getString("key"));
    assertArrayEquals(original, restored.toByteArray());
    assertEquals("", repo.job(NEW).getString("publicUrl"));
    assertFalse(repo.safeJob(repo.job(NEW)).has("contentSha256"));
    assertEquals(0, cloud.writes);
    Arrays.fill(keyset, (byte) 0);
  }

  @Test
  public void multipartResumeIsNeverReboundToAnotherObject() throws Exception {
    R2Repository repo = repository();
    JSONObject next = job(NEW).put("uploadId", "existing-multipart");
    repo.job(job(OLD));
    repo.job(next);
    Cloud cloud = new Cloud();
    assertFalse(R2Duplicates.reuse(repo, next, R2CatalogTest.credentials(), cloud, () -> {}));
    assertEquals(0, cloud.heads);
  }
}
