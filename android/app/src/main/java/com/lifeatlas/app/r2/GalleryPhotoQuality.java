package com.lifeatlas.app.r2;

import android.graphics.Bitmap;
import java.util.*;
import org.json.*;

/**
 * Tiny, deterministic derivatives. No original is changed and no general-purpose model is needed.
 */
final class GalleryPhotoQuality {
  static final String VERSION = "photo-quality-v1";

  static int gray(int c) {
    return (77 * ((c >> 16) & 255) + 150 * ((c >> 8) & 255) + 29 * (c & 255)) >> 8;
  }

  static JSONObject analyze(Bitmap source, JSONObject media) throws Exception {
    Bitmap small = Bitmap.createScaledBitmap(source, 9, 9, true);
    long horizontal = 0, vertical = 0;
    JSONArray samples = new JSONArray();
    double r = 0, g = 0, b = 0;
    int[] tinyPixels = new int[81];
    small.getPixels(tinyPixels, 0, 9, 0, 0, 9, 9);
    for (int y = 0; y < 8; y++)
      for (int x = 0; x < 8; x++) {
        int c = tinyPixels[y * 9 + x], v = gray(c), bit = y * 8 + x;
        if (v > gray(tinyPixels[y * 9 + x + 1])) horizontal |= 1L << bit;
        if (v > gray(tinyPixels[(y + 1) * 9 + x])) vertical |= 1L << bit;
        samples.put(v);
        r += ((c >> 16) & 255) / 16320d;
        g += ((c >> 8) & 255) / 16320d;
        b += (c & 255) / 16320d;
      }
    if (small != source) small.recycle();
    Arrays.fill(tinyPixels, 0);
    int width = 256,
        height = Math.max(3, Math.round(256f * source.getHeight() / source.getWidth()));
    if (height > 256) {
      height = 256;
      width = Math.max(3, Math.round(256f * source.getWidth() / source.getHeight()));
    }
    Bitmap detail = Bitmap.createScaledBitmap(source, width, height, true);
    int[] detailPixels = new int[width * height];
    detail.getPixels(detailPixels, 0, width, 0, 0, width, height);
    double sum = 0, squares = 0, light = 0;
    int clipped = 0, n = 0;
    for (int y = 1; y < height - 1; y++)
      for (int x = 1; x < width - 1; x++) {
        int v = gray(detailPixels[y * width + x]);
        double lap =
            gray(detailPixels[y * width + x - 1])
                + gray(detailPixels[y * width + x + 1])
                + gray(detailPixels[(y - 1) * width + x])
                + gray(detailPixels[(y + 1) * width + x])
                - 4 * v;
        sum += lap;
        squares += lap * lap;
        light += v;
        if (v < 6 || v > 249) clipped++;
        n++;
      }
    if (detail != source) detail.recycle();
    Arrays.fill(detailPixels, 0);
    double sharp = Math.max(0, squares / Math.max(1, n) - Math.pow(sum / Math.max(1, n), 2)),
        mean = light / (Math.max(1, n) * 255d),
        cut = clipped / (double) Math.max(1, n);
    double pixels =
        (double) media.optInt("width", source.getWidth())
            * media.optInt("height", source.getHeight());
    double score =
        100
            * (.55 * Math.min(1, Math.log1p(sharp) / Math.log(1001))
                + .30 * Math.max(0, 1 - Math.abs(mean - .5) * 1.5 - cut)
                + .15 * Math.min(1, Math.log1p(pixels) / Math.log(12000001)));
    return new JSONObject()
        .put("version", VERSION)
        .put("h", Long.toUnsignedString(horizontal, 16))
        .put("v", Long.toUnsignedString(vertical, 16))
        .put("samples", samples)
        .put("color", new JSONArray(List.of(r, g, b)))
        .put("sharpness", sharp)
        .put("light", mean)
        .put("clipped", cut)
        .put("score", score)
        .put("aspect", source.getWidth() / (double) source.getHeight());
  }

  static int distance(JSONObject a, JSONObject b) {
    return Long.bitCount(
            Long.parseUnsignedLong(a.optString("h"), 16)
                ^ Long.parseUnsignedLong(b.optString("h"), 16))
        + Long.bitCount(
            Long.parseUnsignedLong(a.optString("v"), 16)
                ^ Long.parseUnsignedLong(b.optString("v"), 16));
  }

  static boolean similar(JSONObject a, JSONObject b, long timeA, long timeB) throws Exception {
    if (!VERSION.equals(a.optString("version")) || !VERSION.equals(b.optString("version")))
      return false;
    int bits = distance(a, b);
    if (bits > 10 || Math.abs(Math.log(a.optDouble("aspect", 1) / b.optDouble("aspect", 1))) > .08)
      return false;
    if (a.optDouble("sharpness") < 3 || b.optDouble("sharpness") < 3)
      return false; // flat/dark frames aren't useful visual evidence
    JSONArray av = a.getJSONArray("samples"),
        bv = b.getJSONArray("samples"),
        ac = a.getJSONArray("color"),
        bc = b.getJSONArray("color");
    double delta = 0;
    for (int i = 0; i < 64; i++) delta += Math.abs(av.getInt(i) - bv.getInt(i));
    delta /= 64;
    if (delta > 24) return false;
    for (int i = 0; i < 3; i++) if (Math.abs(ac.getDouble(i) - bc.getDouble(i)) > .18) return false;
    boolean sameBurst = timeA > 0 && timeB > 0 && Math.abs(timeA - timeB) <= 120000;
    return sameBurst || (bits <= 2 && delta < 5);
  }
}
