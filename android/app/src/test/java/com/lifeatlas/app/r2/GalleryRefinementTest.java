package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

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
public class GalleryRefinementTest {
  @Test
  public void userMergesNamesAndCoverCorrectionsAreUndoableAndPrivate() throws Exception {
    var first =
        GalleryCollectionsTest.portrait("one", "face-one", GalleryCollectionsTest.vector(0), 10);
    var second =
        GalleryCollectionsTest.portrait("two", "face-two", GalleryCollectionsTest.vector(1), 20);
    var index = new GalleryIndexedPhotos(List.of(first, second));
    JSONObject state = new JSONObject();
    GalleryPeople initial = new GalleryPeople(index, state);
    initial.edit(state, "name-person", initial.groups.get(0).id, "", "", "Me");
    GalleryPeople named = new GalleryPeople(index, state);
    String target = named.groups.stream().filter(g -> g.confirmed).findFirst().orElseThrow().id;
    String source = named.groups.stream().filter(g -> !g.confirmed).findFirst().orElseThrow().id;
    JSONObject before = new JSONObject(state.toString());
    named.edit(state, "merge-people", source, "", target, "");
    GalleryPeople merged = new GalleryPeople(index, state);
    assertEquals(1, merged.groups.size());
    assertEquals(2, merged.groups.get(0).photos.size());
    merged.edit(state, "person-cover", target, "face-two", "", "");
    assertEquals(
        "face-two", new GalleryPeople(index, state).summaries().get(0).getString("faceId"));
    new GalleryPeople(index, state).edit(state, "hide-person", target, "", "", "");
    assertEquals(0, new GalleryPeople(index, state).summaries().size());
    assertEquals(2, new GalleryPeople(index, before).groups.size());
    assertEquals(2, index.photos.size());
  }

