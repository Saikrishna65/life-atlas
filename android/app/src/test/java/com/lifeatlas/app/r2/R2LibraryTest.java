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
@SQLiteMode(SQLiteMode.Mode.LEGACY)
public class R2LibraryTest {
  static JSONObject record() throws Exception {
    return new JSONObject()
        .put("id", "a".repeat(64))
        .put("scope", "b".repeat(64))
        .put("slot", "private")
        .put("state", "active")
        .put("clock", 1)
        .put("revision", UUID.randomUUID())
        .put("key", "encrypted/photos/synthetic.atlas")
        .put("sha256", "c".repeat(64))
        .put("contentSha256", "d".repeat(64))
        .put("fingerprint", "e".repeat(64))
        .put("totalBytes", 1024)
        .put("size", 900)
        .put("name", "Private mountain visit.jpg")
        .put("mimeType", "image/jpeg")
        .put("sourceToken", "f".repeat(64))
        .put("changed", 100);
  }

  @Test
  public void localPayloadIsEncryptedAndSurvivesReopening() throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    JSONObject r = record();
    try (R2LibraryStore s = new R2LibraryStore(repo)) {
      s.put(r, true);
      try (android.database.Cursor c = s.db.rawQuery("SELECT payload FROM media", null)) {
        c.moveToFirst();
        assertFalse(
            new String(c.getBlob(0), java.nio.charset.StandardCharsets.UTF_8).contains("mountain"));
      }
    }
    try (R2LibraryStore s = new R2LibraryStore(repo)) {
      assertEquals(r.toString(), s.get(r.getString("id")).toString());
      assertEquals(1, s.dirty(50).length());
    }
  }

  @Test
  public void staleWritesCannotResurrectTrashedItems() throws Exception {
    try (R2LibraryStore s = new R2LibraryStore(R2TripQueueTest.repository())) {
      JSONObject r = record(), trash = R2Library.revise(r, "trashed");
      s.put(r, true);
      s.put(trash, true);
      assertFalse(s.merge(r));
      try {
        s.put(r, true);
        fail();
      } catch (R2Exception e) {
        assertEquals("CATALOG_CONFLICT", e.code);
      }
      assertEquals("trashed", s.get(r.getString("id")).getString("state"));
    }
  }

  @Test
  public void equalClockConflictsKeepDeletionInEitherArrivalOrder() throws Exception {
    JSONObject r = record(),
        deleted =
            new JSONObject(r.toString()).put("revision", UUID.randomUUID()).put("state", "deleted");
    for (boolean reverse : List.of(false, true))
      try (R2LibraryStore s = new R2LibraryStore(R2TripQueueTest.repository())) {
        s.put(reverse ? deleted : r, false);
        s.merge(reverse ? r : deleted);
        JSONObject saved = s.get(r.getString("id"));
        assertEquals("deleted", saved.getString("state"));
        assertTrue(saved.getBoolean("conflicted"));
      }
  }

  @Test
  public void olderSyncCannotMarkANewerRevisionClean() throws Exception {
    try (R2LibraryStore s = new R2LibraryStore(R2TripQueueTest.repository())) {
      JSONObject r = record(), next = R2Library.revise(r, "trashed");
      s.put(next, true);
      s.synced(r.getString("id"), r.getString("revision"));
      assertEquals(1, s.dirty(10).length());
      s.synced(next.getString("id"), next.getString("revision"));
      assertEquals(0, s.dirty(10).length());
    }
  }

  @Test
  public void tombstonesKeepSourceAndFingerprintExclusionsAcrossRestarts() throws Exception {
    try (R2LibraryStore s = new R2LibraryStore(R2TripQueueTest.repository())) {
      JSONObject r = record().put("state", "deleted");
      s.put(r, false);
      assertTrue(s.knownSource(r.getString("sourceToken"), r.getString("scope")));
      assertFalse(s.knownSource(r.getString("sourceToken"), "0".repeat(64)));
      assertEquals(1, s.fingerprint(r.getString("fingerprint"), r.getString("scope")).length());
    }
  }

  @Test
  public void javascriptSummaryContainsNoObjectPathsOrHashes() throws Exception {
    JSONObject r = record().put("galleryId", "image:external:999");
    String safe = R2Library.safe(r).toString();
    for (String key :
        List.of("contentSha256", "sha256", "sourceToken", "galleryId", "fingerprint", "key"))
      assertFalse(R2Library.safe(r).has(key));
    assertTrue(safe.contains("Private mountain"));
  }

  @Test
  public void cloudRecordAuthenticationBindsTheExactObjectKey() throws Exception {
    byte[] keys = R2Crypto.newKeyset();
    JSONObject r = record();
    String key = R2Library.recordKey(keys, r);
    byte[] data = R2LibraryStore.encode(r, keys, key);
    assertEquals(r.toString(), R2LibraryStore.decode(data, keys, key).toString());
    try {
      R2LibraryStore.decode(data, keys, key + "foreign");
      fail();
    } catch (Exception expected) {
    }
    data[data.length - 1] ^= 1;
    try {
      R2LibraryStore.decode(data, keys, key);
      fail();
    } catch (Exception expected) {
    }
  }

  static class Cloud implements R2Transport {
    Map<String, byte[]> objects = new HashMap<>();
    int puts = 0;
    boolean tamper = false;

    public JSONObject head(String key) throws Exception {
      if (!objects.containsKey(key)) throw new R2Exception("OBJECT_NOT_FOUND");
      return new JSONObject().put("size", objects.get(key).length);
    }

    public void delete(String key) {
      throw new AssertionError("Index sync cannot delete originals");
    }

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
        assertFalse(objects.containsKey(key));
        try (InputStream in = body.open()) {
          objects.put(key, R2Io.read(in, 262144));
        }
        puts++;
      }
      byte[] bytes = objects.get(key).clone();
      if (tamper) bytes[bytes.length - 1] ^= 1;
      return new R2Client.Response(
          new HttpURLConnection(new URL("https://synthetic.invalid")) {
            public int getResponseCode() {
              return 200;
            }

            public Map<String, List<String>> getHeaderFields() {
              return Map.of();
            }

            public InputStream getInputStream() {
              return new ByteArrayInputStream(bytes);
            }

            public void disconnect() {}

            public boolean usingProxy() {
              return false;
            }

            public void connect() {}
          });
    }
  }

  @Test
  public void immutableCloudRetryVerifiesWithoutOverwritingAndStripsLocalDeviceIds()
      throws Exception {
    Cloud c = new Cloud();
    byte[] keys = R2Crypto.newKeyset();
    JSONObject r = record();
    R2Library.sync(c, keys, r);
    r.put("sourceToken", "9".repeat(64));
    R2Library.sync(c, keys, r);
    assertEquals(1, c.puts);
    String key = R2Library.recordKey(keys, r);
    JSONObject restored = R2LibraryStore.decode(c.objects.get(key), keys, key);
    assertFalse(restored.has("sourceToken"));
    assertEquals(r.getString("name"), restored.getString("name"));
  }

  @Test
  public void corruptedImmutableRecordNeverCountsAsSuccessfulSync() throws Exception {
    Cloud c = new Cloud();
    byte[] keys = R2Crypto.newKeyset();
    JSONObject r = record();
    R2Library.sync(c, keys, r);
    c.tamper = true;
    try {
      R2Library.sync(c, keys, r);
      fail();
    } catch (Exception expected) {
    }
    assertEquals(1, c.puts);
  }

  @Test
  public void cancellingVerifiedMediaDoesNotDeleteIndexedOriginalOrNeedCredentials()
      throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    String id = UUID.randomUUID().toString();
    repo.job(
        new JSONObject()
            .put("id", id)
            .put("direction", "upload")
            .put("mediaVerified", true)
            .put("status", "cancelling"));
    repo.cleanupCancelled(id);
    assertEquals("cancelled", repo.job(id).getString("status"));
  }

  @Test
  public void importedMetadataWorksOfflineWithoutR2ConfigurationOrRecoveryKit() throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    try (R2LibraryStore store = new R2LibraryStore(repo)) {
      JSONObject r =
          new JSONObject()
              .put("title", "Original date and place")
              .put("gps", new JSONObject().put("latitude", 30).put("longitude", 79));
      store.importPut("sidecar:example", "", r);
      assertEquals(r.toString(), store.importGet("sidecar:example").toString());
      assertEquals(repo.store.localToken("test"), repo.store.localToken("test"));
      assertEquals(1, store.importSummary().getInt("unmatched"));
    }
  }

  @Test
  public void automaticBackupRequiresRecoveryAndCannotRunWithMissingSetup() throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    try {
      R2AutoBackup.valid(
          RuntimeEnvironment.getApplication(), repo, new JSONObject().put("enabled", false));
      fail();
    } catch (R2Exception e) {
      assertEquals("BACKUP_DISABLED", e.code);
    }
    assertFalse(R2AutoBackup.constraints(new JSONObject()).requiresCharging());
    assertEquals(
        androidx.work.NetworkType.UNMETERED,
        R2AutoBackup.constraints(new JSONObject()).getRequiredNetworkType());
    assertEquals(
        androidx.work.NetworkType.CONNECTED,
        R2AutoBackup.constraints(new JSONObject().put("wifiOnly", false)).getRequiredNetworkType());
  }

  static class DeletionCloud extends Cloud {
    final java.util.List<String> deleted = new java.util.ArrayList<>();
    boolean wrongHash = false, durable = false, failPreview = false;

    @Override
    public JSONObject head(String key) throws Exception {
      if (deleted.contains(key)) throw new R2Exception("OBJECT_NOT_FOUND");
      return new JSONObject().put("sha256", wrongHash ? "0".repeat(64) : "c".repeat(64));
    }

    @Override
    public void delete(String key) {
      assertTrue("Tombstone must be durable before cloud deletion", durable);
      if (failPreview && key.contains("thumbnail"))
        throw new IllegalStateException("Synthetic outage");
      deleted.add(key);
    }
  }

  @Test
  public void failedTombstonePublicationCannotDeleteOriginals() throws Exception {
    try (R2LibraryStore store = new R2LibraryStore(R2TripQueueTest.repository())) {
      JSONObject r = record().put("state", "trashed");
      store.put(r, true);
      DeletionCloud cloud = new DeletionCloud();
      try {
        R2Library.purge(
            store,
            r.getString("id"),
            cloud,
            value -> {
              throw new R2Exception("NETWORK_UNAVAILABLE");
            });
        fail();
      } catch (R2Exception expected) {
      }
      assertTrue(cloud.deleted.isEmpty());
      assertTrue(store.get(r.getString("id")).getBoolean("cleanupPending"));
    }
  }

  @Test
  public void cleanupRejectsChangedRemoteBytesAndNeverDeletesActiveFiles() throws Exception {
    try (R2LibraryStore store = new R2LibraryStore(R2TripQueueTest.repository())) {
      JSONObject r = record();
      store.put(r, true);
      DeletionCloud cloud = new DeletionCloud();
      try {
        R2Library.purge(store, r.getString("id"), cloud, value -> {});
        fail();
      } catch (R2Exception e) {
        assertEquals("LIBRARY_DELETE_NOT_ALLOWED", e.code);
      }
      store.put(R2Library.revise(r, "trashed"), true);
      cloud.wrongHash = true;
      try {
        R2Library.purge(store, r.getString("id"), cloud, value -> cloud.durable = true);
        fail();
      } catch (R2Exception e) {
        assertEquals("INTEGRITY_FAILED", e.code);
      }
      assertTrue(cloud.deleted.isEmpty());
    }
  }

  @Test
  public void interruptedPurgeRetriesOnlyRemainingManagedObjects() throws Exception {
    try (R2LibraryStore store = new R2LibraryStore(R2TripQueueTest.repository())) {
      JSONObject r =
          record()
              .put("state", "trashed")
              .put("thumbnailKey", "encrypted/previews/thumbnail.atlas")
              .put("thumbnailSha256", "c".repeat(64));
      store.put(r, true);
      DeletionCloud cloud = new DeletionCloud();
      cloud.failPreview = true;
      try {
        R2Library.purge(store, r.getString("id"), cloud, value -> cloud.durable = true);
        fail();
      } catch (IllegalStateException expected) {
      }
      assertEquals(java.util.List.of(r.getString("key")), cloud.deleted);
      assertTrue(store.get(r.getString("id")).getBoolean("cleanupPending"));
      cloud.failPreview = false;
      R2Library.purge(store, r.getString("id"), cloud, value -> cloud.durable = true);
      assertEquals(2, cloud.deleted.size());
      assertEquals("deleted", store.get(r.getString("id")).getString("state"));
      assertFalse(store.get(r.getString("id")).getBoolean("cleanupPending"));
    }
  }
}
