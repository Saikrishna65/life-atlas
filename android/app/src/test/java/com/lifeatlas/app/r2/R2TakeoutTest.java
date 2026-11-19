package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import org.robolectric.shadows.ShadowContentResolver;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 29)
@GraphicsMode(GraphicsMode.Mode.LEGACY)
@SQLiteMode(SQLiteMode.Mode.LEGACY)
public class R2TakeoutTest {
  static class Provider extends ContentProvider {
    final Map<String, File> files = new LinkedHashMap<>();
    final Map<String, Integer> pending = new HashMap<>();
    int sequence = 0, deletes = 0;

    public boolean onCreate() {
      return true;
    }

    public String getType(Uri uri) {
      return "application/octet-stream";
    }

    public Cursor query(
        Uri uri, String[] projection, String selection, String[] args, String sort) {
      return new MatrixCursor(projection == null ? new String[] {"_id"} : projection);
    }

    public Uri insert(Uri collection, ContentValues values) {
      try {
        Uri uri = Uri.withAppendedPath(collection, "" + (++sequence));
        files.put(uri.toString(), File.createTempFile("takeout-test-", ".bin"));
        pending.put(uri.toString(), 1);
        return uri;
      } catch (Exception e) {
        throw new IllegalStateException(e);
      }
    }

    public int update(Uri uri, ContentValues values, String where, String[] args) {
      if (values.containsKey("is_pending"))
        pending.put(uri.toString(), values.getAsInteger("is_pending"));
      return 1;
    }

    public int delete(Uri uri, String where, String[] args) {
      if (!"is_pending=1".equals(where)) throw new AssertionError("Cannot delete existing media");
      if (pending.getOrDefault(uri.toString(), 0) != 1) return 0;
      File f = files.remove(uri.toString());
      pending.remove(uri.toString());
      if (f != null) f.delete();
      deletes++;
      return 1;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
      File f = files.get(uri.toString());
      if (f == null) throw new FileNotFoundException();
      return ParcelFileDescriptor.open(
          f,
          mode.contains("w")
              ? ParcelFileDescriptor.MODE_READ_WRITE | ParcelFileDescriptor.MODE_TRUNCATE
              : ParcelFileDescriptor.MODE_READ_ONLY);
    }
  }

  Provider provider;
  R2Repository repo;
  Context context;

  @Before
  public void setup() throws Exception {
    context = RuntimeEnvironment.getApplication();
    repo = R2TripQueueTest.repository();
    provider = new Provider();
    ShadowContentResolver.registerProviderInternal("media", provider);
    ShadowContentResolver.registerProviderInternal("takeout", provider);
  }

