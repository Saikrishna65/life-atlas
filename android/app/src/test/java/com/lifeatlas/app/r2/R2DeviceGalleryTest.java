package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import android.content.*;
import android.database.*;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.*;
import java.util.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import org.robolectric.shadows.ShadowContentResolver;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@GraphicsMode(GraphicsMode.Mode.LEGACY)
public class R2DeviceGalleryTest {
  static class Provider extends ContentProvider {
    String where;
    String[] args;
    File original;

    public boolean onCreate() {
      return true;
    }

    public Cursor query(
        Uri uri, String[] columns, String selection, String[] selectionArgs, String sort) {
      where = selection;
      args = selectionArgs;
      MatrixCursor cursor = new MatrixCursor(columns);
      int size = selection != null && selection.contains("_id=?") ? 1 : 85;
      for (int i = 0; i < size; i++) {
        long id = size == 1 ? Long.parseLong(selectionArgs[0]) : 100 - i;
        Object[] values = new Object[columns.length];
        for (int j = 0; j < columns.length; j++)
          values[j] =
              switch (columns[j]) {
                case "_id" -> id;
                case "_display_name" -> "Original " + id + ".jpg";
                case "mime_type" -> "image/jpeg";
                case "_size" -> original.length();
                case "date_added" -> 1000L - i;
                case "date_modified" -> 900L;
                case "width" -> 4000;
                case "height" -> 3000;
                case "media_type" -> 1;
                case "bucket_display_name" -> "Camera";
                default -> 0;
              };
        cursor.addRow(values);
      }
      return cursor;
    }

    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
      return ParcelFileDescriptor.open(original, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    public String getType(Uri uri) {
      return "image/jpeg";
    }

    public Uri insert(Uri uri, ContentValues values) {
      throw new AssertionError("No image writes");
    }

    public int delete(Uri uri, String selection, String[] args) {
      throw new AssertionError("No image deletion");
    }

    public int update(Uri uri, ContentValues values, String selection, String[] args) {
      throw new AssertionError("No image changes");
    }
  }

  Provider provider;
  R2Repository repo;
  R2DeviceGallery gallery;

  @Before
  public void setup() throws Exception {
    provider = new Provider();
    provider.original = File.createTempFile("gallery-original", ".jpg");
    try (FileOutputStream out = new FileOutputStream(provider.original)) {
      out.write("unchanged bytes".getBytes());
    }
    provider.attachInfo(RuntimeEnvironment.getApplication(), new android.content.pm.ProviderInfo());
    ShadowContentResolver.registerProviderInternal("media", provider);
    repo = R2TripQueueTest.repository();
    gallery = new R2DeviceGallery(RuntimeEnvironment.getApplication(), repo);
  }

  @Test
  public void paginationIsBoundedAndNeverLabelsUnexaminedFilesAsUploaded() throws Exception {
    JSONObject page = gallery.list("", "", "all", "", "newest");
    assertEquals(80, page.getJSONArray("items").length());
    assertFalse(page.getBoolean("complete"));
    assertEquals("921:21:external", page.getString("cursor"));
    JSONObject first = page.getJSONArray("items").getJSONObject(0);
    assertEquals("image:external:100", first.getString("id"));
    assertFalse(first.has("copies"));
    assertEquals(4000, first.getInt("width"));
    gallery.list(page.getString("cursor"), "100_%", "photo", "Camera", "newest");
    assertTrue(provider.where.contains("LIKE ?"));
    assertFalse(provider.where.contains("100_%"));
    assertEquals("%100\\_\\%%", provider.args[0]);
    assertTrue(Arrays.asList(provider.args).contains("Camera"));
  }

  @Test
  public void phoneBrowsingDoesNotDependOnWorkingCloudKeystore() throws Exception {
    Context context =
        new ContextWrapper(RuntimeEnvironment.getApplication()) {
          public File getNoBackupFilesDir() {
            return repo.store.directory().getParentFile();
          }
        };
    R2Repository broken =
        new R2Repository(
            new R2SecureStore(
                context,
                () -> {
                  throw new R2Exception("KEYSTORE_UNAVAILABLE");
                }));
    assertEquals(
        80,
        new R2DeviceGallery(context, broken)
            .list("", "", "all", "", "newest")
            .getJSONArray("items")
            .length());
  }

  @Test
  public void registerKeepsDurableNativeReferencesAndOriginalBytesUnchanged() throws Exception {
    JSONObject media = gallery.one("image:external:42");
    String stamp = R2DeviceGallery.stamp(media);
    JSONArray result =
        gallery.register(
            new JSONArray().put(media.getString("id")),
            new JSONObject().put(media.getString("id"), stamp));
    JSONObject file = result.getJSONObject(0);
    assertTrue(file.getBoolean("persistent"));
    assertFalse(file.has("uri"));
    JSONObject record =
        repo.store.snapshot().getJSONObject("selections").getJSONObject(file.getString("id"));
    assertEquals("content://media/external/images/media/42", record.getString("uri"));
    assertEquals("image:external:42", record.getString("galleryId"));
    assertEquals(
        "unchanged bytes",
        new String(java.nio.file.Files.readAllBytes(provider.original.toPath())));
    try {
      gallery.register(
          new JSONArray().put(media.getString("id")),
          new JSONObject().put(media.getString("id"), "changed"));
      fail();
    } catch (R2Exception expected) {
      assertEquals("SOURCE_CHANGED", expected.code);
    }
  }

