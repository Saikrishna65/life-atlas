package com.lifeatlas.app.r2;

import java.io.File;
import java.util.Arrays;
import java.util.Comparator;
import org.json.JSONObject;

/** Rebuildable display copies only. Never changes original media or analysis settings. */
final class GalleryPreviewSettings {
  final int quality, maxEdge, limitMiB;
  private static long lastPrune;
  private static GalleryPreviewSettings memo;
  private static String memoPath;
  private static long memoAt;

  GalleryPreviewSettings(JSONObject value) {
    quality = Math.max(70, Math.min(98, value.optInt("previewQuality", 92)));
    maxEdge = Math.max(512, Math.min(2560, value.optInt("previewMaxEdge", 1280)));
    limitMiB = value.optInt("limitMiB", 96);
  }

  static synchronized GalleryPreviewSettings read(R2SecureStore secure) throws Exception {
    String path = secure.directory().getAbsolutePath();
    long now = System.currentTimeMillis();
    if (memo != null && path.equals(memoPath) && now - memoAt < 3000) return memo;
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      memo = new GalleryPreviewSettings(db.choice("cache-settings"));
      memoPath = path;
      memoAt = now;
      return memo;
    }
  }

  static synchronized void invalidate() {
    memo = null;
  }

  int edge(int pixels) {
    int requested = Math.max(256, Math.min(maxEdge, pixels));
    for (int bucket : new int[] {256, 384, 512, 768, 1024, 1280, 1920, 2560})
      if (bucket >= requested) return Math.min(bucket, maxEdge);
    return maxEdge;
  }

  static synchronized void pruneIfDue(File root, long limit, File keep) {
    long now = System.currentTimeMillis();
    // Batch directory enumeration, rather than sorting the entire cache for each photo.
    if (now - lastPrune < 5000) return;
    lastPrune = now;
    File[] files = root.listFiles(f -> f.isFile() && !f.getName().endsWith(".new"));
    if (files == null) return;
    Arrays.sort(files, Comparator.comparingLong(File::lastModified));
    long bytes = 0;
    for (File file : files) bytes += file.length();
    for (File file : files) {
      if (bytes <= limit) break;
      if (file.equals(keep)) continue;
      long size = file.length();
      if (file.delete()) bytes -= size;
    }
  }
}
