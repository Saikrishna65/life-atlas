package com.lifeatlas.app.r2;

import android.content.Context;
import java.util.function.BooleanSupplier;
import org.json.*;

/** Small encrypted first-page cache. Every hit rechecks Android access and file identity. */
final class GallerySearchResults {
  static final String KIND = "search-results-v1";
  static final long TTL = 5 * 60 * 1000;

  static String key(
      String query, String album, String kind, JSONObject filters, JSONObject config, boolean ready)
      throws Exception {
    JSONObject scope =
        new JSONObject()
            .put("query", GalleryCorrections.normalize(query))
            .put("album", album)
            .put("kind", kind)
            .put("from", filters.optLong("from"))
            .put("to", filters.optLong("to"))
            .put("person", filters.optString("personId"))
            .put("textOnly", filters.optBoolean("textOnly"))
            .put("ocr", config.optBoolean("ocr"))
            .put("visual", config.optBoolean("visual"))
            .put("people", config.optBoolean("people"))
            .put("epoch", config.optString("epoch"))
            .put("albums", config.optJSONArray("albums"))
            .put("model", GalleryClip.REVISION)
            .put("modelReady", ready);
    return scope.toString();
  }

  static JSONObject read(
      Context context, GallerySearchStore db, String key, BooleanSupplier cancelled)
      throws Exception {
    JSONObject saved = db.cache(KIND, key);
    long age = System.currentTimeMillis() - saved.optLong("savedAt");
    if (age < 0 || age > TTL || saved.optLong("revision", -1) != db.revision()) return null;
    JSONArray refs = saved.optJSONArray("refs");
    if (refs == null || refs.length() > 80) return null;
    JSONArray items = new JSONArray();
    R2DeviceGallery gallery = new R2DeviceGallery(context);
    for (int i = 0; i < refs.length(); i++) {
      if (cancelled.getAsBoolean()) throw new R2Exception("SEARCH_CANCELLED");
      JSONObject ref = refs.getJSONObject(i), current;
      try {
        current = gallery.one(ref.getString("id"));
      } catch (Exception unavailable) {
        return null;
      }
      if (!ref.getString("stamp").equals(R2DeviceGallery.stamp(current))) return null;
      items.put(current);
    }
    return new JSONObject(saved.getJSONObject("page").toString())
        .put("items", items)
        .put("cached", true);
  }

  static void write(GallerySearchStore db, String key, long revision, JSONObject page)
      throws Exception {
    if (db.revision() != revision || !page.optString("notice").isEmpty()) return;
    JSONArray items = page.getJSONArray("items"), refs = new JSONArray();
    for (int i = 0; i < items.length(); i++) {
      JSONObject media = items.getJSONObject(i);
      refs.put(
          new JSONObject()
              .put("id", media.getString("id"))
              .put("stamp", R2DeviceGallery.stamp(media)));
    }
    JSONObject metadata = new JSONObject(page.toString());
    metadata.remove("items");
    db.cachePut(
        KIND,
        key,
        new JSONObject()
            .put("revision", revision)
            .put("savedAt", System.currentTimeMillis())
            .put("refs", refs)
            .put("page", metadata));
    db.boundCache(KIND, 16);
  }
}
