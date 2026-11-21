package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import android.graphics.Bitmap;
import java.nio.charset.StandardCharsets;
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
public class GalleryCollectionsTest {
  static JSONObject quality(long hash, double score) throws Exception {
    JSONArray samples = new JSONArray();
    for (int i = 0; i < 64; i++) samples.put(100);
    return new JSONObject()
        .put("version", GalleryPhotoQuality.VERSION)
        .put("h", Long.toUnsignedString(hash, 16))
        .put("v", "0")
        .put("score", score)
        .put("sharpness", 80)
        .put("aspect", 1.5)
        .put("samples", samples)
        .put("color", new JSONArray(List.of(.5, .5, .5)));
  }

  static GalleryIndexedPhotos.Photo photo(String id, long hash, double score, long time)
      throws Exception {
    return new GalleryIndexedPhotos.Photo(id, "source-v1", time, quality(hash, score), List.of());
  }

  static float[] vector(int coordinate) {
    float[] v = new float[128];
    v[coordinate] = 1;
    return v;
  }

  static GalleryIndexedPhotos.Photo portrait(String photo, String face, float[] vector, long time) {
    return new GalleryIndexedPhotos.Photo(
        photo, "v1", time, null, List.of(new GalleryIndexedPhotos.Face(face, photo, vector, time)));
  }

  @Test
  public void burstGroupsDoNotChainAcrossDifferentScenesAndPicksAreManual() throws Exception {
    List<GalleryIndexedPhotos.Photo> photos =
        List.of(
            photo("a", 0, 30, 1000),
            photo("b", 255, 90, 2000),
            photo("c", 65535, 40, 3000),
            photo("d", 65535, 70, 4000));
    GalleryIndexedPhotos index = new GalleryIndexedPhotos(photos);
    JSONObject choices = new JSONObject();
    GallerySimilar similar = new GallerySimilar(index, choices);
    assertEquals(2, similar.groups.size());
    GallerySimilar.Group first =
        similar.groups.stream()
            .filter(g -> g.photos.stream().anyMatch(p -> p.id.equals("a")))
            .findFirst()
            .orElseThrow();
    assertEquals("b", first.best);
    assertEquals("", first.pick);
    assertEquals(2, first.photos.size());
    GallerySimilar.edit(choices, first, "pick", "a");
    assertEquals("a", new GallerySimilar(index, choices).group(first.key).pick);
    GallerySimilar.edit(choices, first, "separate-photo", "a");
    assertEquals(1, new GallerySimilar(index, choices).groups.size());
    assertEquals(4, index.photos.size());
    JSONObject dismissed = new JSONObject();
    GallerySimilar.edit(dismissed, first, "dismiss-similar", "");
    assertEquals(1, new GallerySimilar(index, dismissed).groups.size());
    assertEquals(4, index.photos.size());
  }

