package com.lifeatlas.app.r2;

import android.os.*;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** Foreground-only, bounded decoded index. Ciphertext remains the sole persistent index. */
final class GallerySearchHotCache {
  static final long LIMIT = 24L * 1024 * 1024;
  private static final LinkedHashMap<String, Entry> entries = new LinkedHashMap<>(16, .75f, true);
  private static long bytes;
  private static boolean enabled = true;
  private static final Handler IDLE = new Handler(Looper.getMainLooper());
  private static final Runnable RELEASE = GallerySearchHotCache::clear;

  interface Loader {
    JSONObject read() throws Exception;
  }

  static final class Entry {
    final JSONObject row;
    final float[] vector;
    final String fileText, recognizedText;
    final byte[] digest;
    final long bytes;

    Entry(JSONObject value, byte[] digest) throws Exception {
      this.digest = digest;
      JSONArray embedding = value.optJSONArray("embedding");
      vector = embedding != null && embedding.length() == 512 ? new float[512] : null;
      if (vector != null) for (int i = 0; i < 512; i++) vector[i] = (float) embedding.getDouble(i);
      row = new JSONObject();
      for (String field : List.of("media", "stamp", "text", "ocrDone", "ocrVersion", "model"))
        if (value.has(field)) row.put(field, value.get(field));
      JSONObject media = row.getJSONObject("media");
      fileText =
          (media.optString("name") + " " + media.optString("album")).toLowerCase(Locale.ROOT);
      recognizedText = (fileText + " " + row.optString("text")).toLowerCase(Locale.ROOT);
      bytes = 2048L + row.toString().length() * 4L + (vector == null ? 0 : 2048);
    }
  }

  static synchronized void touch() {
    if (!enabled) return;
    IDLE.removeCallbacks(RELEASE);
    IDLE.postDelayed(RELEASE, 30000);
  }

  static synchronized void clear() {
    entries.clear();
    bytes = 0;
    IDLE.removeCallbacks(RELEASE);
  }

  static synchronized void suspend() {
    clear();
    enabled = false;
  }

  static synchronized void resume() {
    enabled = true;
  }

  static synchronized long bytes() {
    return bytes;
  }

  static synchronized Entry get(
      String scope, String token, byte[] payload, boolean legacy, Loader loader) throws Exception {
    if (!enabled) return new Entry(loader.read(), new byte[0]);
    byte[] digest = MessageDigest.getInstance("SHA-256").digest(payload);
    String key = scope + ":" + legacy + ":" + token;
    Entry old = entries.get(key);
    if (old != null && Arrays.equals(old.digest, digest)) return old;
    if (old != null) {
      entries.remove(key);
      bytes -= old.bytes;
    }
    Entry fresh = new Entry(loader.read(), digest);
    if (fresh.bytes <= LIMIT) {
      entries.put(key, fresh);
      bytes += fresh.bytes;
      while (bytes > LIMIT || entries.size() > 12000) {
        String first = entries.keySet().iterator().next();
        bytes -= entries.remove(first).bytes;
      }
    }
    return fresh;
  }
}