  @Test
  public void identityChangesWithFileVersionAndRejectsUnsafeUris() throws Exception {
    JSONObject a = gallery.one("image:external:42"),
        b = new JSONObject(a.toString()).put("modifiedAt", 123);
    assertNotEquals(R2DeviceGallery.selectionId(a), R2DeviceGallery.selectionId(b));
    assertNotEquals(
        R2DeviceGallery.stamp(new JSONObject(a.toString()).put("generation", 1)),
        R2DeviceGallery.stamp(new JSONObject(a.toString()).put("generation", 2)));
    for (String id :
        List.of(
            "file:///secret",
            "image:../../private:42",
            "image:external:0",
            "video:external:1?token=x"))
      try {
        R2DeviceGallery.uri(id);
        fail(id);
      } catch (IllegalArgumentException expected) {
      }
  }

  @Test
  public void albumsEnumerateAccessibleMetadataWithoutOpeningOriginals() throws Exception {
    JSONArray albums = gallery.albums();
    assertEquals("Camera", albums.getJSONObject(0).getString("name"));
    assertEquals(85, albums.getJSONObject(0).getInt("count"));
  }

  @Test
  public void partialAccessIsReportedExplicitlyAcrossAndroidVersions() throws Exception {
    assertEquals(
        "full", R2GalleryAccess.describe(28, true, false, false, false).getString("status"));
    assertEquals(
        "denied", R2GalleryAccess.describe(33, false, false, false, true).getString("status"));
    assertEquals(
        "limited", R2GalleryAccess.describe(34, false, false, false, true).getString("status"));
    assertEquals(
        "limited", R2GalleryAccess.describe(36, false, true, false, false).getString("status"));
    assertEquals(
        "full", R2GalleryAccess.describe(36, false, true, true, false).getString("status"));
  }

  @Test
  public void privatePreviewReleaseCannotEscapeItsDedicatedCache() throws Exception {
    File root = R2GalleryPreview.root(RuntimeEnvironment.getApplication());
    File safe = new File(root, "11111111-1111-4111-8111-111111111111.jpg");
    safe.createNewFile();
    R2GalleryPreview.release(RuntimeEnvironment.getApplication(), "../");
    assertTrue(safe.exists());
    R2GalleryPreview.release(
        RuntimeEnvironment.getApplication(), "11111111-1111-4111-8111-111111111111");
    assertFalse(safe.exists());
  }

  @Test
  public void privateCloudPreviewAuthenticatesBytesWithoutCreatingPublicSelections()
      throws Exception {
    byte[]
        original =
            "synthetic original unchanged bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8),
        keys = R2Crypto.newKeyset();
    String key = "encrypted/photos/preview.atlasenc";
    ByteArrayOutputStream encrypted = new ByteArrayOutputStream();
    R2Envelope.encrypt(
        new ByteArrayInputStream(original),
        encrypted,
        keys,
        key,
        new JSONObject()
            .put("name", "original.jpg")
            .put("mimeType", "image/jpeg")
            .put("size", original.length)
            .put("sha256", R2Policy.digest(original)));
    repo.store.edit(state -> state.put("keyset", Base64.getEncoder().encodeToString(keys)));
    R2DuplicatesTest.Cloud cloud = new R2DuplicatesTest.Cloud();
    cloud.bytes = encrypted.toByteArray();
    cloud.hash = R2Policy.digest(cloud.bytes);
    JSONObject preview =
        R2GalleryPreview.open(RuntimeEnvironment.getApplication(), repo, key, cloud);
    File file = new File(preview.getString("path"));
    assertArrayEquals(original, java.nio.file.Files.readAllBytes(file.toPath()));
    assertEquals("original.jpg", preview.getString("name"));
    assertEquals(3, repo.store.snapshot().getJSONObject("selections").length());
    assertEquals(0, repo.jobs().length());
    assertEquals(0, cloud.writes);
    R2GalleryPreview.release(RuntimeEnvironment.getApplication(), preview.getString("token"));
    assertFalse(file.exists());
    cloud.corrupt = true;
    try {
      R2GalleryPreview.open(RuntimeEnvironment.getApplication(), repo, key, cloud);
      fail();
    } catch (R2Exception expected) {
      assertEquals("INTEGRITY_FAILED", expected.code);
    }
    Arrays.fill(keys, (byte) 0);
  }
}
