package com.lifeatlas.app.r2;

import java.util.*;
import org.json.*;

/**
 * Encrypted, bounded work journal and aggregate timings. No queries, OCR or filenames in metrics.
 */
final class GalleryAnalysisHealth {
  static final String KEY = "analysis-health-v1";
  static final int LIMIT = 2000, BATCH = 20;

  static JSONObject read(GallerySearchStore db) throws Exception {
    return db.choice(KEY);
  }

  static JSONObject failures(JSONObject state) {
    JSONObject value = state.optJSONObject("failures");
    return value == null ? new JSONObject() : value;
  }

  static JSONArray queue(JSONObject state) {
    JSONArray value = state.optJSONArray("queue");
    return value == null ? new JSONArray() : value;
  }

  static boolean enqueue(JSONObject state, String id, String stamp, boolean first)
      throws Exception {
    JSONArray old = queue(state), next = new JSONArray();
    JSONObject item = new JSONObject().put("id", id).put("stamp", stamp);
    if (first) next.put(item);
    boolean found = false;
    for (int i = 0; i < old.length(); i++) {
      JSONObject row = old.getJSONObject(i);
      if (id.equals(row.optString("id"))) {
        found = true;
        if (!first) next.put(item);
      } else next.put(row);
    }
    if (!first && !found) next.put(item);
    if (next.length() > LIMIT) throw new R2Exception("CATALOG_LIMIT_REACHED");
    state.put("queue", next);
    return !found;
  }

  static void completed(JSONObject state, String id, String stamp, boolean failed)
      throws Exception {
    JSONObject failures = failures(state);
    JSONArray next = new JSONArray(), old = queue(state);
    for (int i = 0; i < old.length(); i++)
      if (!id.equals(old.getJSONObject(i).optString("id"))
          || (!stamp.isEmpty() && !stamp.equals(old.getJSONObject(i).optString("stamp"))))
        next.put(old.get(i));
    if (failed) {
      if (failures.has(id) || failures.length() < LIMIT) failures.put(id, stamp);
      else state.put("failureLimit", true);
    } else if (stamp.isEmpty() || stamp.equals(failures.optString(id))) failures.remove(id);
    state.put("failures", failures).put("queue", next);
  }

