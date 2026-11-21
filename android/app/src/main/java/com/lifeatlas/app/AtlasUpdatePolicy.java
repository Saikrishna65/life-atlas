package com.lifeatlas.app;

import java.net.URI;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;

/** Fixed public release origin; no arbitrary download URLs or caller-supplied hashes. */
public final class AtlasUpdatePolicy {
  public static final String REPOSITORY = "Saikrishna65/life-atlas";
  public static final String FEED =
      "https://api.github.com/repos/" + REPOSITORY + "/releases?per_page=15";
  public static final long MAX_APK = 300L * 1024 * 1024;

  public static boolean trustedUrl(String text) {
    try {
      URI uri = new URI(text);
      return "https".equals(uri.getScheme())
          && uri.getUserInfo() == null
          && (uri.getPort() == -1 || uri.getPort() == 443)
          && Arrays.asList(
                  "github.com",
                  "api.github.com",
                  "objects.githubusercontent.com",
                  "release-assets.githubusercontent.com")
              .contains(uri.getHost());
    } catch (Exception e) {
      return false;
    }
  }

  public static boolean releaseAsset(String text) {
    return trustedUrl(text)
        && text.startsWith("https://github.com/" + REPOSITORY + "/releases/download/")
        && !text.contains("..")
        && !text.contains("?")
        && !text.contains("#");
  }

  public static JSONObject candidate(JSONObject manifest, String packageId, long installed)
      throws Exception {
    if (manifest.optInt("schemaVersion") != 1)
      throw new IllegalArgumentException("Unsupported update catalog.");
    JSONArray entries = manifest.getJSONArray("packages");
    if (entries.length() > 4) throw new IllegalArgumentException("Invalid update catalog.");
    for (int i = 0; i < entries.length(); i++) {
      JSONObject entry = entries.getJSONObject(i);
      if (!packageId.equals(entry.optString("packageId"))) continue;
      long version = entry.getLong("versionCode"), bytes = entry.getLong("bytes");
      if (version <= installed) return null;
      if (version > Integer.MAX_VALUE
          || bytes <= 0
          || bytes > MAX_APK
          || !entry.optString("sha256").matches("[a-f0-9]{64}")
          || !releaseAsset(entry.optString("url"))
          || entry.optString("versionName").length() > 80)
        throw new IllegalArgumentException("Invalid update catalog.");
      JSONObject result = new JSONObject(entry.toString());
      result.put(
          "notes",
          manifest
              .optString("notes", "Atlas app update.")
              .substring(
                  0, Math.min(4000, manifest.optString("notes", "Atlas app update.").length())));
      return result;
    }
    return null;
  }

  private AtlasUpdatePolicy() {}
}
