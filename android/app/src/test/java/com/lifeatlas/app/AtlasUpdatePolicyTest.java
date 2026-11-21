package com.lifeatlas.app;

import static org.junit.Assert.*;

import android.content.ComponentName;
import android.content.pm.ActivityInfo;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@GraphicsMode(GraphicsMode.Mode.LEGACY)
@SQLiteMode(SQLiteMode.Mode.LEGACY)
public class AtlasUpdatePolicyTest {
  private JSONObject entry(String pkg, long version) throws Exception {
    return new JSONObject()
        .put("packageId", pkg)
        .put("versionCode", version)
        .put("versionName", "2.1.1")
        .put("bytes", 1000)
        .put("sha256", "a".repeat(64))
        .put(
            "url",
            "https://github.com/Saikrishna65/life-atlas/releases/download/atlas-install-update-123/atlas.apk");
  }

  private JSONObject manifest(JSONObject e) throws Exception {
    return new JSONObject()
        .put("schemaVersion", 1)
        .put("packages", new JSONArray().put(e))
        .put("notes", "New release");
  }

  @Test
  public void appIdentityAndDowngradeAreCheckedBeforeAnyDownload() throws Exception {
    assertNotNull(
        AtlasUpdatePolicy.candidate(
            manifest(entry("com.lifeatlas.app.next", 36)), "com.lifeatlas.app.next", 35));
    assertNull(
        AtlasUpdatePolicy.candidate(
            manifest(entry("com.lifeatlas.app.next", 35)), "com.lifeatlas.app.next", 35));
    assertNull(
        AtlasUpdatePolicy.candidate(
            manifest(entry("com.lifeatlas.app.next", 34)), "com.lifeatlas.app.next", 35));
    assertNull(
        AtlasUpdatePolicy.candidate(
            manifest(entry("com.lifeatlas.app", 36)), "com.lifeatlas.app.next", 35));
  }

  @Test
  public void arbitraryEndpointsAndOversizedOrUnhashedDownloadsAreRefused() throws Exception {
    for (String url :
        new String[] {
          "http://github.com/x",
          "https://github.com.evil.test/x",
          "https://evil@github.com/x",
          "file:///tmp/a.apk",
          "https://github.com:444/x",
          "https://api.github.com/repos/other/releases/1",
          "https://github.com/other/repo/releases/download/1/a.apk"
        }) {
      JSONObject e = entry("com.lifeatlas.app.next", 36).put("url", url);
      assertThrows(
          Exception.class,
          () -> AtlasUpdatePolicy.candidate(manifest(e), "com.lifeatlas.app.next", 35));
    }
    for (Object invalid : new Object[] {0, AtlasUpdatePolicy.MAX_APK + 1}) {
      JSONObject e = entry("com.lifeatlas.app.next", 36).put("bytes", invalid);
      assertThrows(
          Exception.class,
          () -> AtlasUpdatePolicy.candidate(manifest(e), "com.lifeatlas.app.next", 35));
    }
    assertThrows(
        Exception.class,
        () ->
            AtlasUpdatePolicy.candidate(
                manifest(entry("com.lifeatlas.app.next", 36).put("sha256", "missing")),
                "com.lifeatlas.app.next",
                35));
    assertTrue(AtlasUpdatePolicy.trustedUrl("https://release-assets.githubusercontent.com/path"));
  }

  @Test
  public void secondLauncherSharesTheRealActivityAndDoesNotBecomeASeparateApp() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    ActivityInfo alias =
        context
            .getPackageManager()
            .getActivityInfo(new ComponentName(context, "com.lifeatlas.app.GalleryLauncher"), 0);
    assertTrue(alias.exported);
    assertTrue(alias.enabled);
    assertEquals("com.lifeatlas.app.MainActivity", alias.targetActivity);
    assertEquals(context.getPackageName(), alias.packageName);
    assertEquals("Atlas Gallery", alias.loadLabel(context.getPackageManager()).toString());
  }
}
