package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import android.content.pm.ProviderInfo;
import androidx.exifinterface.media.ExifInterface;
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
public class R2GalleryLocationsTest {
  R2DeviceGalleryTest.Provider provider;
  R2Repository repo;

  @Before
  public void setup() throws Exception {
    provider = new R2DeviceGalleryTest.Provider();
    provider.original = File.createTempFile("geo-synthetic", ".jpg");
    try (InputStream in = getClass().getResourceAsStream("/gallery/synthetic.jpg");
        OutputStream out = new FileOutputStream(provider.original)) {
      byte[] b = new byte[4096];
      int n;
      while ((n = in.read(b)) != -1) out.write(b, 0, n);
    }
    ProviderInfo info = new ProviderInfo();
    info.authority = "media";
    info.exported = true;
    provider.attachInfo(RuntimeEnvironment.getApplication(), info);
    ShadowContentResolver.registerProviderInternal("media", provider);
    repo = R2TripQueueTest.repository();
  }

  JSONObject read(boolean fingerprint) throws Exception {
    return R2GalleryLocations.read(
            RuntimeEnvironment.getApplication(),
            new JSONArray().put("image:external:42"),
            null,
            fingerprint,
            repo)
        .getJSONObject(0);
  }

  @Test
  public void readsOriginalExifWithoutChangingFile() throws Exception {
    ExifInterface exif = new ExifInterface(provider.original.getAbsolutePath());
    exif.setLatLong(30.488, 79.217);
    exif.setAttribute(ExifInterface.TAG_DATETIME_ORIGINAL, "2026:11:05 08:30:00");
    exif.setAttribute(ExifInterface.TAG_OFFSET_TIME_ORIGINAL, "+05:30");
    exif.saveAttributes();
    byte[] before = java.nio.file.Files.readAllBytes(provider.original.toPath());
    JSONObject item = read(false);
    assertEquals("found", item.getString("state"));
    assertEquals(30.488, item.getJSONObject("gps").getDouble("latitude"), .00001);
    assertEquals(79.217, item.getJSONObject("gps").getDouble("longitude"), .00001);
    assertEquals(
        java.time.Instant.parse("2026-11-05T03:00:00Z").toEpochMilli(), item.getLong("capturedAt"));
    assertFalse(item.has("uri"));
    assertFalse(item.has("sha256"));
    assertArrayEquals(before, java.nio.file.Files.readAllBytes(provider.original.toPath()));
  }

  @Test
  public void missingGpsStaysMissingAndWrongVersionsAreRejected() throws Exception {
    JSONObject item = read(false);
    assertEquals("missing", item.getString("state"));
    assertFalse(item.has("gps"));
    try {
      R2GalleryLocations.read(
          RuntimeEnvironment.getApplication(),
          new JSONArray().put("image:external:42"),
          new JSONObject().put("image:external:42", "changed"),
          false,
          repo);
      fail();
    } catch (R2Exception e) {
      assertEquals("SOURCE_CHANGED", e.code);
    }
  }

  @Test
  public void parsesVideoIso6709AndRejectsInvalidCoordinates() throws Exception {
    assertEquals(
        79.217,
        R2GalleryLocations.videoPoint("+30.488+079.217+0150.0/").getDouble("longitude"),
        .00001);
    assertEquals(-33.5, R2GalleryLocations.videoPoint("-33.5+151.2/").getDouble("latitude"), .0001);
    assertNull(R2GalleryLocations.videoPoint("no location"));
    try {
      R2GalleryLocations.videoPoint("+95.0+079.0/");
      fail();
    } catch (R2Exception e) {
      assertEquals("INVALID_MEDIA_METADATA", e.code);
    }
  }

  @Test
  public void recoveryFingerprintIsKeyedStableAndDoesNotExposeRawFileHash() throws Exception {
    byte[] keys = R2Crypto.newKeyset();
    repo.store.edit(state -> state.put("keyset", Base64.getEncoder().encodeToString(keys)));
    String first = read(true).getString("fingerprint");
    assertEquals(first, read(true).getString("fingerprint"));
    assertFalse(first.contains(R2Io.sha(provider.original)));
    assertFalse(read(true).has("sha256"));
    byte[] other = R2Crypto.newKeyset();
    repo.store.edit(state -> state.put("keyset", Base64.getEncoder().encodeToString(other)));
    assertNotEquals(first, read(true).getString("fingerprint"));
  }

  @After
  public void cleanup() {
    provider.original.delete();
  }
}
