package com.lifeatlas.app.r2;

import android.content.Context;
import java.util.*;
import org.json.*;

final class R2ImportedMetadata {
  static JSONObject find(Context context, R2Repository repo, String galleryId) throws Exception {
    if (!new java.io.File(repo.store.directory(), "library.db").exists()) return null;
    try (R2LibraryStore store = new R2LibraryStore(repo)) {
      JSONObject record = R2Takeout.imported(store, R2DeviceGallery.uri(galleryId));
      if (record == null) return null;
      JSONObject metadata = record.optJSONObject("metadata");
      JSONObject out = metadata == null ? new JSONObject() : new JSONObject(metadata.toString());
      out.put(
          "albums",
          record.optJSONArray("albums") == null ? new JSONArray() : record.getJSONArray("albums"));
      JSONObject album =
          store.importGet(
              "album:"
                  + R2Policy.digest(
                      record
                          .optString("folder")
                          .getBytes(java.nio.charset.StandardCharsets.UTF_8)));
      if (album != null) out.put("albumTitle", album.optString("title"));
      return out;
    }
  }
}
