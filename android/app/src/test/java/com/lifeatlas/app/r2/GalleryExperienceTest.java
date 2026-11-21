package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import android.content.*;
import android.graphics.*;
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
public class GalleryExperienceTest {
  @Test
  public void albumsAreVirtualStampBoundAndRecoverableWithoutAnalysis() throws Exception {
    R2DeviceGalleryTest f = new R2DeviceGalleryTest();
    f.setup();
    var context = RuntimeEnvironment.getApplication();
    byte[] original = java.nio.file.Files.readAllBytes(f.provider.original.toPath());
    try (GallerySearchStore db = new GallerySearchStore(f.repo.store)) {
      String first =
          GalleryAlbums.edit(
                  context,
                  db,
                  new JSONObject()
                      .put("action", "create")
                      .put("name", "Friends")
                      .put("ids", new JSONArray(List.of("image:external:42", "image:external:43"))))
              .getString("id");
      String second =
          GalleryAlbums.edit(
                  context, db, new JSONObject().put("action", "create").put("name", "Weekends"))
              .getString("id");
      GalleryAlbums.edit(
          context,
          db,
          new JSONObject()
              .put("action", "cover")
              .put("id", first)
              .put("cover", "image:external:43"));
      GalleryAlbums.edit(
          context,
          db,
          new JSONObject().put("action", "move").put("id", second).put("direction", -1));
      assertEquals(second, GalleryAlbums.order(db).get(0));
      JSONObject snapshot = GalleryAlbums.snapshot(context, db);
      assertEquals(2, snapshot.getJSONArray("collections").getJSONObject(1).getInt("count"));
      assertEquals(
          "image:external:43",
          snapshot.getJSONArray("collections").getJSONObject(1).getString("coverId"));
      assertNotNull(
          db.get("image:external:42")); // Recovery can fingerprint membership even with AI off.
      JSONObject backup = GalleryAlbums.export(db);
      GalleryAlbums.edit(context, db, new JSONObject().put("action", "delete").put("id", first));
      assertEquals(1, GalleryAlbums.order(db).size());
      GalleryAlbums.restore(db, backup);
      assertEquals(2, GalleryAlbums.order(db).size());
      JSONObject remapped =
          GalleryRecovery.project(
              "albums",
              backup,
              Map.of(
                  "image:external:42|" + R2DeviceGallery.stamp(f.gallery.one("image:external:42")),
                  "image:external:99|new-stamp",
                  "image:external:42",
                  "image:external:99"));
      assertEquals(
          1,
          remapped.getJSONObject("items").getJSONObject(first).getJSONObject("members").length());
    }
    assertArrayEquals(original, java.nio.file.Files.readAllBytes(f.provider.original.toPath()));
  }

