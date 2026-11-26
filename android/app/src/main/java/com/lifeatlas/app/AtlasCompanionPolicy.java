package com.lifeatlas.app;

import org.json.*;

/** One explicitly supported companion. Remote metadata cannot add packages or signing roots. */
public final class AtlasCompanionPolicy {
  public static final String FEED =
      "https://api.github.com/repos/" + AtlasUpdatePolicy.REPOSITORY + "/releases?per_page=50";
  public static final String PACKAGE = "com.lifeatlas.video";
  public static final String SIGNER =
      "f396d14bbd2076769e0edb46a3a8c4a4d4d45b57ae90a0ddd70e226e65d2d36f";
  public static final String MANIFEST = "atlas-apps.json";
  public static final String TAG = "atlas-video-";

  public static JSONObject candidate(JSONObject manifest) throws Exception {
    if (manifest.optInt("schemaVersion") != 1)
      throw new IllegalArgumentException("Unsupported app catalog");
    JSONArray entries = manifest.getJSONArray("packages");
    if (entries.length() > 4) throw new IllegalArgumentException("App catalog too large");
    JSONObject result = null;
    for (int i = 0; i < entries.length(); i++) {
      JSONObject entry = entries.getJSONObject(i);
      if (!PACKAGE.equals(entry.optString("packageId"))) continue;
      if (result != null) throw new IllegalArgumentException("Duplicate app entry");
      long version = positiveInteger(entry, "versionCode", Integer.MAX_VALUE),
          bytes = positiveInteger(entry, "bytes", AtlasUpdatePolicy.MAX_APK);
      if (version < 1
          || version > Integer.MAX_VALUE
          || bytes < 1
          || bytes > AtlasUpdatePolicy.MAX_APK
          || !entry.optString("sha256").matches("[a-f0-9]{64}")
          || !SIGNER.equals(entry.optString("signerSha256"))
          || !AtlasUpdatePolicy.releaseAsset(entry.optString("url"))
          || !AtlasUpdatePolicy.releaseAsset(entry.optString("sourceUrl"))
          || entry.optString("versionName").isEmpty()
          || entry.optString("versionName").length() > 80
          || !"GPL-3.0-or-later".equals(entry.optString("license")))
        throw new IllegalArgumentException("Untrusted companion release");
      String base = "https://github.com/" + AtlasUpdatePolicy.REPOSITORY + "/releases/download/";
      String artifactTag = entry.getString("url").substring(base.length()).split("/", -1)[0];
      if (!entry.getString("url").equals(base + artifactTag + "/atlas-video.apk")
          || !entry.getString("sourceUrl").equals(base + artifactTag + "/atlas-video-source.zip")
          || !artifactTag.matches("atlas-video-[A-Za-z0-9._-]+")
          || !entry.getString("sourceUrl").startsWith(base + artifactTag + "/"))
        throw new IllegalArgumentException(
            "APK and corresponding source must share an Atlas Video release");
      result = new JSONObject(entry.toString());
      result.put(
          "notes",
          manifest
              .optString("notes")
              .substring(0, Math.min(4000, manifest.optString("notes").length())));
    }
    return result;
  }

  private static long positiveInteger(JSONObject object, String key, long maximum) {
    Object raw = object.opt(key);
    if (!(raw instanceof Number))
      throw new IllegalArgumentException("Numeric release metadata required");
    double value = ((Number) raw).doubleValue();
    if ((Double.isNaN(value) || Double.isInfinite(value))
        || value != Math.rint(value)
        || value < 1
        || value > maximum) throw new IllegalArgumentException("Invalid release limits");
    return ((Number) raw).longValue();
  }

  private AtlasCompanionPolicy() {}
}
