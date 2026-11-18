package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2PublicationTest {
  static class Store implements R2Transport {
    final Map<String, byte[]> records = new LinkedHashMap<>();
    int reads = 0;
    boolean badChecksum = false;

    public R2Client.Response request(
        String method,
        String key,
        Map<String, String> query,
        Map<String, String> headers,
        R2Client.Body body,
        R2Client.Progress progress)
        throws Exception {
      if (key.equals(R2Catalog.CURRENT)) throw new R2Exception("CATALOG_CONFLICT");
      assertTrue(
          "Only immutable publication metadata may be written",
          key.startsWith("atlas/catalog/publications/"));
      if (method.equals("GET")) {
        reads++;
        assertEquals("identity", headers.get("Accept-Encoding"));
        return R2CatalogTest.response(
            new String(records.get(key), StandardCharsets.UTF_8), "\"record\"");
      }
      assertEquals("PUT", method);
      assertEquals("*", headers.get("If-None-Match"));
      assertFalse(headers.containsKey("If-Match"));
      if (records.containsKey(key)) throw new R2Exception("CATALOG_CONFLICT");
      try (InputStream input = body.open()) {
        records.put(key, R2Io.read(input, 131072));
      }
      return R2CatalogTest.response("", "");
    }

    public JSONObject head(String key) throws Exception {
      return new JSONObject()
          .put("sha256", badChecksum ? "wrong" : "synthetic-digest")
          .put("size", 100);
    }

    public void delete(String key) {
      fail("Publishing must never delete an original or existing catalog.");
    }
  }

  @Test
  public void sharedCatalogConflictCannotBlockAnIndependentTripPublication() throws Exception {
    Store store = new Store();
    JSONObject result =
        new R2Publication(R2CatalogTest.credentials(), store)
            .publish(R2CatalogTest.job("mine"), R2CatalogTest.input());
    assertEquals(1, store.records.size());
    assertEquals("mine", result.getJSONObject("item").getString("id"));
    assertTrue(
        result
            .getJSONObject("item")
            .getString("manifestUrl")
            .startsWith("https://media.example.com/atlas/catalog/publications/mine/"));
  }

  @Test
  public void retryUsesTheSameCommittedRecordWithoutOverwritingIt() throws Exception {
    Store store = new Store();
    R2Publication publication = new R2Publication(R2CatalogTest.credentials(), store);
    JSONObject first = publication.publish(R2CatalogTest.job("same"), R2CatalogTest.input());
    byte[] before = store.records.get(first.getString("manifestKey")).clone();
    JSONObject retry = publication.publish(R2CatalogTest.job("same"), R2CatalogTest.input());
    assertEquals(first.toString(), retry.toString());
    assertEquals(1, store.records.size());
    assertEquals(1, store.reads);
    assertArrayEquals(before, store.records.get(first.getString("manifestKey")));
  }

  @Test
  public void metadataChangesCreateIndependentVersionsAndKeepTheOriginalFileKey() throws Exception {
    Store store = new Store();
    R2Publication publication = new R2Publication(R2CatalogTest.credentials(), store);
    JSONObject first = publication.publish(R2CatalogTest.job("same"), R2CatalogTest.input());
    byte[] before = store.records.get(first.getString("manifestKey")).clone();
    JSONObject changed =
        publication.publish(
            R2CatalogTest.job("same"), R2CatalogTest.input().put("title", "Updated trip"));
    assertEquals(2, store.records.size());
    assertNotEquals(first.getString("manifestKey"), changed.getString("manifestKey"));
    assertEquals(
        first.getJSONObject("item").getString("key"),
        changed.getJSONObject("item").getString("key"));
    assertArrayEquals(before, store.records.get(first.getString("manifestKey")));
  }

  @Test
  public void privateUnverifiedAndChecksumMismatchesCannotPublish() throws Exception {
    Store store = new Store();
    R2Publication publication = new R2Publication(R2CatalogTest.credentials(), store);
    for (JSONObject job :
        new JSONObject[] {
          R2CatalogTest.job("private").put("slot", "private"),
          R2CatalogTest.job("unverified").put("verified", false)
        })
      try {
        publication.publish(job, R2CatalogTest.input());
        fail();
      } catch (R2Exception e) {
        assertEquals("VERIFIED_PUBLIC_COPY_REQUIRED", e.code);
      }
    store.badChecksum = true;
    try {
      publication.publish(R2CatalogTest.job("bad"), R2CatalogTest.input());
      fail();
    } catch (R2Exception e) {
      assertEquals("INTEGRITY_FAILED", e.code);
    }
    assertEquals(0, store.records.size());
  }

  @Test
  public void existingManifestMustMatchAndIsNeverForceOverwritten() throws Exception {
    Store store = new Store();
    R2Publication publication = new R2Publication(R2CatalogTest.credentials(), store);
    JSONObject first = publication.publish(R2CatalogTest.job("same"), R2CatalogTest.input());
    String key = first.getString("manifestKey");
    JSONObject corrupt = new JSONObject(new String(store.records.get(key), StandardCharsets.UTF_8));
    corrupt.getJSONObject("item").put("url", "https://other.example/changed.jpg");
    byte[] original = corrupt.toString().getBytes(StandardCharsets.UTF_8);
    store.records.put(key, original);
    try {
      publication.publish(R2CatalogTest.job("same"), R2CatalogTest.input());
      fail();
    } catch (R2Exception e) {
      assertEquals("INTEGRITY_FAILED", e.code);
    }
    assertArrayEquals(original, store.records.get(key));
  }

  private R2Repository repository() throws Exception {
    java.io.File root = java.nio.file.Files.createTempDirectory("publication-test").toFile();
    android.content.Context context =
        new android.content.ContextWrapper(org.robolectric.RuntimeEnvironment.getApplication()) {
          @Override
          public java.io.File getNoBackupFilesDir() {
            return root;
          }
        };
    javax.crypto.KeyGenerator generator = javax.crypto.KeyGenerator.getInstance("AES");
    generator.init(256);
    javax.crypto.SecretKey key = generator.generateKey();
    return new R2Repository(new R2SecureStore(context, () -> key));
  }

  @Test
  public void savedIndexMergesWithoutChangingLegacyDataAndIsBucketIsolated() throws Exception {
    R2Repository repository = repository();
    R2Credentials credentials = R2CatalogTest.credentials();
    JSONObject prepared =
        new R2Publication(credentials, new Store())
            .publish(R2CatalogTest.job("mine"), R2CatalogTest.input());
    R2Publication.remember(repository, credentials, prepared);
    R2Publication.remember(repository, credentials, prepared);
    JSONObject legacy = R2CatalogTest.Store.empty();
    assertEquals(
        1, R2Publication.merge(repository, credentials, legacy).getJSONArray("items").length());
    assertEquals(0, legacy.getJSONArray("items").length());
    assertTrue(
        R2Publication.references(
            repository, credentials, prepared.getJSONObject("item").getString("key")));
    JSONObject config =
        new JSONObject()
            .put("accountId", credentials.account)
            .put("endpoint", credentials.endpoint)
            .put("bucket", "different-public-bucket")
            .put("accessKeyId", credentials.access)
            .put("secretAccessKey", credentials.secret)
            .put("publicBaseUrl", credentials.base)
            .put("revision", "test");
    R2Credentials other = new R2Credentials(config);
    assertEquals(0, R2Publication.merge(repository, other, legacy).getJSONArray("items").length());
    assertFalse(
        R2Publication.references(
            repository, other, prepared.getJSONObject("item").getString("key")));
  }

  @Test
  public void unpublishRetainsRecoveryStateOnFailureAndDeletesOnlyItsOwnObjects() throws Exception {
    R2Repository repository = repository();
    R2Credentials credentials = R2CatalogTest.credentials();
    JSONObject prepared =
        new R2Publication(credentials, new Store())
            .publish(R2CatalogTest.job("mine"), R2CatalogTest.input());
    R2Publication.remember(repository, credentials, prepared);
    final List<String> deleted = new ArrayList<>();
    final boolean[] failDelete = {true};
    R2Transport transport =
        new Store() {
          @Override
          public R2Client.Response request(
              String method,
              String key,
              Map<String, String> query,
              Map<String, String> headers,
              R2Client.Body body,
              R2Client.Progress progress)
              throws Exception {
            assertEquals("GET", method);
            assertEquals(R2Catalog.CURRENT, key);
            return R2CatalogTest.response(R2CatalogTest.Store.empty().toString(), "\"legacy\"");
          }

          @Override
          public void delete(String key) {
            if (failDelete[0]) throw new IllegalStateException("synthetic failure");
            deleted.add(key);
          }
        };
    try {
      R2Publication.unpublish(repository, credentials, "mine", transport);
      fail();
    } catch (R2Exception expected) {
      assertEquals("PUBLIC_COPY_DELETE_FAILED", expected.code);
    }
    assertTrue(
        R2Publication.references(
            repository, credentials, prepared.getJSONObject("item").getString("key")));
    failDelete[0] = false;
    assertEquals(
        0,
        R2Publication.unpublish(repository, credentials, "mine", transport)
            .getJSONArray("items")
            .length());
    assertEquals(
        Arrays.asList(
            prepared.getString("manifestKey"), prepared.getJSONObject("item").getString("key")),
        deleted);
    assertFalse(
        R2Publication.references(
            repository, credentials, prepared.getJSONObject("item").getString("key")));
  }
}
