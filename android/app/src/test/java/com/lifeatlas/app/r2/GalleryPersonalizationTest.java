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
public class GalleryPersonalizationTest {
  @Test
  public void correctionsAreVersionBoundedAndNegativeFeedbackWins() throws Exception {
    JSONObject media = new JSONObject().put("id", "image:external:42");
    JSONObject choice =
        new JSONObject()
            .put("label", "Tungnath temple")
            .put(
                "queries",
                new JSONObject().put(GallerySearchStore.token("snowy mountains"), false));
    JSONObject choices = new JSONObject().put("image:external:42|100:10", choice);
    assertEquals(
        2.5,
        GalleryCorrections.adjust(
            choices, media, "100:10", "temple", GalleryIntelligence.terms("temple"), 0),
        0);
    assertEquals(
        0,
        GalleryCorrections.adjust(
            choices,
            media,
            "100:10",
            "snowy mountains",
            GalleryIntelligence.terms("snowy mountains"),
            .8),
        0);
    assertEquals(
        0,
        GalleryCorrections.adjust(
            choices, media, "CHANGED", "temple", GalleryIntelligence.terms("temple"), 0),
        0);
    JSONObject restored =
        GalleryRecovery.project(
            "search-feedback",
            choices,
            Map.of("image:external:42|100:10", "image:external:99|200:20"));
    assertTrue(restored.has("image:external:99|200:20"));
    assertFalse(restored.has("image:external:42|100:10"));
  }

  @Test
  public void progressShowsAccessibleTextResultsBeforeReturningFinalResults() throws Exception {
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
    List<JSONObject> progress = new ArrayList<>();
    JSONObject result =
        new GalleryIntelligence(RuntimeEnvironment.getApplication(), fixture.repo.store)
            .search("train delhi", "", "all", 0, () -> false, new JSONObject(), progress::add);
    assertFalse(progress.isEmpty());
    assertEquals("text", progress.get(0).getString("stage"));
    assertEquals(1, progress.get(0).getJSONArray("items").length());
    assertFalse(progress.get(0).getJSONArray("items").getJSONObject(0).has("text"));
    assertEquals(1, result.getJSONArray("items").length());
  }

  @Test
  public void publicPlacementsMergeWithoutProjectingPrivateMetadata() throws Exception {
    JSONObject old =
        new JSONObject()
            .put("id", "asset")
            .put("category", "expedition")
            .put("collection", "trip-a")
            .put("privateFaces", new JSONArray().put("Private person"));
    JSONObject next =
        new JSONObject()
            .put("id", "asset")
            .put("category", "expedition")
            .put("collection", "trip-b")
            .put("key", "galleries/originals/a.jpg");
    JSONObject merged = R2PublicMetadata.merge(old, next);
    assertEquals(2, merged.getJSONArray("placements").length());
    assertEquals("asset", merged.getString("assetId"));
    assertFalse(merged.has("privateFaces"));
    assertEquals(2, R2PublicMetadata.merge(merged, next).getJSONArray("placements").length());
  }
}
