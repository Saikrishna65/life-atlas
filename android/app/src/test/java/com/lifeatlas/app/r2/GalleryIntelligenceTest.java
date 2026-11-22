package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import android.database.sqlite.SQLiteDatabase;
import android.graphics.Bitmap;
import java.io.*;
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
public class GalleryIntelligenceTest {
  @Test
  public void selectedPhotoPermissionCanAnalyzeOnlyWhatMediaStoreExposes() throws Exception {
    JSONObject selected = R2GalleryAccess.describe(34, false, false, false, true);
    assertFalse(selected.getBoolean("images"));
    assertTrue(R2GalleryAccess.canAnalyze(selected));
    assertFalse(
        R2GalleryAccess.canAnalyze(R2GalleryAccess.describe(34, false, false, true, false)));
    assertFalse(
        R2GalleryAccess.canAnalyze(R2GalleryAccess.describe(34, false, false, false, false)));
    assertTrue(R2GalleryAccess.canAnalyze(R2GalleryAccess.describe(28, true, false, false, false)));
  }

  @Test
  public void tokenizerMatchesOpenAiReferenceIncludingUnicodeAndWhitespace() throws Exception {
    GalleryClipTokenizer t =
        new GalleryClipTokenizer(
            RuntimeEnvironment.getApplication().getAssets().open("gallery-models/clip-merges.txt"));
    assertArrayEquals(
        new long[] {49406, 320, 1125, 539, 14191, 5873, 49407},
        t.encode("a photo of snowy mountains"));
    assertArrayEquals(new long[] {49406, 1574, 10469, 49407}, t.encode("  FRIENDS   outdoors  "));
    assertArrayEquals(
        new long[] {49406, 320, 1929, 267, 320, 2368, 256, 49407}, t.encode("a dog, a cat!"));
    assertArrayEquals(
        new long[] {49406, 3941, 525, 518, 2117, 536, 3424, 49407},
        t.encode("walking on the beach at sunset"));
    assertArrayEquals(
        new long[] {49406, 2617, 20145, 3274, 6152, 49407}, t.encode("Munnar tea gardens"));
    assertArrayEquals(
        new long[] {49406, 29446, 26721, 26774, 13343, 3124, 110, 37299, 49407},
        t.encode("हिमालय"));
    long[] truncated = t.encode("mountains ".repeat(200));
    assertEquals(77, truncated.length);
    assertEquals(49407, truncated[76]);
  }

  private JSONObject media() throws Exception {
    return new JSONObject()
        .put("id", "image:external:42")
        .put("size", 100)
        .put("modifiedAt", 200)
        .put("generation", 2)
        .put("name", "my-original.jpg")
        .put("album", "Camera");
  }

  @Test
  public void modifiedOriginalsAndChangedAnalysisOptionsInvalidateIndex() throws Exception {
    JSONObject photo = media(), config = new JSONObject().put("ocr", true).put("visual", false);
    JSONObject row =
        new JSONObject()
            .put("stamp", R2DeviceGallery.stamp(photo))
            .put("ocrDone", true)
            .put("ocrVersion", GalleryIntelligence.OCR_VERSION);
    assertTrue(GalleryIntelligenceWorker.current(row, photo, config));
    row.remove("ocrVersion");
    assertFalse(
        "Old bilingual OCR needs a fresh English-only scan",
        GalleryIntelligenceWorker.current(row, photo, config));
    row.put("ocrVersion", GalleryIntelligence.OCR_VERSION);
    photo.put("generation", 3);
    assertFalse(GalleryIntelligenceWorker.current(row, photo, config));
    photo.put("generation", 2);
    config.put("visual", true);
    assertFalse(GalleryIntelligenceWorker.current(row, photo, config));
    row.put("visualDone", true);
    assertFalse(
        "A flag alone is not a valid embedding",
        GalleryIntelligenceWorker.current(row, photo, config));
    JSONArray embedding = new JSONArray();
    for (int i = 0; i < 512; i++) embedding.put(i == 0 ? 1 : 0);
    row.put("model", GalleryClip.REVISION).put("embedding", embedding);
    assertTrue(GalleryIntelligenceWorker.current(row, photo, config));
  }

