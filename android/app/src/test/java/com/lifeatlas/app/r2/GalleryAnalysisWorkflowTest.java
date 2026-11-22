package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

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
public class GalleryAnalysisWorkflowTest {
  @Test
  public void retryJournalIsVersionedAndPriorityIsDeduplicated() throws Exception {
    JSONObject state = new JSONObject();
    GalleryAnalysisHealth.completed(state, "image:external:1", "a", true);
    assertEquals("a", GalleryAnalysisHealth.failures(state).getString("image:external:1"));
    GalleryAnalysisHealth.enqueue(state, "image:external:1", "a", false);
    GalleryAnalysisHealth.enqueue(state, "image:external:2", "b", false);
    assertFalse(GalleryAnalysisHealth.enqueue(state, "image:external:2", "new-version", true));
    assertEquals(2, GalleryAnalysisHealth.queue(state).length());
    assertEquals(
        "image:external:2", GalleryAnalysisHealth.queue(state).getJSONObject(0).getString("id"));
    GalleryAnalysisHealth.completed(state, "image:external:2", "b", false);
    assertEquals(2, GalleryAnalysisHealth.queue(state).length());
    GalleryAnalysisHealth.completed(state, "image:external:1", "a", false);
    assertEquals(0, GalleryAnalysisHealth.failures(state).length());
    assertEquals(1, GalleryAnalysisHealth.queue(state).length());
  }

  @Test
  public void priorityRequestDoesNotEnablePausedAnalysisOrRerunCurrentPhotos() throws Exception {
    R2DeviceGalleryTest f = new R2DeviceGalleryTest();
    f.setup();
    var service = new GalleryIntelligence(RuntimeEnvironment.getApplication(), f.repo.store);
    service.writeSettings(new JSONObject().put("enabled", false).put("state", "paused"));
    assertEquals(
        "paused",
        GalleryAnalysisHealth.request(service, "image:external:42", false).getString("reason"));
    service.writeSettings(
        new JSONObject()
            .put("enabled", true)
            .put("state", "indexing")
            .put("epoch", "test")
            .put("ocr", true)
            .put("albums", new JSONArray()));
    var media = f.gallery.one("image:external:42");
    try (var db = new GallerySearchStore(f.repo.store)) {
      db.put(
          new JSONObject()
              .put("media", media)
              .put("stamp", R2DeviceGallery.stamp(media))
              .put("ocrDone", true)
              .put("ocrVersion", GalleryIntelligence.OCR_VERSION));
    }
    assertEquals(
        "current",
        GalleryAnalysisHealth.request(service, "image:external:42", false).getString("reason"));
    assertEquals(
        1, GalleryAnalysisHealth.request(service, "image:external:43", false).getInt("queued"));
    try (var db = new GallerySearchStore(f.repo.store)) {
      assertEquals(1, GalleryAnalysisHealth.queue(GalleryAnalysisHealth.read(db)).length());
    }
  }