  String archive(LinkedHashMap<String, byte[]> entries) throws Exception {
    File zip = File.createTempFile("takeout-synthetic-", ".zip");
    try (ZipOutputStream out = new ZipOutputStream(new FileOutputStream(zip))) {
      for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
        out.putNextEntry(new ZipEntry(entry.getKey()));
        out.write(entry.getValue());
        out.closeEntry();
      }
    }
    String id = UUID.randomUUID().toString(), uri = "content://takeout/" + id;
    provider.files.put(uri, zip);
    repo.store.edit(
        state -> {
          JSONObject jobs = state.optJSONObject("takeoutJobs");
          if (jobs == null) {
            jobs = new JSONObject();
            state.put("takeoutJobs", jobs);
          }
          jobs.put(
              id, new JSONObject().put("id", id).put("uri", uri).put("completed", new JSONArray()));
        });
    return id;
  }

  R2Takeout.Control control =
      new R2Takeout.Control() {
        public void check() {}

        public void progress(String name, long bytes, int files) {}
      };

  byte[] original() {
    byte[] bytes = new byte[200031];
    new Random(1234).nextBytes(bytes);
    return bytes;
  }

  @Test
  public void originalBytesAndSupportedMetadataSurviveSidecarsBeforeOrAfterMedia()
      throws Exception {
    for (boolean first : List.of(true, false)) {
      LinkedHashMap<String, byte[]> entries = new LinkedHashMap<>();
      String folder = first ? "Takeout/Photos/Lake/" : "Takeout/Photos/Road/";
      byte[] meta =
          "{\"title\":\"frame.jpg\",\"description\":\"A day at the lake\",\"photoTakenTime\":{\"timestamp\":\"1700000000\"},\"geoData\":{\"latitude\":30.4,\"longitude\":79.2}}"
              .getBytes(StandardCharsets.UTF_8);
      if (first) entries.put(folder + "frame.jpg.supplemental-metadata.json", meta);
      entries.put(folder + "frame.jpg", original());
      if (!first) entries.put(folder + "frame.jpg.json", meta);
      assertEquals(1, R2Takeout.run(context, repo, archive(entries), control));
      try (R2LibraryStore s = new R2LibraryStore(repo)) {
        JSONObject r =
            s.importGet(
                "path:" + R2Policy.digest((folder + "frame.jpg").getBytes(StandardCharsets.UTF_8)));
        assertArrayEquals(
            original(), Files.readAllBytes(provider.files.get(r.getString("uri")).toPath()));
        assertEquals(1700000000000L, r.getJSONObject("metadata").getLong("capturedAt"));
        assertEquals(
            30.4, r.getJSONObject("metadata").getJSONObject("gps").getDouble("latitude"), .00001);
        assertEquals("A day at the lake", r.getJSONObject("metadata").getString("description"));
      }
    }
  }

  @Test
  public void repeatedArchiveResumeDoesNotCreateDuplicateFiles() throws Exception {
    LinkedHashMap<String, byte[]> e = new LinkedHashMap<>();
    e.put("Photos/Lake/frame.jpg", original());
    String id = archive(e);
    assertEquals(1, R2Takeout.run(context, repo, id, control));
    int count = provider.sequence;
    assertEquals(1, R2Takeout.run(context, repo, id, control));
    assertEquals(count, provider.sequence);
  }

  @Test
  public void duplicatesAcrossAlbumsReuseVerifiedBytesAndKeepBothMemberships() throws Exception {
    LinkedHashMap<String, byte[]> e = new LinkedHashMap<>();
    e.put("Photos/Lake/a.jpg", original());
    e.put("Photos/Friends/a.jpg", original());
    assertEquals(2, R2Takeout.run(context, repo, archive(e), control));
    assertEquals(1, provider.deletes);
    try (R2LibraryStore s = new R2LibraryStore(repo)) {
      JSONObject r =
          s.importGet(
              "path:" + R2Policy.digest("Photos/Friends/a.jpg".getBytes(StandardCharsets.UTF_8)));
      assertEquals(2, r.getJSONArray("albums").length());
      assertArrayEquals(
          original(), Files.readAllBytes(provider.files.get(r.getString("uri")).toPath()));
    }
  }

  @Test
  public void staleDuplicateIndexNeverDiscardsANewOriginal() throws Exception {
    LinkedHashMap<String, byte[]> e = new LinkedHashMap<>();
    e.put("Photos/Lake/a.jpg", original());
    R2Takeout.run(context, repo, archive(e), control);
    for (Map.Entry<String, File> f : provider.files.entrySet())
      if (f.getKey().startsWith("content://media/"))
        Files.write(f.getValue().toPath(), new byte[] {1, 2, 3});
    LinkedHashMap<String, byte[]> next = new LinkedHashMap<>();
    next.put("Photos/New/a.jpg", original());
    R2Takeout.run(context, repo, archive(next), control);
    assertEquals(0, provider.deletes);
    try (R2LibraryStore s = new R2LibraryStore(repo)) {
      JSONObject r =
          s.importGet(
              "path:" + R2Policy.digest("Photos/New/a.jpg".getBytes(StandardCharsets.UTF_8)));
      assertArrayEquals(
          original(), Files.readAllBytes(provider.files.get(r.getString("uri")).toPath()));
    }
  }

  @Test
  public void cancellationOnlyRemovesItsOwnPendingRowAndCanResume() throws Exception {
    LinkedHashMap<String, byte[]> e = new LinkedHashMap<>();
    e.put("Photos/one.jpg", original());
    String id = archive(e);
    try {
      R2Takeout.run(
          context,
          repo,
          id,
          new R2Takeout.Control() {
            int calls = 0;

            public void check() throws Exception {
              if (++calls > 1) throw new R2Exception("TRANSFER_INTERRUPTED");
            }

            public void progress(String name, long bytes, int files) {}
          });
      fail();
    } catch (R2Exception expected) {
      assertEquals("TRANSFER_INTERRUPTED", expected.code);
    }
    assertEquals(1, provider.deletes);
    assertEquals(1, R2Takeout.run(context, repo, id, control));
  }

  @Test
  public void corruptZipPayloadCannotExposePartialMedia() throws Exception {
    byte[] original = original();
    java.util.zip.CRC32 crc = new java.util.zip.CRC32();
    crc.update(original);
    java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
    String path = "Photos/corrupt.jpg";
    try (ZipOutputStream zip = new ZipOutputStream(output)) {
      ZipEntry entry = new ZipEntry(path);
      entry.setMethod(ZipEntry.STORED);
      entry.setSize(original.length);
      entry.setCompressedSize(original.length);
      entry.setCrc(crc.getValue());
      zip.putNextEntry(entry);
      zip.write(original);
      zip.closeEntry();
    }
    byte[] bytes = output.toByteArray();
    bytes[30 + path.length() + 500] ^= 1;
    File source = File.createTempFile("corrupt-takeout-", ".zip");
    Files.write(source.toPath(), bytes);
    String id = UUID.randomUUID().toString(), uri = "content://takeout/" + id;
    provider.files.put(uri, source);
    repo.store.edit(
        state ->
            state.put(
                "takeoutJobs",
                new JSONObject().put(id, new JSONObject().put("id", id).put("uri", uri))));
    try {
      R2Takeout.run(context, repo, id, control);
      fail();
    } catch (ZipException expected) {
    }
    assertEquals(1, provider.deletes);
    assertTrue(provider.files.keySet().stream().noneMatch(k -> k.startsWith("content://media/")));
  }

  @Test
  public void unsafePathsAndInvalidGeographyAreNotTrusted() throws Exception {
    for (String path :
        List.of("../photo.jpg", "/photo.jpg", "Photos/../photo.jpg", "Photos\\..\\photo.jpg"))
      try {
        R2Takeout.path(path);
        fail();
      } catch (R2Exception e) {
        assertEquals("UNSAFE_IMPORT_PATH", e.code);
      }
    assertFalse(
        R2Takeout.metadata(new JSONObject("{\"geoData\":{\"latitude\":100,\"longitude\":200}}"))
            .has("gps"));
    assertEquals("image/jpeg", R2Takeout.mime("camera.JPG"));
    assertEquals("", R2Takeout.mime("run.exe"));
    assertFalse(
        R2Takeout.metadata(new JSONObject("{\"photoTakenTime\":{\"timestamp\":\"bad\"}}"))
            .has("capturedAt"));
  }
}
