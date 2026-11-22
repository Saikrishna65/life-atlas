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
public class GalleryAiImprovementsTest {
  @Test
  public void repeatedQueriesUseEncryptedCacheButCorrectionsInvalidateThem() throws Exception {
    R2DeviceGalleryTest fixture = new R2DeviceGalleryTest();
    fixture.setup();
    var media = fixture.gallery.one("image:external:42");
    var service = new GalleryIntelligence(RuntimeEnvironment.getApplication(), fixture.repo.store);
    service.writeSettings(
        new JSONObject().put("ocr", true).put("visual", false).put("albums", new JSONArray()));
    try (var db = new GallerySearchStore(fixture.repo.store)) {
      db.put(
          new JSONObject()
              .put("media", media)
              .put("stamp", R2DeviceGallery.stamp(media))
              .put("text", "mountain temple")
              .put("ocrDone", true)
              .put("ocrVersion", GalleryIntelligence.OCR_VERSION));
    }
    JSONObject first = service.search("temple", "", "all", 0),
        second = service.search("temple", "", "all", 0);
    assertEquals(1, first.getJSONArray("items").length());
    assertTrue(second.getBoolean("cached"));
    GalleryCorrections.save(
        service,
        new JSONObject()
            .put("id", media.getString("id"))
            .put("query", "temple")
            .put("relevant", false));
    assertEquals(0, service.search("temple", "", "all", 0).getJSONArray("items").length());
  }

  @Test
  public void cachedHitsCannotOutliveChangedOriginalsOrCancellation() throws Exception {
    var fixture = new R2DeviceGalleryTest();
    fixture.setup();
    var media = fixture.gallery.one("image:external:42");
    try (var db = new GallerySearchStore(fixture.repo.store)) {
      var page = new JSONObject().put("items", new JSONArray().put(media)).put("complete", true);
      GallerySearchResults.write(db, "private query", db.revision(), page);
      assertNotNull(
          GallerySearchResults.read(
              RuntimeEnvironment.getApplication(), db, "private query", () -> false));
      java.nio.file.Files.write(fixture.provider.original.toPath(), new byte[] {1, 2, 3, 4, 5});
      assertNull(
          GallerySearchResults.read(
              RuntimeEnvironment.getApplication(), db, "private query", () -> false));
      try {
        GallerySearchResults.read(
            RuntimeEnvironment.getApplication(), db, "private query", () -> true);
        fail("cancelled");
      } catch (R2Exception expected) {
        assertEquals("SEARCH_CANCELLED", expected.code);
      }
    }
  }

  @Test
  public void queryCacheIsBoundedAndNotPartOfRecovery() throws Exception {
    var repo = R2TripQueueTest.repository();
    try (var db = new GallerySearchStore(repo.store)) {
      for (int i = 0; i < 20; i++)
        GallerySearchResults.write(
            db, "query" + i, db.revision(), new JSONObject().put("items", new JSONArray()));
      assertEquals(0, db.cache(GallerySearchResults.KIND, "query0").length());
      assertTrue(db.cache(GallerySearchResults.KIND, "query19").length() > 0);
    }
    assertFalse(GalleryRecovery.CHOICES.contains(GallerySearchResults.KIND));
  }

  @Test
  public void correctionAndEditWritesAdvanceRecoveryRevision() throws Exception {
    var repo = R2TripQueueTest.repository();
    try (var db = new GallerySearchStore(repo.store)) {
      long revision = db.revision();
      db.choice("search-feedback", new JSONObject().put("owner-label", "private name"));
      assertTrue(db.revision() > revision);
      revision = db.revision();
      db.choice("edits", new JSONObject());
      assertTrue(db.revision() > revision);
      revision = db.revision();
      db.choice("cache-settings", new JSONObject());
      assertEquals(revision, db.revision());
      assertTrue(GalleryRecovery.CHOICES.contains("search-feedback"));
    }
  }

  @Test
  public void lowQualityFacesCannotBecomeIdentityBridges() throws Exception {
    var clear =
        GalleryCollectionsTest.portrait("photo1", "face1", GalleryCollectionsTest.vector(0), 1000);
    var poor =
        GalleryCollectionsTest.portrait("photo2", "face2", GalleryCollectionsTest.vector(0), 2000);
    poor.faces.get(0).quality = .1;
    var later =
        GalleryCollectionsTest.portrait("photo3", "face3", GalleryCollectionsTest.vector(0), 3000);
    GalleryPeople people =
        new GalleryPeople(new GalleryIndexedPhotos(List.of(poor, clear, later)), new JSONObject());
    assertEquals(2, people.groups.size());
    assertTrue(people.groups.stream().anyMatch(g -> g.photos.size() == 2));
    assertTrue(people.groups.stream().anyMatch(g -> g.photos.equals(Set.of("photo2"))));
  }

  @Test
  public void onlyExplicitReferencesCanUsePoorConfirmedFaces() throws Exception {
    var poor =
        GalleryCollectionsTest.portrait("photo1", "face1", GalleryCollectionsTest.vector(0), 1000);
    poor.faces.get(0).quality = .1;
    var clear =
        GalleryCollectionsTest.portrait("photo2", "face2", GalleryCollectionsTest.vector(0), 2000);
    var index = new GalleryIndexedPhotos(List.of(poor, clear));
    var choices =
        new JSONObject()
            .put("people", new JSONObject().put("friend", "My friend"))
            .put("assignments", new JSONObject().put("face1", "friend"));
    var conservative = new GalleryPeople(index, choices);
    assertTrue(
        conservative.groups.stream()
            .filter(g -> !g.confirmed)
            .allMatch(g -> g.suggestedPersonId.isEmpty()));
    choices.put("references", new JSONObject().put("friend", new JSONArray().put("face1")));
    var explicit = new GalleryPeople(index, choices);
    assertTrue(explicit.groups.stream().anyMatch(g -> "friend".equals(g.suggestedPersonId)));
  }

  @Test
  public void bestShotPenalizesClippingAndNeverOverridesOwnerPick() throws Exception {
    var burned = GalleryCollectionsTest.photo("burned", 0, 95, 1000);
    burned.quality.put("clipped", .9);
    var balanced = GalleryCollectionsTest.photo("balanced", 0, 80, 2000);
    balanced.quality.put("clipped", .01);
    var index = new GalleryIndexedPhotos(List.of(burned, balanced));
    var choices = new JSONObject();
    var first = new GallerySimilar(index, choices).groups.get(0);
    assertEquals("balanced", first.best);
    assertEquals("near-identical", first.relationship);
    assertFalse(first.reason.isEmpty());
    GallerySimilar.edit(choices, first, "pick", "burned");
    assertEquals("burned", new GallerySimilar(index, choices).groups.get(0).pick);
  }

  @Test
  public void backgroundPolicyBoundsBatteryAndDecodeWork() throws Exception {
    assertTrue(GalleryAiBudget.lowBattery(20, false));
    assertFalse(GalleryAiBudget.lowBattery(20, true));
    assertFalse(GalleryAiBudget.lowBattery(-1, false));
    assertEquals(512, GalleryAiBudget.decodeEdge(new JSONObject().put("similar", true)));
    assertEquals(768, GalleryAiBudget.decodeEdge(new JSONObject().put("visual", true)));
    assertEquals(1600, GalleryAiBudget.decodeEdge(new JSONObject().put("people", true)));
    assertEquals(1600, GalleryAiBudget.decodeEdge(new JSONObject().put("ocr", true)));
  }
}