  @Test
  public void pagedEncryptedSnapshotsSurviveReopenAndDoNotRereadPhotoAnalysis() throws Exception {
    var repo = R2TripQueueTest.repository();
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      JSONArray cards = new JSONArray(), faces = new JSONArray(), ids = new JSONArray();
      for (int i = 0; i < 170; i++) {
        cards.put(new JSONObject().put("id", "group-" + i).put("title", "Private name " + i));
        ids.put("image:external:" + i);
        faces.put(new JSONObject().put("id", "face-" + i).put("mediaId", "image:external:" + i));
      }
      JSONObject groups =
          new JSONObject()
              .put(
                  "person",
                  new JSONObject()
                      .put("ids", ids)
                      .put("faces", faces)
                      .put("people", new JSONArray()));
      db.saveCollections(
          "people",
          new JSONObject()
              .put("revision", db.revision())
              .put("scope", "test")
              .put("partial", false)
              .put("needsAnalysis", false)
              .put("collections", cards)
              .put("groups", groups));
      assertEquals(40, db.cache("people", "page:0").getJSONArray("collections").length());
      assertEquals("80", db.cache("people", "faces:person:0").getString("cursor"));
      assertEquals(10, db.cache("people", "media:person:160").getJSONArray("ids").length());
      assertFalse(db.cache("people", "faces:person:0").has("people"));
    }
    try (GallerySearchStore reopened = new GallerySearchStore(repo.store)) {
      assertEquals(40, reopened.cache("people", "page:40").getJSONArray("collections").length());
      reopened.clear();
      assertEquals(0, reopened.cache("people", "info").length());
    }
    String disk =
        new String(
            java.nio.file.Files.readAllBytes(
                new java.io.File(repo.store.directory(), "gallery-search.db").toPath()),
            StandardCharsets.ISO_8859_1);
    assertFalse(disk.contains("Private name"));
  }

  @Test
  public void encryptedRecoveryRoundTripsWithTheSameRecoveryKeyAndAuthenticatesPaths()
      throws Exception {
    byte[] keys = R2Crypto.newKeyset();
    String path = GalleryRecovery.prefix(keys) + "snapshots/test.atlas";
    JSONObject payload =
        new JSONObject()
            .put("format", "life-atlas-gallery-analysis")
            .put("version", 1)
            .put("photos", new JSONArray())
            .put(
                "choices",
                new JSONObject().put("people", new JSONObject().put("name", "My private friend")));
    R2PlaceBackupTest.Store store = new R2PlaceBackupTest.Store();
    GalleryRecovery.put(store, keys, path, payload);
    assertFalse(
        new String(store.files.get(path), StandardCharsets.ISO_8859_1)
            .contains("My private friend"));
    assertEquals(payload.toString(), GalleryRecovery.get(store, keys, path).toString());
    try {
      GalleryRecovery.get(store, R2Crypto.newKeyset(), path);
      fail("Wrong recovery keys must fail");
    } catch (Exception expected) {
    }
    byte[] cipher = store.files.get(path);
    cipher[cipher.length - 1] ^= 1;
    try {
      GalleryRecovery.get(store, keys, path);
      fail("Tampering must fail");
    } catch (Exception expected) {
    }
  }

  @Test
  public void restoreReconnectsOnlyVerifiedChecksumsAndKeepsUnmatchedReferencesOutOfLocalChoices()
      throws Exception {
    Map<String, String> map =
        Map.of(
            "old-face",
            "new-face",
            "image:external:1",
            "image:external:99",
            "image:external:1|old-stamp",
            "image:external:99|new-stamp");
    JSONObject people =
        new JSONObject()
            .put("people", new JSONObject().put("person", "Me"))
            .put(
                "assignments",
                new JSONObject().put("old-face", "person").put("unknown-face", "other"))
            .put("excluded", new JSONArray(List.of("old-face", "unknown-face")));
    JSONObject restored = GalleryRecovery.project("people", people, map);
    assertEquals("person", restored.getJSONObject("assignments").getString("new-face"));
    assertFalse(restored.getJSONObject("assignments").has("unknown-face"));
    JSONObject favorites =
        GalleryRecovery.project(
            "media-preferences",
            new JSONObject()
                .put("favorites", new JSONArray(List.of("image:external:1", "image:external:2"))),
            map);
    assertEquals("image:external:99", favorites.getJSONArray("favorites").getString(0));
    assertEquals(1, favorites.getJSONArray("favorites").length());
    JSONObject local =
        new JSONObject().put("assignments", new JSONObject().put("new-face", "my-new-correction"));
    GalleryRecovery.mergeMissing(local, restored);
    assertEquals("my-new-correction", local.getJSONObject("assignments").getString("new-face"));
  }

  @Test
  public void partialRecoverySnapshotsAreRejectedBeforeApplyingAnyData() throws Exception {
    try {
      GalleryRecovery.validateManifest(new JSONObject().put("version", 1));
      fail();
    } catch (R2Exception expected) {
      assertEquals("INVALID_GALLERY_RECOVERY", expected.code);
    }
    JSONObject invalid =
        new JSONObject()
            .put("format", "life-atlas-gallery-analysis")
            .put("version", 1)
            .put("choices", new JSONObject())
            .put("photos", new JSONArray().put(new JSONObject().put("hash", "not-a-checksum")));
    try {
      GalleryRecovery.validateManifest(invalid);
      fail();
    } catch (R2Exception expected) {
    }
  }

  @Test
  public void restoredPhotoReconnectsAfterItsAndroidIdChangesAndKeepsTheOriginalBytes()
      throws Exception {
    R2DeviceGalleryTest fixture = new R2DeviceGalleryTest();
    fixture.setup();
    R2DeviceGalleryTest.Provider provider =
        new R2DeviceGalleryTest.Provider() {
          @Override
          public android.database.Cursor query(
              android.net.Uri uri, String[] columns, String selection, String[] args, String sort) {
            android.database.Cursor source = super.query(uri, columns, selection, args, sort);
            android.database.MatrixCursor limited = new android.database.MatrixCursor(columns);
            if (source.moveToFirst()) {
              Object[] row = new Object[columns.length];
              for (int i = 0; i < row.length; i++)
                row[i] =
                    source.getType(i) == android.database.Cursor.FIELD_TYPE_STRING
                        ? source.getString(i)
                        : source.getLong(i);
              limited.addRow(row);
            }
            source.close();
            return limited;
          }
        };
    provider.original = fixture.provider.original;
    android.content.pm.ProviderInfo info = new android.content.pm.ProviderInfo();
    info.authority = "media";
    info.exported = true;
    provider.attachInfo(RuntimeEnvironment.getApplication(), info);
    org.robolectric.shadows.ShadowContentResolver.registerProviderInternal("media", provider);
    GalleryIntelligence service =
        new GalleryIntelligence(RuntimeEnvironment.getApplication(), fixture.repo.store);
    service.writeSettings(
        new JSONObject().put("similar", true).put("people", false).put("albums", new JSONArray()));
    String oldId = "image:external:777",
        newId = "image:external:100",
        hash = R2Policy.digest("unchanged bytes".getBytes(StandardCharsets.UTF_8));
    JSONObject row =
        new JSONObject()
            .put("media", new JSONObject().put("id", oldId).put("size", provider.original.length()))
            .put("stamp", "old-stamp")
            .put("quality", GalleryCollectionsTest.quality(0, 80))
            .put("text", "A remembered sign");
    JSONObject choices =
        new JSONObject()
            .put("media-preferences", new JSONObject().put("favorites", new JSONArray().put(oldId)))
            .put(
                "similar",
                new JSONObject()
                    .put("sourcePicks", new JSONObject().put(oldId + "|old-stamp", 123)));
    JSONObject manifest =
        new JSONObject()
            .put("format", "life-atlas-gallery-analysis")
            .put("version", 1)
            .put(
                "photos",
                new JSONArray()
                    .put(
                        new JSONObject().put("hash", hash).put("size", provider.original.length())))
            .put("choices", choices)
            .put("idMap", new JSONObject())
            .put("faceMap", new JSONObject())
            .put("restoreFaces", false);
    byte[] before = java.nio.file.Files.readAllBytes(provider.original.toPath());
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      db.choice("restore-photo:" + hash, new JSONObject().put("row", row));
      db.choice("recovery-staged", manifest);
    }
    GalleryRecovery.reconnect(
        RuntimeEnvironment.getApplication(), service, fixture.gallery, () -> false);
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      assertEquals("A remembered sign", db.get(newId).getString("text"));
      assertEquals(newId, db.get(newId).getJSONObject("media").getString("id"));
      assertEquals(newId, db.choice("media-preferences").getJSONArray("favorites").getString(0));
      assertEquals(0, db.choice("recovery-settings").getInt("unmatched"));
    }
    assertArrayEquals(before, java.nio.file.Files.readAllBytes(provider.original.toPath()));
  }

  @Test
  public void bulkPeopleMergeIsOneUndoableNativeEdit() throws Exception {
    R2DeviceGalleryTest fixture = new R2DeviceGalleryTest();
    fixture.setup();
    GalleryIntelligence service =
        new GalleryIntelligence(RuntimeEnvironment.getApplication(), fixture.repo.store);
    service.writeSettings(new JSONObject().put("people", true).put("albums", new JSONArray()));
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      for (int id = 42; id <= 43; id++) {
        JSONObject media = fixture.gallery.one("image:external:" + id);
        JSONArray vector = new JSONArray();
        for (float value : GalleryCollectionsTest.vector(id - 42)) vector.put((double) value);
        db.put(
            new JSONObject()
                .put("media", media)
                .put("stamp", R2DeviceGallery.stamp(media))
                .put("faceVersion", GalleryFaceModels.VERSION)
                .put(
                    "faces",
                    new JSONArray()
                        .put(
                            new JSONObject()
                                .put(
                                    "id",
                                    GallerySearchStore.token(media.getString("id"))
                                        + ".0.0123456789abcdef")
                                .put("embedding", vector)
                                .put("crop", "cHJpdmF0ZQ=="))));
      }
    }
    GalleryCollections api =
        new GalleryCollections(RuntimeEnvironment.getApplication(), service, fixture.gallery);
    JSONArray groups = api.list("people", "").getJSONArray("collections");
    assertEquals(2, groups.length());
    String first = groups.getJSONObject(0).getString("id"),
        second = groups.getJSONObject(1).getString("id");
    api.edit(new JSONObject().put("action", "name-person").put("key", first).put("name", "Me"));
    api.edit(
        new JSONObject().put("action", "name-person").put("key", second).put("name", "Duplicate"));
    groups = api.list("people", "").getJSONArray("collections");
    String target = "", source = "";
    for (int i = 0; i < groups.length(); i++) {
      JSONObject g = groups.getJSONObject(i);
      if (g.getString("title").equals("Me")) target = g.getString("id");
      else source = g.getString("id");
    }
    api.edit(
        new JSONObject()
            .put("action", "merge-people-many")
            .put("keys", new JSONArray().put(source).put(target))
            .put("personId", target));
    assertEquals(1, api.list("people", "").getJSONArray("collections").length());
    assertEquals(
        2, api.list("people", "").getJSONArray("collections").getJSONObject(0).getInt("count"));
    api.edit(new JSONObject().put("action", "undo-people"));
    assertEquals(2, api.list("people", "").getJSONArray("collections").length());
  }

  @Test
  public void appResumeWithoutMediaChangesKeepsCollectionSnapshotsValid() throws Exception {
    R2DeviceGalleryTest fixture = new R2DeviceGalleryTest();
    fixture.setup();
    GalleryIntelligence service =
        new GalleryIntelligence(RuntimeEnvironment.getApplication(), fixture.repo.store);
    service.writeSettings(new JSONObject().put("enabled", false));
    assertTrue(service.refreshMediaIfChanged());
    long before;
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      before = db.revision();
    }
    assertFalse(service.refreshMediaIfChanged());
    try (GallerySearchStore db = new GallerySearchStore(fixture.repo.store)) {
      assertEquals(before, db.revision());
    }
  }

  @Test
  public void cloudOnlyRecoveryMembersUseIndependentIdentitiesRatherThanReusedPhoneIds()
      throws Exception {
    String source = "image:external:1",
        hash = "a".repeat(64),
        face = GallerySearchStore.token(source) + ".0.0123456789abcdef";
    JSONObject row =
        new JSONObject()
            .put("media", new JSONObject().put("id", source))
            .put("stamp", "saved-version")
            .put("faces", new JSONArray().put(new JSONObject().put("id", face)));
    Map<String, String> replacement = new HashMap<>();
    JSONObject safe = GalleryRecovery.namespacePending(row, hash, replacement);
    assertNotEquals(source, safe.getJSONObject("media").getString("id"));
    assertEquals(source, row.getJSONObject("media").getString("id"));
    assertNotEquals(face, safe.getJSONArray("faces").getJSONObject(0).getString("id"));
    JSONObject preferences =
        GalleryRecovery.project(
            "media-preferences",
            new JSONObject().put("favorites", new JSONArray().put(source)),
            replacement);
    assertEquals("recovered:" + hash, preferences.getJSONArray("favorites").getString(0));
  }
}