  @Test
  public void derivedTextAndVectorsAreEncryptedAndClearNeverTouchesCloudSettings()
      throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    repo.store.edit(root -> root.put("existing-private-setting", "keep-me"));
    String text = "sensitive handwritten reminder 987654321";
    JSONObject row =
        new JSONObject()
            .put("media", media())
            .put("stamp", "100:200:2")
            .put("text", text)
            .put("embedding", new JSONArray(List.of(.3, .4)));
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      db.put(row);
      assertEquals(1, db.count());
      assertEquals(text, db.get("image:external:42").getString("text"));
    }
    byte[] disk =
        java.nio.file.Files.readAllBytes(
            new File(repo.store.directory(), "gallery-search.db").toPath());
    String raw = new String(disk, StandardCharsets.ISO_8859_1);
    assertFalse(raw.contains(text));
    assertFalse(raw.contains("my-original.jpg"));
    assertFalse(raw.contains("image:external:42"));
    try (GallerySearchStore reopened = new GallerySearchStore(repo.store)) {
      assertEquals(text, reopened.get("image:external:42").getString("text"));
      reopened.clear();
      assertEquals(0, reopened.count());
    }
    assertEquals("keep-me", repo.store.snapshot().getString("existing-private-setting"));
  }

  @Test
  public void rowCiphertextTamperingFailsAuthenticatedDecryption() throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      db.put(new JSONObject().put("media", media()).put("text", "secret"));
    }
    try (SQLiteDatabase raw =
        SQLiteDatabase.openDatabase(
            new File(repo.store.directory(), "gallery-search.db").getPath(),
            null,
            SQLiteDatabase.OPEN_READWRITE)) {
      raw.execSQL("UPDATE photos SET payload=zeroblob(50)");
    }
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      try {
        db.get("image:external:42");
        fail("Tampered OCR must not decode");
      } catch (R2Exception expected) {
        assertEquals("KEYSTORE_UNAVAILABLE", expected.code);
      }
    }
  }

  @Test
  public void emptyQueryCannotMatchEveryPhotoAndMatchingRequiresAllWords() {
    assertFalse(GalleryIntelligence.textMatch("anything", GalleryIntelligence.terms("  ")));
    assertTrue(
        GalleryIntelligence.textMatch(
            "Return TRAIN ticket DELHI", GalleryIntelligence.terms("train delhi")));
    assertFalse(
        GalleryIntelligence.textMatch("train ticket", GalleryIntelligence.terms("train delhi")));
  }

  @Test
  public void nativeSearchReturnsOnlyCurrentAccessiblePhotosAndNeverOcrOrVectors()
      throws Exception {
    R2DeviceGalleryTest fixture = new R2DeviceGalleryTest();
    fixture.setup();
    JSONObject media = fixture.gallery.one("image:external:42");
    fixture.repo.store.edit(
        root ->
            root.put(
                GalleryIntelligence.KEY,
                new JSONObject()
                    .put("ocr", true)
                    .put("visual", false)
                    .put("albums", new JSONArray())));
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      db.put(
          new JSONObject()
              .put("media", media)
              .put("stamp", R2DeviceGallery.stamp(media))
              .put("text", "Train ticket Delhi")
              .put("ocrDone", true)
              .put("ocrVersion", GalleryIntelligence.OCR_VERSION));
    }
    GalleryIntelligence service =
        new GalleryIntelligence(RuntimeEnvironment.getApplication(), fixture.repo.store);
    try {
      service.search("train delhi", "", "all", 0, () -> true);
      fail("A superseded search must stop before opening models or reading photo rows");
    } catch (R2Exception expected) {
      assertEquals("SEARCH_CANCELLED", expected.code);
    }
    JSONArray result = service.search("train delhi", "", "all", 0).getJSONArray("items");
    assertEquals(1, result.length());
    assertFalse(result.getJSONObject(0).has("text"));
    assertFalse(result.getJSONObject(0).has("embedding"));
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      JSONObject old = db.get("image:external:42");
      old.remove("ocrVersion");
      db.put(old);
      assertEquals(
          "Previous bilingual text must not be searched",
          0,
          service.search("train delhi", "", "all", 0).getJSONArray("items").length());
      old.put("ocrVersion", GalleryIntelligence.OCR_VERSION);
      db.put(old);
    }
    assertEquals(
        0, service.search("train delhi", "Another album", "all", 0).getJSONArray("items").length());
    assertEquals(0, service.search("train delhi", "", "video", 0).getJSONArray("items").length());
    // Same ID, changed original version: stale OCR must not be exposed as a result.
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      JSONObject row = db.get("image:external:42");
      row.put("stamp", "changed");
      db.put(row);
    }
    assertEquals(0, service.search("train delhi", "", "all", 0).getJSONArray("items").length());
  }

  @Test
  public void clipRgbCenterCropAndNormalizationHaveExpectedChannels() throws Exception {
    Bitmap b = Bitmap.createBitmap(32, 16, Bitmap.Config.ARGB_8888);
    b.eraseColor(0xffff0000);
    float[] pixels = GalleryClip.pixels(b);
    assertEquals(3 * 224 * 224, pixels.length);
    assertEquals((1 - .48145466) / .26862954, pixels[0], .00001);
    assertEquals(-.4578275 / .26130258, pixels[224 * 224], .00001);
    assertEquals(-.40821073 / .27577711, pixels[2 * 224 * 224], .00001);
    b.recycle();
    float[] a = new float[512], d = new float[512];
    a[0] = 3;
    a[1] = 4;
    d[0] = 1;
    GalleryClip.normalize(a);
    GalleryClip.normalize(d);
    assertEquals(.6, GalleryClip.cosine(a, d), .00001);
    a[0] = Float.NaN;
    try {
      GalleryClip.normalize(a);
      fail("Reject NaN");
    } catch (IOException expected) {
    }
  }

  @Test
  public void incompleteModelsAreNeverReadyAndHashMismatchIsRejected() throws Exception {
    File f = File.createTempFile("synthetic-search-model", ".onnx");
    java.nio.file.Files.write(f.toPath(), "incorrect download".getBytes(StandardCharsets.UTF_8));
    assertFalse(GalleryClip.matches(f, GalleryClip.SHA[0]));
    f.delete();
    assertFalse(GalleryClip.ready(RuntimeEnvironment.getApplication()));
  }
}