  static void attempt(GalleryIntelligence service, String id, String stamp, boolean failed)
      throws Exception {
    synchronized (GalleryIntelligence.STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        JSONObject state = read(db);
        if (!state.has("failures") && !state.has("legacyFailures"))
          state.put("legacyFailures", service.settings().optInt("failed"));
        if (!failed && queue(state).length() == 0 && !failures(state).has(id)) return;
        completed(state, id, stamp, failed);
        db.choice(KEY, state);
      }
    }
  }

  static JSONArray batch(GalleryIntelligence service, R2DeviceGallery gallery) throws Exception {
    JSONArray result = new JSONArray();
    synchronized (GalleryIntelligence.STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        JSONObject state = read(db);
        JSONArray pending = queue(state);
        boolean changed = false;
        for (int i = 0; i < pending.length() && result.length() < BATCH; i++) {
          JSONObject queued = pending.getJSONObject(i);
          String id = queued.getString("id");
          try {
            JSONObject media = gallery.one(id);
            if (!queued.getString("stamp").equals(R2DeviceGallery.stamp(media))) {
              completed(state, id, "", false);
              changed = true;
            } else result.put(media);
          } catch (Exception unavailable) {
            completed(state, id, "", false);
            changed = true;
          }
        }
        if (changed) db.choice(KEY, state);
      }
    }
    return result;
  }

  static JSONObject request(GalleryIntelligence service, String id, boolean retry)
      throws Exception {
    synchronized (GalleryIntelligence.STATE_LOCK) {
      JSONObject config = service.settings();
      if (!config.optBoolean("enabled"))
        return new JSONObject().put("queued", 0).put("reason", "paused");
      int added = 0, pending = 0;
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        JSONObject state = read(db);
        if (!state.has("failures") && !state.has("legacyFailures"))
          state.put("legacyFailures", config.optInt("failed"));
        if (retry) {
          JSONObject failed = failures(state);
          LinkedHashMap<String, JSONObject> pendingRows = new LinkedHashMap<>();
          JSONArray existing = queue(state);
          for (int i = 0; i < existing.length(); i++) {
            JSONObject row = existing.getJSONObject(i);
            pendingRows.put(row.getString("id"), row);
          }
          for (String key : GalleryRecovery.keys(failed)) {
            if (!pendingRows.containsKey(key) && pendingRows.size() < LIMIT) {
              pendingRows.put(
                  key, new JSONObject().put("id", key).put("stamp", failed.getString(key)));
              added++;
            }
          }
          state.put("queue", new JSONArray(pendingRows.values()));
        } else {
          if (!id.startsWith("image:")) throw new R2Exception("INVALID_SELECTION");
          JSONObject media = new R2DeviceGallery(service.context).one(id), row = db.readiness(id);
          JSONArray allowed = config.optJSONArray("albums");
          if (allowed != null
              && allowed.length() > 0
              && !GalleryPeople.set(allowed).contains(media.optString("album")))
            return new JSONObject().put("queued", 0).put("reason", "album");
          if (GalleryIntelligenceWorker.current(row, media, config))
            return new JSONObject().put("queued", 0).put("reason", "current");
          if (enqueue(state, id, R2DeviceGallery.stamp(media), true)) added++;
        }
        db.choice(KEY, state);
        pending = queue(state).length();
      }
      if ((added > 0 || pending > 0)
          && Set.of("ready", "error").contains(config.optString("state"))) {
        boolean restarting = config.optString("state").equals("error");
        if (restarting) {
          config.put("epoch", UUID.randomUUID().toString());
          androidx.work.WorkManager.getInstance(service.context)
              .cancelUniqueWork(GalleryIntelligence.WORK);
        }
        config.put("state", "waiting").put("targeted", true).put("error", "");
        service.writeSettings(config);
        service.enqueue(config);
        if (restarting) service.schedule(config);
      }
      return new JSONObject().put("queued", added);
    }
  }

  static void beginPass(GallerySearchStore db) throws Exception {
    JSONObject state = read(db);
    if (state.optInt("legacyFailures") > 0 || state.optBoolean("failureLimit")) {
      state.put("legacyFailures", 0).put("failureLimit", false);
      db.choice(KEY, state);
    }
  }

  static void metric(GalleryIntelligence service, String key, long elapsed) {
    if (!Set.of("search-text", "search-visual", "search-cached", "analysis-batch").contains(key))
      return;
    try {
      synchronized (GalleryIntelligence.STATE_LOCK) {
        try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
          JSONObject metrics = db.choice("analysis-metrics-v1"), row = metrics.optJSONObject(key);
          if (row == null) row = new JSONObject();
          long count = Math.min(1000000, row.optLong("count"));
          long total = Math.min(1000000000000L, row.optLong("totalMs"));
          row.put("count", count + 1)
              .put("totalMs", total + Math.max(0, elapsed))
              .put("lastMs", Math.max(0, elapsed))
              .put("maxMs", Math.max(row.optLong("maxMs"), elapsed));
          metrics.put(key, row);
          db.choice("analysis-metrics-v1", metrics);
        }
      }
    } catch (Exception optionalDiagnosticFailure) {
    }
  }

  static JSONObject report(GalleryIntelligence service) throws Exception {
    synchronized (GalleryIntelligence.STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        JSONObject state = read(db), config = service.settings();
        JSONObject out =
            new JSONObject()
                .put(
                    "legacyFailures",
                    state.optInt(
                        "legacyFailures", !state.has("failures") ? config.optInt("failed") : 0))
                .put("failed", failures(state).length())
                .put("queued", queue(state).length())
                .put("failureLimit", state.optBoolean("failureLimit"))
                .put("passWorkMs", config.optLong("passWorkMs"))
                .put("checked", config.optInt("checked"))
                .put("indexed", db.count())
                .put("metrics", db.choice("analysis-metrics-v1"));
        // A bounded metadata-only count, cached for one minute; not repeated on every poll.
        String scope =
            config.optLong("scanStarted")
                + ":"
                + config.optLong("since")
                + ":"
                + config.optJSONArray("albums");
        long age = System.currentTimeMillis() - state.optLong("countedAt");
        if (!scope.equals(state.optString("countScope")) || age < 0 || age > 60000) {
          int total = new R2DeviceGallery(service.context).countAnalysisPhotos(config);
          state
              .put("passTotal", total)
              .put("countScope", scope)
              .put("countedAt", System.currentTimeMillis());
          db.choice(KEY, state);
        }
        long indexBytes = 0;
        for (String suffix : new String[] {"", "-wal", "-shm", "-journal"})
          indexBytes +=
              new java.io.File(service.secure.directory(), "gallery-search.db" + suffix).length();
        out.put("indexBytes", indexBytes)
            .put("decodedSearchBytes", GallerySearchHotCache.bytes())
            .put("decodedSearchBudgetBytes", GallerySearchHotCache.budget());
        int total = state.optInt("passTotal", -1);
        out.put("passTotal", total);
        out.put("remaining", total < 0 ? -1 : Math.max(0, total - config.optInt("checked")));
        return out;
      }
    }
  }
}
