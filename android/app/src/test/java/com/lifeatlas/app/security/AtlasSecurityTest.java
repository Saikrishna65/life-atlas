package com.lifeatlas.app.security;

import static org.junit.Assert.*;

import java.io.*;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class AtlasSecurityTest {
  @Before
  public void clear() {
    File file =
        new File(
            RuntimeEnvironment.getApplication().getNoBackupFilesDir(),
            "atlas-security-policy.json");
    file.delete();
    new File(file + ".bak").delete();
    AtlasSecurity.lock();
  }

  @Test
  public void freshDeviceRequiresNoAuthenticationAnywhere() throws Exception {
    JSONObject policy = AtlasSecurity.policy(RuntimeEnvironment.getApplication());
    assertEquals(8, policy.length());
    for (String scope : AtlasSecurity.SCOPES)
      assertFalse(AtlasSecurity.required(RuntimeEnvironment.getApplication(), scope));
  }

  @Test
  public void defaultCallsNeverOpenDeviceVerificationAndEnabledChecksFailClosed() throws Exception {
    var activity = Robolectric.buildActivity(android.app.Activity.class).setup().get();
    var granted = new java.util.concurrent.atomic.AtomicInteger();
    AtlasSecurity.require(activity, "backups", false, granted::incrementAndGet, code -> fail(code));
    org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
    assertEquals(1, granted.get());
    AtlasSecurity.save(activity, new JSONObject().put("backups", true));
    var errors = new java.util.ArrayList<String>();
    AtlasSecurity.require(activity, "backups", false, granted::incrementAndGet, errors::add);
    org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
    assertEquals(1, granted.get());
    assertEquals("DEVICE_LOCK_REQUIRED", errors.get(0));
  }

  @Test
  public void policiesStayOnDeviceAndCannotSilentlyCoerceInvalidValues() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    AtlasSecurity.save(context, new JSONObject().put("deletion", true));
    assertTrue(AtlasSecurity.required(context, "deletion"));
    assertFalse(AtlasSecurity.required(context, "gallery"));
    try {
      AtlasSecurity.normalize(new JSONObject().put("app", "false"));
      fail();
    } catch (Exception expected) {
    }
    try {
      AtlasSecurity.normalize(new JSONObject().put("unknown", true));
      fail();
    } catch (Exception expected) {
    }
    try (FileOutputStream out =
        new FileOutputStream(
            new File(context.getNoBackupFilesDir(), "atlas-security-policy.json"))) {
      out.write("broken".getBytes());
    }
    try {
      AtlasSecurity.policy(context);
      fail("Corruption must not disable existing protection");
    } catch (Exception expected) {
    }
  }

  @Test
  public void enabledAppLockAlsoProtectsNativeOperations() throws Exception {
    var context = RuntimeEnvironment.getApplication();
    AtlasSecurity.save(context, new JSONObject().put("app", true));
    for (String scope : AtlasSecurity.SCOPES) assertTrue(AtlasSecurity.required(context, scope));
  }

  @Test
  public void storageOperationsUseTheIntendedOptionalScope() {
    assertEquals("cloudCredentials", AtlasSecurity.storageScope("saveConfiguration", "public"));
    assertEquals("publishing", AtlasSecurity.storageScope("beginTripPublication", "public"));
    assertEquals("deletion", AtlasSecurity.storageScope("trashDeviceMedia", "private"));
    assertEquals("gallery", AtlasSecurity.storageScope("beginLibrarySession", "private"));
    assertEquals("backups", AtlasSecurity.storageScope("uploadObject", "private"));
  }
}
