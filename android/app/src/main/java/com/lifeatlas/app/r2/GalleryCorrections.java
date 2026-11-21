package com.lifeatlas.app.r2;

import java.util.*;
import org.json.*;

/** Owner-confirmed, encrypted personalization; never trains or replaces model weights. */
final class GalleryCorrections {
  static String normalize(String query) {
    return query.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
  }

  static void save(GalleryIntelligence service, JSONObject input) throws Exception {
    JSONObject media = new R2DeviceGallery(service.context).one(input.getString("id"));
    String key = media.getString("id") + "|" + R2DeviceGallery.stamp(media);
    String label = input.optString("label").trim(), query = normalize(input.optString("query"));
    if (label.length() > 200 || query.length() > 200) throw new R2Exception("INVALID_SELECTION");
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      JSONObject choices = db.choice("search-feedback");
      if (input.optBoolean("clear")) choices.remove(key);
      else {
        if (!choices.has(key) && choices.length() >= 2048)
          throw new R2Exception("CATALOG_LIMIT_REACHED");
        JSONObject row = choices.optJSONObject(key);
        if (row == null) row = new JSONObject();
        if (input.has("label")) row.put("label", label);
        if (!query.isEmpty()) {
          JSONObject votes = row.optJSONObject("queries");
          if (votes == null) votes = new JSONObject();
          String token = GallerySearchStore.token(query);
          if (votes.length() >= 32 && !votes.has(token)) votes.remove(votes.keys().next());
          votes.put(token, input.optBoolean("relevant"));
          row.put("queries", votes);
        }
        choices.put(key, row);
        JSONObject indexed = db.get(media.getString("id"));
        if (indexed == null)
          db.put(new JSONObject().put("media", media).put("stamp", R2DeviceGallery.stamp(media)));
      }
      db.choice("search-feedback", choices);
    }
    GalleryRecoveryWorker.scheduleIfEnabled(service.context);
  }

  static double adjust(
      JSONObject choices,
      JSONObject media,
      String stamp,
      String query,
      List<String> terms,
      double score)
      throws Exception {
    JSONObject row = choices.optJSONObject(media.getString("id") + "|" + stamp);
    if (row == null) return score;
    JSONObject votes = row.optJSONObject("queries");
    String token = GallerySearchStore.token(normalize(query));
    if (votes != null && votes.has(token)) return votes.optBoolean(token) ? 3 : 0;
    if (!terms.isEmpty() && GalleryIntelligence.textMatch(row.optString("label"), terms))
      return Math.max(score, 2.5);
    return score;
  }
}
