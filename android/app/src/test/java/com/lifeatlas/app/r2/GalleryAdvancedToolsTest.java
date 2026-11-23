package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import android.content.*;
import android.content.pm.ServiceInfo;
import java.io.*;
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
public class GalleryAdvancedToolsTest {
  @Test
  public void nativeViewerIsPrivateAndRejectsUntrustedIdentifiers() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    var info =
        context
            .getPackageManager()
            .getActivityInfo(new ComponentName(context, GalleryNativeViewerActivity.class), 0);
    assertFalse(info.exported);
    assertEquals(
        2,
        GalleryNativeViewerActivity.validate(
                new ArrayList<>(List.of("image:external:42", "video:external:43")))
            .size());
    for (String invalid :
        List.of(
            "file:///data/private.jpg",
            "https://example.com/a.jpg",
            "image:external:0",
            "image:../:1")) {
      try {
        GalleryNativeViewerActivity.validate(new ArrayList<>(List.of(invalid)));
        fail("untrusted URI");
      } catch (IllegalArgumentException expected) {
      }
    }
    try {
      GalleryNativeViewerActivity.validate(
          new ArrayList<>(List.of("image:external:42", "image:external:42")));
      fail("duplicate");
    } catch (IllegalArgumentException expected) {
    }
  }

  @Test
  public void previewSettingsUsePhysicalPixelBucketsAndRespectCaps() throws Exception {
    var balanced = new GalleryPreviewSettings(new JSONObject());
    assertEquals(92, balanced.quality);
    assertEquals(384, balanced.edge(300));
    assertEquals(1280, balanced.edge(99999));
    var saver =
        new GalleryPreviewSettings(
            new JSONObject().put("previewQuality", 80).put("previewMaxEdge", 768));
    assertEquals(256, saver.edge(-1));
    assertEquals(768, saver.edge(2048));
    assertEquals(80, saver.quality);
  }

  @Test
  public void previewPruningTracksEachDirectoryAndBoundsFastWriteBursts() throws Exception {
    File parent =
        new File(RuntimeEnvironment.getApplication().getCacheDir(), "prune-" + UUID.randomUUID());
    File first = new File(parent, "first"), second = new File(parent, "second");
    first.mkdirs();
    second.mkdirs();
    File a = new File(first, "a.jpg"),
        b = new File(second, "b.jpg"),
        keep = new File(second, "keep.jpg");
    try (RandomAccessFile file = new RandomAccessFile(a, "rw")) {
      file.setLength(1);
    }
    try (RandomAccessFile file = new RandomAccessFile(b, "rw")) {
      file.setLength(1);
    }
    try (RandomAccessFile file = new RandomAccessFile(keep, "rw")) {
      file.setLength(1);
    }
    GalleryPreviewSettings.pruneIfDue(first, 0, a);
    GalleryPreviewSettings.pruneIfDue(second, 1, keep);
    assertFalse(b.exists());
    assertTrue(keep.exists());
    File large = new File(second, "large.jpg");
    try (RandomAccessFile file = new RandomAccessFile(large, "rw")) {
      file.setLength(4L * 1024 * 1024);
    }
    GalleryPreviewSettings.pruneIfDue(second, 4L * 1024 * 1024, large);
    assertFalse(keep.exists());
    assertTrue(large.exists());
  }

  @Test
  public void cacheCategoryBudgetsAgreeWithTheGenerators() {
    assertEquals(32L * 1024 * 1024, GalleryMediaTools.categoryLimit("device-gallery", 32));
    assertEquals(16L * 1024 * 1024, GalleryMediaTools.categoryLimit("gallery-filmstrip", 32));
    assertEquals(64L * 1024 * 1024, GalleryMediaTools.categoryLimit("gallery-motion", 32));
  }

  @Test
  public void qualityChangesKeepCacheLimitAndReportOnlyRebuildableFiles() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    var repo = R2TripQueueTest.repository();
    GalleryMediaTools.cacheSettings(
        context,
        repo.store,
        new JSONObject().put("limitMiB", 32).put("previewQuality", 98).put("previewMaxEdge", 2560));
    GalleryMediaTools.cacheSettings(context, repo.store, new JSONObject().put("limitMiB", 64));
    var report = GalleryMediaTools.cacheReport(context, repo.store);
    assertEquals(64, report.getInt("limitMiB"));
    assertEquals(98, report.getInt("previewQuality"));
    assertEquals(2560, report.getInt("previewMaxEdge"));
    assertTrue(report.getJSONObject("categories").has("gallery-filmstrip"));
    for (var invalid :
        List.of(
            new JSONObject().put("previewQuality", 100),
            new JSONObject().put("previewMaxEdge", 9999))) {
      try {
        GalleryMediaTools.cacheSettings(context, repo.store, invalid);
        fail("invalid setting");
      } catch (R2Exception expected) {
        assertEquals("INVALID_SELECTION", expected.code);
      }
    }
    assertEquals(98, GalleryPreviewSettings.read(repo.store).quality);
  }

  @Test
  public void searchRuntimeIsNotExportedAndCannotCrashTheActivityProcess() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    ServiceInfo info =
        context
            .getPackageManager()
            .getServiceInfo(new ComponentName(context, GallerySearchService.class), 0);
    assertFalse(info.exported);
    assertTrue(info.processName.endsWith(":gallery_search"));
    assertNotEquals(context.getApplicationInfo().processName, info.processName);
  }

  @Test
  public void subjectRuntimeIsPrivateAndSeparateFromTheActivity() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    ServiceInfo info =
        context
            .getPackageManager()
            .getServiceInfo(new ComponentName(context, GalleryExtractionService.class), 0);
    assertFalse(info.exported);
    assertTrue(info.processName.endsWith(":gallery_extraction"));
    assertNotEquals(context.getApplicationInfo().processName, info.processName);
  }

  @Test
  public void subjectExtractionWithoutAnExplicitGestureOrActionNeverStartsInference()
      throws Exception {
    try {
      GallerySubjectInference.extract(
          RuntimeEnvironment.getApplication(), new JSONObject().put("id", "image:external:1"));
      fail("Expected explicit extraction approval");
    } catch (R2Exception expected) {
      assertEquals("EXTRACTION_CONSENT_REQUIRED", expected.code);
    }
  }

  @Test
  public void cachedQueriesStayEncryptedAndAvoidStartingAnyRuntime() throws Exception {
    var repo = R2TripQueueTest.repository();
    float[] vector = new float[512];
    vector[0] = 1;
    JSONArray saved = new JSONArray();
    for (float value : vector) saved.put(value);
    String token = GallerySearchStore.token(GalleryClip.REVISION + ":my private query");
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      db.choice("query-vectors", new JSONObject().put(token, saved));
    }
    assertArrayEquals(
        vector,
        GallerySearchInference.query(
            RuntimeEnvironment.getApplication(), repo.store, "My private query", () -> false),
        0);
    String disk =
        new String(
            java.nio.file.Files.readAllBytes(
                new File(repo.store.directory(), "gallery-search.db").toPath()),
            java.nio.charset.StandardCharsets.ISO_8859_1);
    assertFalse(disk.contains("my private query"));
  }

  @Test
  public void allRotatedCropCornersRemainInsideSourceEvenWhenPanned() throws Exception {
    for (int angle : new int[] {-100, -90, -10, 0, 10, 90, 100, 180, 270})
      for (double aspect : new double[] {0, 1, .75, 16d / 9})
        for (double zoom : new double[] {1, 2, 3})
          for (double x : new double[] {0, .5, 1})
            for (double y : new double[] {0, .5, 1}) {
              GalleryEditGeometry g =
                  new GalleryEditGeometry(4000, 3000, angle, aspect, zoom, x, y);
              double c = Math.cos(Math.toRadians(angle)), s = Math.sin(Math.toRadians(angle));
              for (int sx : new int[] {-1, 1})
                for (int sy : new int[] {-1, 1}) {
                  double px = g.x + c * sx * g.width / 2 + s * sy * g.height / 2,
                      py = g.y - s * sx * g.width / 2 + c * sy * g.height / 2;
                  assertTrue(px >= -.0001 && px <= 4000.0001);
                  assertTrue(py >= -.0001 && py <= 3000.0001);
                }
            }
  }

  @Test
  public void separationRulesPreventRegroupingAndReferencesFollowConfirmedMerges()
      throws Exception {
    var index =
        new GalleryIndexedPhotos(
            List.of(
                GalleryCollectionsTest.portrait(
                    "one", "face-one", GalleryCollectionsTest.vector(0), 10),
                GalleryCollectionsTest.portrait(
                    "two", "face-two", GalleryCollectionsTest.vector(0), 20)));
    JSONObject choices =
        new JSONObject()
            .put("people", new JSONObject().put("a", "Me").put("b", "A separate person"))
            .put("assignments", new JSONObject().put("face-one", "a").put("face-two", "b"));
    GalleryPeople people = new GalleryPeople(index, choices);
    assertEquals(1, people.suggestions().size());
    people.edit(choices, "never-people", "a", "", "b", "");
    assertTrue(new GalleryPeople(index, choices).suggestions().isEmpty());
    people.edit(choices, "reference-face", "b", "face-two", "", "");
    assertEquals("face-two", choices.getJSONObject("references").getJSONArray("b").getString(0));
    GalleryPeople.alias(choices, "b", "a");
    assertEquals("face-two", choices.getJSONObject("references").getJSONArray("a").getString(0));
    JSONObject restored =
        GalleryRecovery.project(
            "people", choices, Map.of("face-one", "new-one", "face-two", "new-two"));
    assertEquals("new-two", restored.getJSONObject("references").getJSONArray("a").getString(0));
    assertFalse(restored.getJSONObject("neverTogether").toString().contains("face-one"));
  }

  @Test
  public void xmpMotionOffsetsAreBoundedAndDoNotAcceptExternalEntities() throws Exception {
    String xmp =
        "<x:xmpmeta xmlns:x='adobe:ns:meta/'"
            + " xmlns:GCamera='http://ns.google.com/photos/1.0/camera/'><item"
            + " GCamera:MicroVideoOffset='1234'/></x:xmpmeta>";
    assertEquals(1234, GalleryMotionPhoto.offset(xmp, 9999));
    assertEquals(0, GalleryMotionPhoto.offset(xmp, 100));
    assertEquals(
        0,
        GalleryMotionPhoto.offset("<!DOCTYPE x [<!ENTITY e SYSTEM 'file:///private'>]><x/>", 9999));
  }

  @Test
  public void cacheCleanupNeverTouchesOriginalsOrPendingEdits() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    var repo = R2TripQueueTest.repository();
    File photos = GalleryMediaTools.cache(context, "device-gallery"),
        edits = GalleryMediaTools.cache(context, "gallery-edits");
    File thumbnail = new File(photos, "synthetic.jpg"),
        original = new File(edits, "pending-edit.jpg");
    java.nio.file.Files.write(thumbnail.toPath(), new byte[100]);
    java.nio.file.Files.write(original.toPath(), new byte[150]);
    GalleryMediaTools.cacheSettings(
        context, repo.store, new JSONObject().put("limitMiB", 32).put("clear", true));
    assertFalse(thumbnail.exists());
    assertTrue(original.exists());
    assertEquals(32, GalleryMediaTools.cacheReport(context, repo.store).getInt("limitMiB"));
  }

  @Test
  public void hiddenAlbumsAreRecoverableAndDoNotDeletePhoneFiles() throws Exception {
    R2DeviceGalleryTest f = new R2DeviceGalleryTest();
    f.setup();
    byte[] before = java.nio.file.Files.readAllBytes(f.provider.original.toPath());
    var context = RuntimeEnvironment.getApplication();
    try (GallerySearchStore db = new GallerySearchStore(f.repo.store)) {
      String id =
          GalleryAlbums.edit(
                  context,
                  db,
                  new JSONObject()
                      .put("action", "create")
                      .put("name", "Family")
                      .put("ids", new JSONArray(List.of("image:external:42"))))
              .getString("id");
      GalleryAlbums.edit(context, db, new JSONObject().put("action", "hide").put("id", id));
      assertEquals(0, GalleryAlbums.snapshot(context, db).getJSONArray("collections").length());
      GalleryAlbums.edit(context, db, new JSONObject().put("action", "restore-hidden"));
      assertEquals(1, GalleryAlbums.snapshot(context, db).getJSONArray("collections").length());
    }
    assertArrayEquals(before, java.nio.file.Files.readAllBytes(f.provider.original.toPath()));
  }

  @Test
  @Config(sdk = 29)
  public void canonicalMediaStoreIdsKeepVideoPositionsAndOriginalLinks() throws Exception {
    R2DeviceGalleryTest fixture = new R2DeviceGalleryTest();
    fixture.setup();
    R2DeviceGalleryTest.Provider provider =
        new R2DeviceGalleryTest.Provider() {
          public android.database.Cursor query(
              android.net.Uri uri,
              String[] columns,
              String selection,
              String[] arguments,
              String order) {
            android.database.MatrixCursor rows = new android.database.MatrixCursor(columns);
            long id = arguments != null && arguments.length > 0 ? Long.parseLong(arguments[0]) : 42;
            boolean video = arguments != null && arguments.length > 1 && arguments[1].equals("3");
            Object[] values = new Object[columns.length];
            for (int i = 0; i < columns.length; i++)
              values[i] =
                  switch (columns[i]) {
                    case "_id" -> id;
                    case "volume_name" -> "external_primary";
                    case "_display_name" -> "Frame " + id + (video ? ".mp4" : ".jpg");
                    case "mime_type" -> video ? "video/mp4" : "image/jpeg";
                    case "media_type" -> video ? 3 : 1;
                    case "_size" -> 14;
                    case "date_added" -> 1000;
                    case "date_modified" -> 900;
                    case "duration" -> 4000;
                    case "width" -> 1920;
                    case "height" -> 1080;
                    default -> 0;
                  };
            rows.addRow(values);
            return rows;
          }
        };
    provider.original = fixture.provider.original;
    android.content.pm.ProviderInfo info = new android.content.pm.ProviderInfo();
    info.authority = "media";
    info.exported = true;
    provider.attachInfo(RuntimeEnvironment.getApplication(), info);
    org.robolectric.shadows.ShadowContentResolver.registerProviderInternal("media", provider);
    var context = RuntimeEnvironment.getApplication();
    GalleryMediaTools.videoState(
        context,
        fixture.repo.store,
        new JSONObject().put("id", "video:external:42").put("seconds", 2.5));
    assertEquals(
        2.5,
        GalleryMediaTools.viewer(context, fixture.repo.store, "video:external:42")
            .getDouble("position"),
        0);
    JSONObject edited = new R2DeviceGallery(context).one("image:external:42"),
        original = new R2DeviceGallery(context).one("image:external:43");
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      db.choice(
          "edits",
          new JSONObject()
              .put(
                  edited.getString("id") + "|" + R2DeviceGallery.stamp(edited),
                  new JSONObject()
                      .put(
                          "originalKey",
                          original.getString("id") + "|" + R2DeviceGallery.stamp(original))
                      .put("recipe", new JSONObject())));
    }
    assertEquals(
        "image:external_primary:43",
        GalleryMediaTools.viewer(context, fixture.repo.store, "image:external:42")
            .getJSONObject("original")
            .getString("id"));
  }
}
