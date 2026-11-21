package com.lifeatlas.app.r2;

import android.graphics.*;
import java.util.*;
import org.json.*;

/** Small quality checks on saved face crops; no model download or identity change. */
final class GalleryFaceQuality {
  static final String VERSION = "face-quality-v1";

  static double score(Bitmap image) {
    int w = image.getWidth(), h = image.getHeight();
    if (w < 3 || h < 3) return 0;
    int[] pixels = new int[w * h];
    image.getPixels(pixels, 0, w, 0, 0, w, h);
    double sum = 0, squares = 0, light = 0;
    int count = 0;
    for (int y = 1; y < h - 1; y++)
      for (int x = 1; x < w - 1; x++) {
        int at = y * w + x, v = GalleryPhotoQuality.gray(pixels[at]);
        double lap =
            GalleryPhotoQuality.gray(pixels[at - 1])
                + GalleryPhotoQuality.gray(pixels[at + 1])
                + GalleryPhotoQuality.gray(pixels[at - w])
                + GalleryPhotoQuality.gray(pixels[at + w])
                - 4 * v;
        sum += lap;
        squares += lap * lap;
        light += v;
        count++;
      }
    Arrays.fill(pixels, 0);
    double
        variance =
            Math.max(0, squares / Math.max(1, count) - Math.pow(sum / Math.max(1, count), 2)),
        mean = light / (Math.max(1, count) * 255d);
    return Math.max(0, Math.min(1, Math.log1p(variance) / Math.log(601)))
        * Math.max(0, 1 - Math.abs(mean - .5) * 1.8);
  }

  static void update(JSONObject row) throws Exception {
    JSONArray faces = row.optJSONArray("faces");
    if (faces != null)
      for (int i = 0; i < faces.length(); i++) {
        JSONObject face = faces.getJSONObject(i);
        double quality = 0;
        byte[] bytes = null;
        Bitmap crop = null;
        try {
          bytes = java.util.Base64.getDecoder().decode(face.optString("crop"));
          if (bytes.length > 131072) throw new IllegalArgumentException();
          BitmapFactory.Options bounds = new BitmapFactory.Options();
          bounds.inJustDecodeBounds = true;
          BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
          if (bounds.outWidth > 256 || bounds.outHeight > 256) throw new IllegalArgumentException();
          crop = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
          if (crop != null) quality = score(crop);
        } catch (Exception ignored) {
        } finally {
          if (crop != null) crop.recycle();
          if (bytes != null) Arrays.fill(bytes, (byte) 0);
        }
        face.put("quality", quality);
      }
    row.put("faceQualityVersion", VERSION);
  }
}
