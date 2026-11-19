package com.lifeatlas.app.r2;

import java.util.*;
import org.json.*;

/** Atomically persist a complete Gallery batch before handing it to WorkManager. */
final class R2GalleryQueue {
  static JSONObject prepare(
      R2Repository repo, R2Credentials credentials, String slot, JSONArray ids) throws Exception {
    R2Policy.slot(slot);
    if (slot.equals("private") && !repo.store.snapshot().optBoolean("recoveryVerified"))
      throw new R2Exception("RECOVERY_REQUIRED");

    if (ids == null || ids.length() == 0 || ids.length() > 100)
      throw new R2Exception("INVALID_SELECTION");
    JSONObject bindings = new JSONObject();
    JSONArray enqueue = new JSONArray();
    repo.store.edit(
        state -> {
          JSONObject picks = state.optJSONObject("selections"),
              jobs = state.optJSONObject("transfers");
          if (jobs == null) {
            jobs = new JSONObject();
            state.put("transfers", jobs);
          }
          for (int i = 0; i < ids.length(); i++) {
            String selection = ids.getString(i);
            if (bindings.has(selection)) continue;
            JSONObject source = picks == null ? null : picks.optJSONObject(selection);
            if (source == null || !source.optBoolean("persistent"))
              throw new R2Exception("SELECTION_NOT_FOUND");
            JSONObject job = null;
            Iterator<String> keys = jobs.keys();
            while (keys.hasNext()) {
              JSONObject candidate = jobs.getJSONObject(keys.next());
              if (selection.equals(candidate.optString("gallerySelectionId"))
                  && slot.equals(candidate.optString("slot"))
                  && credentials.revision.equals(candidate.optString("revision"))
                  && !Set.of("cancelled", "cancelling", "complete")
                      .contains(candidate.optString("status"))) {
                job = candidate;
                break;
              }
            }
            if (job == null) {
              String id = UUID.randomUUID().toString();
              job =
                  new JSONObject()
                      .put("id", id)
                      .put("slot", slot)
                      .put("direction", "upload")
                      .put("key", R2Policy.objectKey(slot, source.getString("mimeType")))
                      .put("revision", credentials.revision)
                      .put("source", source.getString("uri"))
                      .put("name", source.getString("name"))
                      .put("mimeType", source.getString("mimeType"))
                      .put("size", source.optLong("size"))
                      .put("totalBytes", source.optLong("size"))
                      .put("uploadedBytes", 0)
                      .put("status", "queued")
                      .put("createdAt", System.currentTimeMillis())
                      .put("gallerySelectionId", selection)
                      .put("galleryApproved", true)
                      .put("galleryId", source.optString("galleryId"))
                      .put("sourceStamp", source.optString("sourceStamp"));
              jobs.put(id, job);
            } else if (Set.of("failed", "paused", "interrupted")
                .contains(job.optString("status"))) {
              job.put("status", "queued");
              job.remove("error");
            }
            bindings.put(selection, job.getString("id"));
            if (!job.optString("status").equals("complete")) enqueue.put(job.getString("id"));
          }
        });
    return new JSONObject().put("transferIds", bindings).put("enqueue", enqueue);
  }
}
