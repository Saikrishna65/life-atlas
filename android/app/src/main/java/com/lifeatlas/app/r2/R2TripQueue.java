package com.lifeatlas.app.r2;

import java.util.*;
import org.json.*;

/** Durably bind every approved selection before any upload depends on WebView progress. */
final class R2TripQueue {
  static JSONObject prepare(
      R2Repository repository,
      R2Credentials c,
      String collection,
      Set<String> selected,
      Set<String> reviewedJobs,
      JSONObject saved)
      throws Exception {
    if (collection == null
        || collection.trim().isEmpty()
        || collection.length() > 140
        || selected.size() > 250) throw new R2Exception("INVALID_SELECTION");
    JSONObject bindings = new JSONObject();
    JSONArray enqueue = new JSONArray();
    repository.store.edit(
        state -> {
          JSONObject picks = state.optJSONObject("selections"),
              jobs = state.optJSONObject("transfers");
          if (jobs == null) {
            jobs = new JSONObject();
            state.put("transfers", jobs);
          }
          for (String selection : selected) {
            JSONObject source = picks == null ? null : picks.optJSONObject(selection);
            if (source == null) throw new R2Exception("SELECTION_NOT_FOUND");
            if (!source.optBoolean("persistent")) throw new R2Exception("PERSISTENT_URI_REQUIRED");
            String explicit = saved.optString(selection);
            JSONObject job = null;
            if (!explicit.isEmpty()) {
              if (!reviewedJobs.contains(explicit))
                throw new R2Exception("PUBLICATION_SCOPE_MISMATCH");
              job = jobs.optJSONObject(explicit);
              if (job == null) throw new R2Exception("TRANSFER_NOT_FOUND");
            } else {
              Iterator<String> ids = jobs.keys();
              while (ids.hasNext()) {
                JSONObject candidate = jobs.getJSONObject(ids.next());
                if (selection.equals(candidate.optString("tripSelectionId"))
                    && collection.equals(candidate.optString("tripCollection"))
                    && c.revision.equals(candidate.optString("revision"))) {
                  job = candidate;
                  break;
                }
              }
            }
            if (job != null) {
              if (!"public".equals(job.optString("slot"))
                  || !"upload".equals(job.optString("direction"))
                  || !c.revision.equals(job.optString("revision"))
                  || !source.getString("uri").equals(job.optString("source")))
                throw new R2Exception("PUBLICATION_SCOPE_MISMATCH");
              if (Set.of("cancelled", "cancelling").contains(job.optString("status")))
                throw new R2Exception("TRANSFER_NOT_RESUMABLE");
              if (Set.of("failed", "paused", "interrupted").contains(job.optString("status")))
                job.put("status", "queued").remove("error");
            } else {
              String id = UUID.randomUUID().toString(), mime = source.getString("mimeType");
              if (!mime.startsWith("image/") && !mime.startsWith("video/"))
                throw new R2Exception("INVALID_SELECTION");
              job =
                  new JSONObject()
                      .put("id", id)
                      .put("slot", "public")
                      .put("direction", "upload")
                      .put("key", R2Policy.objectKey("public", mime))
                      .put("revision", c.revision)
                      .put("source", source.getString("uri"))
                      .put("name", source.getString("name"))
                      .put("mimeType", mime)
                      .put("size", source.optLong("size"))
                      .put("status", "queued")
                      .put("stripMetadata", false)
                      .put("createdAt", System.currentTimeMillis())
                      .put("uploadedBytes", 0)
                      .put("totalBytes", source.optLong("size"));
              jobs.put(id, job);
            }
            job.put("tripSelectionId", selection).put("tripCollection", collection);
            bindings.put(selection, job.getString("id"));
            if (!job.optString("status").equals("complete")) enqueue.put(job.getString("id"));
          }
        });
    return new JSONObject().put("transferIds", bindings).put("enqueue", enqueue);
  }
}
