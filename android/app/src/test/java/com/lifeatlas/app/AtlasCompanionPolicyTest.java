package com.lifeatlas.app;

import static org.junit.Assert.*;

import org.json.*;
import org.junit.Test;

/** Pure native policy tests: no Android UI, network, installation or personal data. */
public class AtlasCompanionPolicyTest {
  private JSONObject entry() throws Exception {
    String base = "https://github.com/Saikrishna65/life-atlas/releases/download/atlas-video-1/";
    return new JSONObject()
        .put("packageId", AtlasCompanionPolicy.PACKAGE)
        .put("versionCode", 1)
        .put("versionName", "1.0")
        .put("bytes", 100)
        .put("sha256", String.join("", java.util.Collections.nCopies(64, "a")))
        .put("signerSha256", AtlasCompanionPolicy.SIGNER)
        .put("url", base + "atlas-video.apk")
        .put("sourceUrl", base + "atlas-video-source.zip")
        .put("license", "GPL-3.0-or-later");
  }

  private JSONObject manifest(JSONObject item) throws Exception {
    return new JSONObject().put("schemaVersion", 1).put("packages", new JSONArray().put(item));
  }

  @Test
  public void freshInstallUsesPinnedIdentityAndSource() throws Exception {
    assertEquals(1, AtlasCompanionPolicy.candidate(manifest(entry())).getLong("versionCode"));
    assertNull(
        AtlasCompanionPolicy.candidate(
            new JSONObject().put("schemaVersion", 1).put("packages", new JSONArray())));
  }

  @Test
  public void remoteCatalogCannotReplaceTrustedSigningRoot() throws Exception {
    for (String key : new String[] {"signerSha256", "sha256", "url", "sourceUrl", "license"}) {
      try {
        AtlasCompanionPolicy.candidate(manifest(entry().put(key, "untrusted")));
        fail(key);
      } catch (IllegalArgumentException expected) {
      }
    }
  }

  @Test
  public void anotherPackageCannotBeInstalledAndDuplicateEntriesReject() throws Exception {
    assertNull(AtlasCompanionPolicy.candidate(manifest(entry().put("packageId", "arbitrary.app"))));
    try {
      AtlasCompanionPolicy.candidate(
          manifest(entry()).put("packages", new JSONArray().put(entry()).put(entry())));
      fail();
    } catch (IllegalArgumentException expected) {
    }
  }

  @Test
  public void invalidVersionsAndCrossReleaseSourceReject() throws Exception {
    for (long version : new long[] {0, -1, 2147483648L}) {
      try {
        AtlasCompanionPolicy.candidate(manifest(entry().put("versionCode", version)));
        fail();
      } catch (IllegalArgumentException expected) {
      }
    }
    try {
      AtlasCompanionPolicy.candidate(
          manifest(
              entry()
                  .put(
                      "sourceUrl",
                      "https://github.com/Saikrishna65/life-atlas/releases/download/atlas-video-2/atlas-video-source.zip")));
      fail();
    } catch (IllegalArgumentException expected) {
    }
  }

  @Test
  public void malformedNumericMetadataCannotBeTruncated() throws Exception {
    for (Object value : new Object[] {1.5, "1", -1, 2147483648L}) {
      try {
        AtlasCompanionPolicy.candidate(manifest(entry().put("versionCode", value)));
        fail();
      } catch (IllegalArgumentException expected) {
      }
    }
  }
}
