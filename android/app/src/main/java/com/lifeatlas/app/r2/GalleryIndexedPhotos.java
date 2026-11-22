package com.lifeatlas.app.r2;

import android.content.Context;
import android.database.Cursor;
import java.util.*;
import org.json.*;

/**
 * One inexpensive MediaStore pass revalidates index rows, including limited permissions and trash.
 */
final class GalleryIndexedPhotos {
  static final int MAX_PHOTOS = 100000, MAX_FACES = 50000;

  static final class Photo {
    final String id, stamp;
    final long time;
    final JSONObject quality;
    final List<Face> faces;

    Photo(String id, String stamp, long time, JSONObject quality, List<Face> faces) {
      this.id = id;
      this.stamp = stamp;
      this.time = time;
      this.quality = quality;
      this.faces = faces;
    }
  }

  static final class Face {
    final String id, mediaId;
    final float[] vector;
    final long time;
    final long hash;
    double quality = 1;

    Face(String id, String mediaId, float[] vector, long time) {
      this.id = id;
      this.mediaId = mediaId;
      this.vector = vector;
      this.time = time;
      this.hash = signature(vector);
    }
  }

  final List<Photo> photos = new ArrayList<>();
  boolean partial;

  GalleryIndexedPhotos(List<Photo> seed) {
    photos.addAll(seed);
  }

  GalleryIndexedPhotos(
      Context c, GallerySearchStore db, JSONObject config, boolean withQuality, boolean withFaces)
      throws Exception {
    Set<String> allowed = new HashSet<>();
    JSONArray a = config.optJSONArray("albums");
    if (a != null) for (int i = 0; i < a.length(); i++) allowed.add(a.getString(i));
    Set<String> ids = new HashSet<>();
    int faces = 0;
    try (Cursor cursor = db.summaryRows()) {
      while (cursor.moveToNext()) {
        if (photos.size() == MAX_PHOTOS) {
          partial = true;
          break;
        }
        JSONObject row = db.readSummary(cursor.getString(0), cursor.getBlob(1)),
            m = row.getJSONObject("media");
        if (!allowed.isEmpty() && !allowed.contains(m.optString("album"))) continue;
        JSONObject q = withQuality ? row.optJSONObject("quality") : null;
        List<Face> fs = new ArrayList<>();
        long date = m.optLong("capturedAt", 0);
        if (date <= 0) date = m.optLong("addedAt", 0);
        String id = m.getString("id");
        if (withFaces && GalleryFaceModels.VERSION.equals(row.optString("faceVersion"))) {
          JSONArray array = row.optJSONArray("faces");
          if (array != null)
            for (int i = 0; i < array.length(); i++) {
              if (faces >= MAX_FACES) {
                partial = true;
                break;
              }
              JSONObject f = array.getJSONObject(i);
              JSONArray v = f.optJSONArray("embedding");
              if (v == null || v.length() != 128) continue;
              float[] vector = new float[128];
              for (int j = 0; j < 128; j++) vector[j] = (float) v.getDouble(j);
              Face face =
                  new Face(f.getString("id"), id, GalleryFaceModels.normalize(vector), date);
              double quality = f.optDouble("quality", 1);
              face.quality = Double.isFinite(quality) ? Math.max(0, Math.min(1, quality)) : 0;
              fs.add(face);
              faces++;
            }
        }
        if (q == null && fs.isEmpty()) continue;
        photos.add(new Photo(id, row.getString("stamp"), date, q, fs));
        ids.add(id);
      }
    }
    Map<String, String> visible = new R2DeviceGallery(c).accessibleVersions(ids);
    photos.removeIf(p -> !p.stamp.equals(visible.get(p.id)));
    photos.sort(Comparator.comparingLong((Photo p) -> p.time).thenComparing(p -> p.id));
  }

  static double cosine(float[] a, float[] b) {
    double v = 0;
    for (int i = 0; i < 128; i++) v += a[i] * b[i];
    return v;
  }

  /**
   * Fixed-sign random projection, used only to limit candidate comparisons, never as an identity.
   */
  private static final byte[][] SIGNS = new byte[32][128];

  static {
    Random random = new Random(0x41544c41534cL);
    for (byte[] plane : SIGNS)
      for (int i = 0; i < plane.length; i++) plane[i] = (byte) (random.nextBoolean() ? 1 : -1);
  }

  static long signature(float[] vector) {
    long result = 0;
    for (int b = 0; b < SIGNS.length; b++) {
      double dot = 0;
      for (int i = 0; i < 128; i++) dot += SIGNS[b][i] * vector[i];
      if (dot >= 0) result |= 1L << b;
    }
    return result;
  }

  static JSONObject page(List<JSONObject> rows, String cursor) throws Exception {
    int offset = cursor == null || cursor.isEmpty() ? 0 : Integer.parseInt(cursor);
    if (offset < 0 || offset > rows.size()) throw new R2Exception("INVALID_SELECTION");
    JSONArray items = new JSONArray();
    int end = Math.min(rows.size(), offset + 40);
    for (int i = offset; i < end; i++) items.put(rows.get(i));
    return new JSONObject()
        .put("collections", items)
        .put("cursor", end < rows.size() ? Integer.toString(end) : "")
        .put("complete", end >= rows.size());
  }
}