  @Test
  public void largeEncryptedNotesSurviveReopenAndAreAuthenticated() throws Exception {
    var repo = R2TripQueueTest.repository();
    String privateText = "private face correction".repeat(140000);
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      db.choice("recovery-staged", new JSONObject().put("notes", privateText));
    }
    File dir = new File(repo.store.directory(), "gallery-notes");
    assertEquals(1, dir.listFiles().length);
    File encrypted = dir.listFiles()[0];
    byte[] cipher = java.nio.file.Files.readAllBytes(encrypted.toPath());
    assertFalse(
        new String(cipher, StandardCharsets.ISO_8859_1).contains("private face correction"));
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      assertEquals(privateText, db.choice("recovery-staged").getString("notes"));
    }
    cipher[cipher.length - 1] ^= 1;
    java.nio.file.Files.write(encrypted.toPath(), cipher);
    try (GallerySearchStore db = new GallerySearchStore(repo.store)) {
      try {
        db.choice("recovery-staged");
        fail("Tampered choices must fail");
      } catch (Exception expected) {
      }
      db.forgetChoices("recovery-staged");
      assertEquals(0, dir.listFiles().length);
    }
  }

  @Test
  public void uncertainFacePairsRequireReviewAndRejectedMatchesStayRejected() throws Exception {
    float[] first = GalleryCollectionsTest.vector(0), second = new float[128];
    second[0] = .56f;
    second[1] = (float) Math.sqrt(1 - .56 * .56);
    var index =
        new GalleryIndexedPhotos(
            List.of(
                GalleryCollectionsTest.portrait("one", "face-one", first, 10),
                GalleryCollectionsTest.portrait("two", "face-two", second, 20)));
    JSONObject choices = new JSONObject();
    GalleryPeople people = new GalleryPeople(index, choices);
    assertEquals(2, people.groups.size());
    assertEquals(1, people.suggestions().size());
    String pair = people.suggestions().get(0).getString("id");
    people.edit(choices, "reject-people-match", pair, "", "", "");
    assertEquals(0, new GalleryPeople(index, choices).suggestions().size());
    JSONObject remapped =
        GalleryRecovery.project("people", choices, Map.of("face-one", "face-new"));
    assertTrue(
        remapped
            .getJSONObject("notSame")
            .has(GalleryPeople.pair("candidate:face-new", "candidate:face-two")));
    JSONObject named =
        new JSONObject()
            .put("people", new JSONObject().put("a", "Me").put("b", "Old duplicate"))
            .put("assignments", new JSONObject().put("face-one", "a").put("face-two", "b"));
    GalleryPeople.alias(named, "b", "a");
    GalleryPeople merged = new GalleryPeople(index, named);
    assertEquals(1, merged.groups.size());
    assertEquals(2, merged.groups.get(0).photos.size());
  }

  @Test
  public void faceQualityIsBoundedAndDoesNotChangeVectorsOrNames() throws Exception {
    Bitmap flat = Bitmap.createBitmap(112, 112, Bitmap.Config.ARGB_8888);
    flat.eraseColor(Color.GRAY);
    assertEquals(0, GalleryFaceQuality.score(flat), .001);
    flat.recycle();
    JSONObject row =
        new JSONObject()
            .put(
                "faces",
                new JSONArray()
                    .put(
                        new JSONObject()
                            .put("id", "face")
                            .put("crop", "invalid")
                            .put("embedding", new JSONArray(List.of(.1, .2)))));
    GalleryFaceQuality.update(row);
    assertEquals(0, row.getJSONArray("faces").getJSONObject(0).getDouble("quality"), 0);
    assertEquals(2, row.getJSONArray("faces").getJSONObject(0).getJSONArray("embedding").length());
  }

  @Test
  public void sharingGrantsReadOnlyOriginalUrisAndEditingCopiesBytes() throws Exception {
    R2DeviceGalleryTest f = new R2DeviceGalleryTest();
    f.setup();
    var context = RuntimeEnvironment.getApplication();
    Intent chooser =
        GalleryMediaActions.share(
            context, new JSONArray(List.of("image:external:42", "image:external:43")));
    Intent share = chooser.getParcelableExtra(Intent.EXTRA_INTENT);
    assertEquals(Intent.ACTION_SEND_MULTIPLE, share.getAction());
    assertEquals(2, share.getClipData().getItemCount());
    assertEquals(0, share.getFlags() & Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
    JSONObject copy = GalleryMediaActions.editCopy(context, "image:external:42");
    File temp = new File(copy.getString("path"));
    assertNotEquals(temp, f.provider.original);
    assertArrayEquals(
        java.nio.file.Files.readAllBytes(f.provider.original.toPath()),
        java.nio.file.Files.readAllBytes(temp.toPath()));
    temp.delete();
  }

  @Test
  public void phoneCleanupRequiresPrivateRecoveryAndAuthenticatesTheWholeOriginal()
      throws Exception {
    R2DeviceGalleryTest f = new R2DeviceGalleryTest();
    f.setup();
    try {
      GallerySpace.verify(
          RuntimeEnvironment.getApplication(), f.repo, new JSONArray(List.of("image:external:42")));
      fail("No recovery kit cannot delete");
    } catch (R2Exception e) {
      assertEquals("RECOVERY_VERIFICATION_REQUIRED", e.code);
    }
    byte[] keys = R2Crypto.newKeyset(),
        bytes = "exact original bytes".getBytes(StandardCharsets.UTF_8);
    String object = "encrypted/photos/test.atlas", hash = R2Policy.digest(bytes);
    ByteArrayOutputStream encrypted = new ByteArrayOutputStream();
    R2Envelope.encrypt(
        new ByteArrayInputStream(bytes),
        encrypted,
        keys,
        object,
        new JSONObject().put("size", bytes.length).put("sha256", hash));
    R2PlaceBackupTest.Store store = new R2PlaceBackupTest.Store();
    store.files.put(object, encrypted.toByteArray());
    JSONObject record = new JSONObject().put("key", object).put("size", bytes.length);
    GallerySpace.verifyObject(store, keys, record, hash);
    byte[] corrupt = store.files.get(object);
    corrupt[corrupt.length - 1] ^= 1;
    try {
      GallerySpace.verifyObject(store, keys, record, hash);
      fail("Tampering cannot authorize deletion");
    } catch (Exception expected) {
    }
  }
}