  @Test
  public void priorityRunPreservesTheBulkScanCursor() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    androidx.work.testing.WorkManagerTestInitHelper.initializeTestWorkManager(context);
    var fixture = new R2DeviceGalleryTest();
    fixture.setup();
    var service = new GalleryIntelligence(context, fixture.repo.store);
    service.writeSettings(
        new JSONObject()
            .put("enabled", true)
            .put("state", "ready")
            .put("epoch", "priority-test")
            .put("chargingOnly", true)
            .put("ocr", true)
            .put("since", 123000)
            .put("cursor", "preserved-cursor")
            .put("albums", new JSONArray()));
    assertEquals(
        1, GalleryAnalysisHealth.request(service, "image:external:42", false).getInt("queued"));
    assertTrue(service.settings().optBoolean("targeted"));
    assertEquals("preserved-cursor", service.settings().getString("cursor"));
    assertEquals(123000, service.settings().getLong("since"));
    assertEquals(
        1,
        androidx.work.WorkManager.getInstance(context)
            .getWorkInfosByTag(GalleryIntelligence.WORK)
            .get()
            .size());
  }

  @Test
  public void retryFailureStateStartsANewEpochWithoutResettingRecords() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    androidx.work.testing.WorkManagerTestInitHelper.initializeTestWorkManager(context);
    var fixture = new R2DeviceGalleryTest();
    fixture.setup();
    var service = new GalleryIntelligence(context, fixture.repo.store);
    service.writeSettings(
        new JSONObject()
            .put("enabled", true)
            .put("state", "error")
            .put("epoch", "failed-epoch")
            .put("chargingOnly", true)
            .put("ocr", true)
            .put("since", 123)
            .put("cursor", "same-cursor")
            .put("albums", new JSONArray()));
    try (var db = new GallerySearchStore(fixture.repo.store)) {
      var state = new JSONObject();
      GalleryAnalysisHealth.completed(
          state,
          "image:external:42",
          R2DeviceGallery.stamp(fixture.gallery.one("image:external:42")),
          true);
      db.choice(GalleryAnalysisHealth.KEY, state);
    }
    GalleryAnalysisHealth.request(service, "", true);
    assertNotEquals("failed-epoch", service.settings().getString("epoch"));
    assertEquals("same-cursor", service.settings().getString("cursor"));
    assertEquals(123, service.settings().getLong("since"));
  }

  @Test
  public void completionSummaryAvoidsFaceCropsOnPhotoOpen() throws Exception {
    var fixture = new R2DeviceGalleryTest();
    fixture.setup();
    var media = fixture.gallery.one("image:external:42");
    var row =
        new JSONObject()
            .put("media", media)
            .put("stamp", R2DeviceGallery.stamp(media))
            .put("ocrDone", true)
            .put("ocrVersion", GalleryIntelligence.OCR_VERSION)
            .put("quality", GalleryCollectionsTest.quality(0, 50))
            .put("faceVersion", GalleryFaceModels.VERSION)
            .put("faceQualityVersion", GalleryFaceQuality.VERSION)
            .put(
                "faces",
                new JSONArray()
                    .put(
                        new JSONObject().put("id", "test-face").put("crop", "private crop bytes")));
    try (var db = new GallerySearchStore(fixture.repo.store)) {
      db.put(row);
      var summary = db.readiness(media.getString("id"));
      assertFalse(summary.has("faces"));
      assertFalse(summary.getJSONObject("quality").has("samples"));
      assertTrue(
          GalleryIntelligenceWorker.current(
              summary,
              media,
              new JSONObject().put("ocr", true).put("people", true).put("similar", true)));
    }
  }

  @Test
  public void metricsRemainAggregateLocalAndDoNotDirtyRecovery() throws Exception {
    var repo = R2TripQueueTest.repository();
    var service = new GalleryIntelligence(RuntimeEnvironment.getApplication(), repo.store);
    long revision;
    try (var db = new GallerySearchStore(repo.store)) {
      revision = db.revision();
    }
    GalleryAnalysisHealth.metric(service, "search-text", 40);
    GalleryAnalysisHealth.metric(service, "search-text", 60);
    GalleryAnalysisHealth.metric(service, "private search words", 10);
    try (var db = new GallerySearchStore(repo.store)) {
      JSONObject metrics = db.choice("analysis-metrics-v1");
      assertEquals(1, metrics.length());
      var row = metrics.getJSONObject("search-text");
      assertEquals(2, row.getInt("count"));
      assertEquals(100, row.getLong("totalMs"));
      assertEquals(revision, db.revision());
    }
    assertFalse(GalleryRecovery.CHOICES.contains("analysis-metrics-v1"));
    assertFalse(GalleryRecovery.CHOICES.contains(GalleryAnalysisHealth.KEY));
  }

  @Test
  public void metadataVerificationOnlyReadsAndPreservesLiveChoices() throws Exception {
    var store =
        new R2PlaceBackupTest.Store() {
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
            return super.request(method, key, query, headers, body, progress);
          }
        };
    byte[] keys = R2Crypto.newKeyset();
    String hash = "a".repeat(64),
        snapshot = GalleryRecovery.prefix(keys) + "snapshots/one.atlas",
        photoKey = GalleryRecovery.prefix(keys) + "photos/one.atlas";
    var photo =
        new JSONObject()
            .put("format", "life-atlas-gallery-photo")
            .put("version", 1)
            .put("hash", hash)
            .put(
                "row",
                new JSONObject()
                    .put("stamp", "same")
                    .put("media", new JSONObject().put("id", "image:external:42")));
    var manifest =
        new JSONObject()
            .put("format", "life-atlas-gallery-analysis")
            .put("version", 1)
            .put("choices", new JSONObject())
            .put(
                "photos",
                new JSONArray().put(new JSONObject().put("hash", hash).put("key", photoKey)));
    store.files.put(snapshot, GalleryRecovery.encode(manifest, keys, snapshot));
    store.files.put(photoKey, GalleryRecovery.encode(photo, keys, photoKey));
    var repo = R2TripQueueTest.repository();
    try (var db = new GallerySearchStore(repo.store)) {
      db.choice("people", new JSONObject().put("owner", "unchanged"));
      long revision = db.revision();
      assertEquals(
          1,
          GalleryRecovery.verifySnapshot(store, keys, snapshot, () -> false, (done, total) -> {}));
      assertEquals("unchanged", db.choice("people").getString("owner"));
      assertEquals(revision, db.revision());
      assertEquals(0, db.choice("recovery-staged").length());
    }
    byte[] corrupt = store.files.get(photoKey).clone();
    corrupt[corrupt.length - 1] ^= 1;
    store.files.put(photoKey, corrupt);
    try {
      GalleryRecovery.verifySnapshot(store, keys, snapshot, () -> false, (done, total) -> {});
      fail("tampered record");
    } catch (Exception expected) {
    }
    try {
      GalleryRecovery.verifySnapshot(store, keys, snapshot, () -> true, (done, total) -> {});
      fail("cancelled");
    } catch (java.io.InterruptedIOException expected) {
    }
  }
}
