package com.lifeatlas.app.r2;

import java.util.*;
import org.json.*;

/** Public-only relations: source keys, face labels and private AI metadata are never projected. */
final class R2PublicMetadata {
  static JSONArray placements(JSONObject item) throws Exception {
    JSONArray input = item.optJSONArray("placements");
    if (input != null) return input;
    JSONObject relation =
        new JSONObject()
            .put("category", item.getString("category"))
            .put("collection", item.optString("collection"));
    JSONArray tags = item.optJSONArray("tags");
    if (tags != null)
      for (int i = 0; i < tags.length(); i++) {
        String tag = tags.optString(i);
        if (tag.startsWith("place:")) relation.put("placeName", tag.substring(6));
        else if (tag.startsWith("place-id:")) relation.put("placeId", tag.substring(9));
      }
    return new JSONArray().put(relation);
  }

  static JSONObject merge(JSONObject previous, JSONObject item) throws Exception {
    JSONObject out = new JSONObject(item.toString());
    LinkedHashMap<String, JSONObject> relations = new LinkedHashMap<>();
    for (JSONObject source : new JSONObject[] {previous, item}) {
      if (source == null) continue;
      JSONArray all = placements(source);
      for (int i = 0; i < all.length(); i++) {
        JSONObject r = all.getJSONObject(i);
        String category = r.getString("category"), collection = r.optString("collection");
        if (!Set.of(
                    "destination",
                    "expedition",
                    "gallery",
                    "memory",
                    "cinematic",
                    "music-artwork",
                    "atlas-visual")
                .contains(category)
            || collection.length() > 140) throw new R2Exception("INVALID_PUBLIC_METADATA");
        String placeId = r.optString("placeId"), placeName = r.optString("placeName");
        if (placeId.length() > 80
            || (!placeId.isEmpty() && !placeId.matches("[a-zA-Z0-9_-]+"))
            || placeName.length() > 140) throw new R2Exception("INVALID_PUBLIC_METADATA");
        JSONObject safe = new JSONObject().put("category", category).put("collection", collection);
        if (!placeId.isEmpty()) safe.put("placeId", placeId);
        if (!placeName.isEmpty()) safe.put("placeName", placeName);
        relations.put(category + "\n" + collection + "\n" + placeId + "\n" + placeName, safe);
      }
    }
    if (relations.size() > 64) throw new R2Exception("INVALID_PUBLIC_METADATA");
    return out.put("metadataVersion", 1)
        .put("assetId", item.optString("assetId", item.getString("id")))
        .put("placements", new JSONArray(relations.values()));
  }
}
