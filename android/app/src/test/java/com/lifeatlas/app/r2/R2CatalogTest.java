package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2CatalogTest {
  static class Store implements R2Transport {
    JSONObject current;
    int version = 1, conflicts = 0, currentWrites = 0, revisions = 0, reads = 0, deletes = 0;
    boolean missingEtag = false, denyWrite = false;

    Store() throws Exception {
      current = empty();
    }

    static JSONObject empty() throws Exception {
      return new JSONObject()
          .put("format", "life-atlas-public-media")
          .put("version", 1)
          .put("items", new JSONArray())
          .put("revision", "initial");
    }

    String etag() {
      return "\"version-" + version + "\"";
    }

    @Override
    public synchronized R2Client.Response request(
        String method,
        String key,
        Map<String, String> query,
        Map<String, String> headers,
        R2Client.Body body,
        R2Client.Progress progress)
        throws Exception {
      if (method.equals("GET")) {
        reads++;
        assertEquals("no-cache, no-store", headers.get("Cache-Control"));
        if (current == null) throw new R2Exception("OBJECT_NOT_FOUND");
        return response(current.toString(), missingEtag ? "" : etag());
      }
      assertEquals("PUT", method); // Publishing never reuploads or deletes an original.
      JSONObject next;
      try (InputStream input = body.open()) {
        next =
            new JSONObject(new String(R2Io.read(input, 2 * 1024 * 1024), StandardCharsets.UTF_8));
      }
      if (!key.equals(R2Catalog.CURRENT)) {
        assertTrue(key.startsWith("atlas/catalog/revisions/"));
        assertEquals("*", headers.get("If-None-Match"));
        revisions++;
        return response("", "");
      }
      currentWrites++;
      if (denyWrite) throw new R2Exception("PERMISSION_DENIED");
      if (conflicts > 0) {
        conflicts--;
        if (current == null) current = empty();
        current
            .getJSONArray("items")
            .put(
                new JSONObject()
                    .put("id", "other-device-" + version)
                    .put("key", "galleries/other-" + version));
        version++;
        throw new R2Exception("CATALOG_CONFLICT");
      }
      if (current == null) assertEquals("*", headers.get("If-None-Match"));
      else assertEquals(etag(), headers.get("If-Match"));
      current = next;
      version++;
      return response("", etag());
    }

    @Override
    public JSONObject head(String key) throws Exception {
      return new JSONObject().put("sha256", "synthetic-digest").put("size", 100);
    }

    @Override
    public void delete(String key) {
      deletes++;
    }
  }

  static R2Client.Response response(String body, String etag) throws Exception {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    HttpURLConnection connection =
        new HttpURLConnection(new URL("https://synthetic.invalid")) {
          public int getResponseCode() {
            return 200;
          }

          public Map<String, List<String>> getHeaderFields() {
            return etag.isEmpty()
                ? Collections.emptyMap()
                : Collections.singletonMap("ETag", Collections.singletonList(etag));
          }

          public InputStream getInputStream() {
            return new ByteArrayInputStream(bytes);
          }

          public void disconnect() {}

          public boolean usingProxy() {
            return false;
          }

          public void connect() {}
        };
    return new R2Client.Response(connection);
  }

  static R2Credentials credentials() throws Exception {
    return new R2Credentials(
        new JSONObject()
            .put("accountId", "0123456789abcdef0123456789abcdef")
            .put("bucket", "life-atlas-public")
            .put("accessKeyId", "synthetic-access-only")
            .put("secretAccessKey", "synthetic-secret-only-not-a-real-token")
            .put("publicBaseUrl", "https://media.example.com")
            .put("revision", "test"));
  }

  static JSONObject job(String id) throws Exception {
    return new JSONObject()
        .put("id", id)
        .put("slot", "public")
        .put("direction", "upload")
        .put("status", "complete")
        .put("verified", true)
        .put("key", "galleries/originals/" + id + ".bin")
        .put("sha256", "synthetic-digest")
        .put("totalBytes", 100)
        .put("mimeType", "image/jpeg");
  }

  static JSONObject input() throws Exception {
    return new JSONObject()
        .put("title", "My trip")
        .put("description", "")
        .put("category", "expedition")
        .put("collection", "my-trip")
        .put("tags", new JSONArray().put("place:Waterfall"))
        .put("acknowledgeMetadata", true);
  }

  @Test
  public void sequentialPublishingReadsFreshEtagsAndRetainsBothPhotos() throws Exception {
    Store store = new Store();
    new R2Catalog(credentials(), store).publish(job("one"), input());
    JSONObject result = new R2Catalog(credentials(), store).publish(job("two"), input());
    assertEquals(2, result.getJSONArray("items").length());
    assertEquals(2, store.reads);
    assertEquals(0, store.deletes);
  }

  @Test
  public void racingPublisherIsMergedAfterConditionalConflict() throws Exception {
    Store store = new Store();
    store.conflicts = 1;
    JSONObject result = new R2Catalog(credentials(), store).publish(job("mine"), input());
    JSONArray items = result.getJSONArray("items");
    assertEquals(2, items.length());
    assertEquals("other-device-1", items.getJSONObject(0).getString("id"));
    assertEquals("mine", items.getJSONObject(1).getString("id"));
    assertEquals(2, store.currentWrites);
    assertEquals(0, store.deletes);
  }

  @Test
  public void lostResponseRetryIsIdempotentAndDoesNotWriteAnotherRevision() throws Exception {
    Store store = new Store();
    JSONObject first = new R2Catalog(credentials(), store).publish(job("same"), input());
    String publishedAt = first.getJSONArray("items").getJSONObject(0).getString("publishedAt");
    JSONObject retry = new R2Catalog(credentials(), store).publish(job("same"), input());
    assertEquals(1, retry.getJSONArray("items").length());
    assertEquals(1, store.currentWrites);
    assertEquals(1, store.revisions);
    assertEquals(
        publishedAt, retry.getJSONArray("items").getJSONObject(0).getString("publishedAt"));
  }

  @Test
  public void repeatedConflictsStopWithoutDeletingFilesOrMutatingSavedJob() throws Exception {
    Store store = new Store();
    store.conflicts = 10;
    JSONObject saved = job("pending");
    String before = saved.toString();
    try {
      new R2Catalog(credentials(), store).publish(saved, input());
      fail();
    } catch (R2Exception e) {
      assertEquals("CATALOG_CONFLICT", e.code);
    }
    assertEquals(4, store.currentWrites);
    assertEquals(0, store.deletes);
    assertEquals(before, saved.toString());
    assertEquals(4, store.current.getJSONArray("items").length());
  }

  @Test
  public void missingEtagFailsClosedAndAccessDenialIsNotRetried() throws Exception {
    Store missing = new Store();
    missing.missingEtag = true;
    try {
      new R2Catalog(credentials(), missing).publish(job("one"), input());
      fail();
    } catch (R2Exception e) {
      assertEquals("MISSING_CATALOG_ETAG", e.code);
    }
    assertEquals(0, missing.currentWrites);
    Store denied = new Store();
    denied.denyWrite = true;
    try {
      new R2Catalog(credentials(), denied).publish(job("two"), input());
      fail();
    } catch (R2Exception e) {
      assertEquals("PERMISSION_DENIED", e.code);
    }
    assertEquals(1, denied.currentWrites);
  }

  @Test
  public void firstCatalogUsesConditionalCreation() throws Exception {
    Store store = new Store();
    store.current = null;
    assertEquals(
        1,
        new R2Catalog(credentials(), store)
            .publish(job("first"), input())
            .getJSONArray("items")
            .length());
  }

  @Test
  public void parallelPublishersKeepEveryApprovedPhoto() throws Exception {
    Store store = new Store();
    ExecutorService pool = Executors.newFixedThreadPool(2);
    CountDownLatch start = new CountDownLatch(1);
    try {
      Future<?> a =
          pool.submit(
              () -> {
                try {
                  start.await();
                  new R2Catalog(credentials(), store).publish(job("a"), input());
                } catch (Exception e) {
                  throw new RuntimeException(e);
                }
              });
      Future<?> b =
          pool.submit(
              () -> {
                try {
                  start.await();
                  new R2Catalog(credentials(), store).publish(job("b"), input());
                } catch (Exception e) {
                  throw new RuntimeException(e);
                }
              });
      start.countDown();
      a.get(5, TimeUnit.SECONDS);
      b.get(5, TimeUnit.SECONDS);
      assertEquals(2, store.current.getJSONArray("items").length());
      assertEquals(0, store.deletes);
    } finally {
      pool.shutdownNow();
    }
  }
}