  @Test
  public void progressLivesInASmallEncryptedRecordAndSharedStorageIsNotRewritten()
      throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    repo.store.edit(
        root ->
            root.put(
                GalleryIntelligence.KEY,
                new JSONObject().put("enabled", true).put("epoch", "test-epoch").put("ocr", true)));
    GalleryIntelligence service =
        new GalleryIntelligence(RuntimeEnvironment.getApplication(), repo.store);
    assertEquals("test-epoch", service.settings().getString("epoch"));
    assertFalse(repo.store.snapshot().has(GalleryIntelligence.KEY));
    java.nio.file.Path path = new java.io.File(repo.store.directory(), "secure-state").toPath();
    byte[] before = java.nio.file.Files.readAllBytes(path);
    for (int i = 0; i < 20; i++) {
      final int count = i;
      service.change(
          "test-epoch",
          v -> {
            try {
              v.put("scanned", count);
            } catch (JSONException e) {
              throw new RuntimeException(e);
            }
          });
    }
    assertArrayEquals(before, java.nio.file.Files.readAllBytes(path));
    assertEquals(19, service.settings().getInt("scanned"));
    assertEquals(3, repo.store.snapshot().getJSONObject("selections").length());
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      JSONObject row =
          new JSONObject()
              .put("media", new JSONObject().put("id", "image:external:1"))
              .put("stamp", "v1")
              .put("quality", quality(0, 50))
              .put("text", "large private OCR")
              .put(
                  "faces",
                  new JSONArray()
                      .put(
                          new JSONObject()
                              .put("id", "face")
                              .put("embedding", new JSONArray(List.of(.1, .2)))
                              .put("crop", "private-crop")))
              .put("faceVersion", GalleryFaceModels.VERSION);
      db.put(row);
      try (android.database.Cursor c = db.summaryRows()) {
        assertTrue(c.moveToFirst());
        JSONObject summary = db.readSummary(c.getString(0), c.getBlob(1));
        assertFalse(summary.has("text"));
        assertFalse(summary.getJSONArray("faces").getJSONObject(0).has("crop"));
        assertTrue(summary.has("quality"));
      }
    }
  }

  @Test
  public void completeNativeCollectionFlowKeepsBiometricDataInsideTheNativeLayer()
      throws Exception {
    R2DeviceGalleryTest fixture = new R2DeviceGalleryTest();
    fixture.setup();
    GalleryIntelligence service =
        new GalleryIntelligence(RuntimeEnvironment.getApplication(), fixture.repo.store);
    service.writeSettings(
        new JSONObject().put("people", true).put("similar", true).put("albums", new JSONArray()));
    String firstFace = "";
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      for (int i = 42; i <= 43; i++) {
        JSONObject media = fixture.gallery.one("image:external:" + i);
        String faceId = GallerySearchStore.token(media.getString("id")) + ".0.0123456789abcdef";
        if (i == 42) firstFace = faceId;
        JSONArray vector = new JSONArray();
        for (float value : vector(0)) vector.put((double) value);
        db.put(
            new JSONObject()
                .put("media", media)
                .put("stamp", R2DeviceGallery.stamp(media))
                .put("faceVersion", GalleryFaceModels.VERSION)
                .put("quality", quality(0, i))
                .put(
                    "faces",
                    new JSONArray()
                        .put(
                            new JSONObject()
                                .put("id", faceId)
                                .put("embedding", vector)
                                .put("crop", "cHJpdmF0ZQ=="))));
      }
    }
    GalleryCollections api =
        new GalleryCollections(RuntimeEnvironment.getApplication(), service, fixture.gallery);
    JSONObject page = api.list("people", "");
    JSONArray people = page.getJSONArray("collections");
    assertEquals(1, people.length());
    String key = people.getJSONObject(0).getString("id");
    assertFalse(page.toString().contains("embedding"));
    assertFalse(page.toString().contains("cHJpdmF0ZQ"));
    api.edit(
        new JSONObject()
            .put("action", "name-person")
            .put("key", key)
            .put("name", "Confirmed name"));
    JSONObject named = api.list("people", "").getJSONArray("collections").getJSONObject(0);
    assertTrue(named.getBoolean("confirmed"));
    assertEquals("Confirmed name", named.getString("title"));
    assertEquals(2, api.media("people", named.getString("id"), "").getJSONArray("items").length());
    assertTrue(
        api.thumbnail(firstFace).getString("thumbnail").startsWith("data:image/jpeg;base64,"));
    api.edit(
        new JSONObject()
            .put("action", "exclude-face")
            .put("key", named.getString("id"))
            .put("faceId", firstFace));
    try {
      api.thumbnail(firstFace);
      fail("A discarded face crop must no longer be served");
    } catch (R2Exception expected) {
    }
    assertEquals(
        1, api.list("people", "").getJSONArray("collections").getJSONObject(0).getInt("count"));
    api.edit(new JSONObject().put("action", "undo-people"));
    assertEquals(
        2, api.list("people", "").getJSONArray("collections").getJSONObject(0).getInt("count"));
    assertTrue(
        api.thumbnail(firstFace).getString("thumbnail").startsWith("data:image/jpeg;base64,"));
  }

  @Test
  public void fingerprintsAreStableAndBlankImagesDoNotBecomeFalseDuplicateGroups()
      throws Exception {
    Bitmap b = Bitmap.createBitmap(120, 80, Bitmap.Config.ARGB_8888);
    b.eraseColor(0xff808080);
    JSONObject media = new JSONObject().put("width", 120).put("height", 80),
        a = GalleryPhotoQuality.analyze(b, media),
        copy = GalleryPhotoQuality.analyze(b, media);
    assertEquals(0, GalleryPhotoQuality.distance(a, copy));
    assertEquals(0, a.getDouble("sharpness"), .0001);
    assertFalse(GalleryPhotoQuality.similar(a, copy, 1000, 2000));
    b.recycle();
  }

  @Test
  public void samePhotoFacesNeverMergeAndAmbiguousMatchesStaySeparate() throws Exception {
    float[] ambiguous = new float[128];
    ambiguous[0] = ambiguous[1] = (float) (1 / Math.sqrt(2));
    GalleryIndexedPhotos index =
        new GalleryIndexedPhotos(
            List.of(portrait("image1", "a", vector(0), 1), portrait("image1", "b", vector(0), 2)));
    assertEquals(2, new GalleryPeople(index, new JSONObject()).groups.size());
    index =
        new GalleryIndexedPhotos(
            List.of(
                portrait("one", "a", vector(0), 1),
                portrait("two", "b", vector(1), 2),
                portrait("three", "c", ambiguous, 3)));
    assertEquals(3, new GalleryPeople(index, new JSONObject()).groups.size());
  }

  @Test
  public void namesRequireConfirmationAndNewMatchesNeverSilentlyJoinNamedPeople() throws Exception {
    List<GalleryIndexedPhotos.Photo> seed =
        new ArrayList<>(
            List.of(portrait("one", "a", vector(0), 1), portrait("two", "b", vector(0), 2)));
    JSONObject choices = new JSONObject();
    GalleryPeople people = new GalleryPeople(new GalleryIndexedPhotos(seed), choices);
    assertEquals(1, people.groups.size());
    assertFalse(people.groups.get(0).confirmed);
    people.edit(choices, "name-person", people.groups.get(0).id, "", "", "A name I chose");
    seed.add(portrait("three", "c", vector(0), 3));
    people = new GalleryPeople(new GalleryIndexedPhotos(seed), choices);
    assertEquals(2, people.groups.size());
    GalleryPeople.Group
        named = people.groups.stream().filter(g -> g.confirmed).findFirst().orElseThrow(),
        proposal = people.groups.stream().filter(g -> !g.confirmed).findFirst().orElseThrow();
    assertEquals(2, named.photos.size());
    assertEquals(named.id, proposal.suggestedPersonId);
    people.edit(choices, "confirm-person-match", proposal.id, "", named.id, "");
    people = new GalleryPeople(new GalleryIndexedPhotos(seed), choices);
    assertEquals(1, people.groups.size());
    assertEquals(3, people.groups.get(0).photos.size());
    people.edit(choices, "separate-face", people.groups.get(0).id, "c", "", "");
    people = new GalleryPeople(new GalleryIndexedPhotos(seed), choices);
    assertEquals(2, people.groups.size());
    assertFalse(people.summaries().toString().contains("embedding"));
    assertFalse(people.summaries().toString().contains("crop"));
  }

  @Test
  public void faceEnrollmentCannotBeEnabledByOrdinaryAnalysisApproval() throws Exception {
    JSONObject input = new JSONObject().put("people", true);
    try {
      GalleryIntelligence.validatePeopleConsent(input, new JSONObject());
      fail("Explicit face consent required");
    } catch (R2Exception e) {
      assertEquals("PEOPLE_CONSENT_REQUIRED", e.code);
    }
    input.put("peopleApproved", true);
    GalleryIntelligence.validatePeopleConsent(input, new JSONObject());
    input.remove("peopleApproved");
    GalleryIntelligence.validatePeopleConsent(input, new JSONObject().put("people", true));
  }

  @Test
  public void peopleDataIsEncryptedAndForgetKeepsOtherAnalysisAndOriginalSelections()
      throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    JSONObject media = new JSONObject().put("id", "image:external:42");
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      db.put(
          new JSONObject()
              .put("media", media)
              .put("text", "English OCR")
              .put("quality", quality(4, 80))
              .put("faceVersion", GalleryFaceModels.VERSION)
              .put(
                  "faces",
                  new JSONArray()
                      .put(
                          new JSONObject()
                              .put("embedding", new JSONArray(List.of(.3, .4)))
                              .put("crop", "private-face-crop"))));
      db.choice(
          "people",
          new JSONObject().put("people", new JSONObject().put("person", "Private confirmed name")));
      assertEquals(
          "Private confirmed name",
          db.choice("people").getJSONObject("people").getString("person"));
    }
    byte[] bytes =
        java.nio.file.Files.readAllBytes(
            new java.io.File(repo.store.directory(), "gallery-search.db").toPath());
    String disk = new String(bytes, StandardCharsets.ISO_8859_1);
    assertFalse(disk.contains("Private confirmed name"));
    assertFalse(disk.contains("private-face-crop"));
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      GalleryPeople.forget(db);
      JSONObject row = db.get("image:external:42");
      assertFalse(row.has("faces"));
      assertFalse(row.has("faceVersion"));
      assertTrue(row.has("quality"));
      assertEquals("English OCR", row.getString("text"));
      assertEquals(0, db.choice("people").length());
    }
    assertEquals(3, repo.store.snapshot().getJSONObject("selections").length());
  }

  @Test
  public void anniversariesUseCaptureDatesAndPhoneTimezoneNotImportDates() throws Exception {
    TimeZone zone = TimeZone.getTimeZone("Asia/Kolkata");
    long now = java.time.Instant.parse("2026-11-20T08:00:00Z").toEpochMilli();
    long past = java.time.Instant.parse("2025-11-20T04:00:00Z").toEpochMilli();
    assertTrue(
        GallerySmartAlbums.keys(past, false, "Camera", "photo.jpg", now, zone)
            .contains("memory:2025-11-20"));
    assertFalse(
        GallerySmartAlbums.keys(0, false, "Camera", "photo.jpg", now, zone).stream()
            .anyMatch(s -> s.startsWith("memory:")));
    long nearMidnight = java.time.Instant.parse("2025-11-20T23:30:00Z").toEpochMilli();
    assertFalse(
        GallerySmartAlbums.keys(nearMidnight, false, "Camera", "photo.jpg", now, zone)
            .contains("memory:2025-11-20"));
    assertTrue(
        GallerySmartAlbums.keys(0, true, "Camera", "clip.mp4", now, zone).contains("videos"));
    assertTrue(
        GallerySmartAlbums.keys(0, false, "Screenshots", "capture.png", now, zone)
            .contains("screenshots"));
    GallerySmartAlbums.Filter filter = GallerySmartAlbums.filter("memory:2025-11-20", now, zone);
    assertTrue(
        past >= Long.parseLong(filter.args.get(0)) && past < Long.parseLong(filter.args.get(1)));
    try {
      GallerySmartAlbums.filter("anything;DELETE", now, zone);
      fail("Only fixed album rules accepted");
    } catch (R2Exception expected) {
    }
  }

  @Test
  public void faceAlignmentAndDetectorNmsFollowThePinnedModelContract() throws Exception {
    float[] points = new float[10];
    for (int i = 0; i < 5; i++) {
      points[2 * i] = GalleryFaceModels.CANONICAL[i][0] * 2 + 10;
      points[2 * i + 1] = GalleryFaceModels.CANONICAL[i][1] * 2 + 20;
    }
    double[] matrix = GalleryFaceModels.transform(points);
    assertEquals(.5, matrix[0], 1e-5);
    assertEquals(0, matrix[1], 1e-5);
    assertEquals(-5, matrix[2], 1e-4);
    assertEquals(-10, matrix[3], 1e-4);
    Map<String, float[][]> outputs = new HashMap<>();
    for (int s : new int[] {8, 16, 32}) {
      int n = (640 / s) * (640 / s);
      outputs.put("cls_" + s, new float[n][1]);
      outputs.put("obj_" + s, new float[n][1]);
      outputs.put("bbox_" + s, new float[n][4]);
      outputs.put("kps_" + s, new float[n][10]);
    }
    int first = 20 * 80 + 30, second = first + 1;
    for (int i : new int[] {first, second}) {
      outputs.get("cls_8")[i][0] = 1;
      outputs.get("obj_8")[i][0] = 1;
      outputs.get("bbox_8")[i][2] = outputs.get("bbox_8")[i][3] = (float) Math.log(4);
    }
    outputs.get("bbox_8")[second][0] = -1;
    assertEquals(1, GalleryFaceModels.decode(outputs, 640).size());
    assertEquals(32, GalleryFaceModels.decode(outputs, 640).get(0).bounds[2], 1e-4);
  }
}
