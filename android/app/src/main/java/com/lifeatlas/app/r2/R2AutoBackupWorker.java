package com.lifeatlas.app.r2;

import android.content.Context;
import androidx.work.*;
import java.util.*;
import org.json.*;

public final class R2AutoBackupWorker extends Worker {
  public R2AutoBackupWorker(Context c, WorkerParameters p) {
    super(c, p);
  }

  @Override
  public Result doWork() {
    R2Repository repo = new R2Repository(getApplicationContext());
    try {
      JSONObject config = repo.store.snapshot().optJSONObject("autoBackup");
      R2AutoBackup.valid(getApplicationContext(), repo, config);
      int pending = 0;
      JSONArray jobs = repo.jobs();
      for (int i = 0; i < jobs.length(); i++) {
        JSONObject j = jobs.getJSONObject(i);
        if (j.optBoolean("autoBackup")
            && !Set.of("complete", "cancelled", "failed", "paused").contains(j.optString("status")))
          pending++;
      }
      if (pending >= 80) return Result.success();
      R2DeviceGallery gallery = new R2DeviceGallery(getApplicationContext());
      String cursor = config.optString("cursor");
      int pages = 0, queued = 0;
      Set<String> albums = new HashSet<>();
      JSONArray allowed = config.getJSONArray("albums");
      for (int i = 0; i < allowed.length(); i++) albums.add(allowed.getString(i));
      try (R2LibraryStore index = new R2LibraryStore(repo)) {
        do {
          if (isStopped()) throw new R2Exception("TRANSFER_INTERRUPTED");
          R2AutoBackup.valid(
              getApplicationContext(), repo, repo.store.snapshot().optJSONObject("autoBackup"));
          JSONObject page = gallery.list(cursor, "", "all", "", "newest");
          JSONArray rows = page.getJSONArray("items"), ids = new JSONArray();
          JSONObject versions = new JSONObject();
          byte[] keys = repo.keyset();
          try {
            for (int i = 0; i < rows.length(); i++) {
              JSONObject media = rows.getJSONObject(i);
              String id = media.getString("id"), stamp = R2DeviceGallery.stamp(media);
              if (!albums.contains(media.optString("albumId"))
                  || (!config.optBoolean("photos") && media.getString("kind").equals("photo"))
                  || (!config.optBoolean("videos") && media.getString("kind").equals("video"))
                  || (!config.optBoolean("includeExisting")
                      && media.getLong("addedAt") < config.getLong("approvedAt"))) continue;
              String token = R2LibraryStore.token(keys, id + "|" + stamp);
              if (index.knownSource(token, config.getString("scope"))) continue;
              boolean known = false;
              for (int j = 0; j < jobs.length(); j++) {
                JSONObject old = jobs.getJSONObject(j);
                if (id.equals(old.optString("galleryId"))
                    && stamp.equals(old.optString("sourceStamp"))
                    && config.getString("revision").equals(old.optString("revision"))
                    && !old.optString("status").equals("cancelled")) {
                  known = true;
                  break;
                }
              }
              if (!known) {
                ids.put(id);
                versions.put(id, stamp);
              }
            }
          } finally {
            Arrays.fill(keys, (byte) 0);
          }
          if (ids.length() > 0) {
            gallery.register(ids, versions);
            JSONArray selections = new JSONArray();
            for (int i = 0; i < ids.length(); i++)
              selections.put(R2DeviceGallery.selectionId(gallery.one(ids.getString(i))));
            JSONObject batch =
                R2GalleryQueue.prepare(
                    repo, repo.store.credentials("private"), "private", selections);
            JSONArray enqueue = batch.getJSONArray("enqueue");
            for (int i = 0; i < enqueue.length(); i++)
              repo.update(
                  enqueue.getString(i),
                  j ->
                      j.put("autoBackup", true)
                          .put("backupWifiOnly", config.optBoolean("wifiOnly", true))
                          .put("backupChargingOnly", config.optBoolean("chargingOnly"))
                          .put("videoPreviews", config.optBoolean("videoPreviews")));
            R2TransferWorker.enqueueBatch(getApplicationContext(), enqueue);
            queued += enqueue.length();
          }
          cursor = page.getBoolean("complete") ? "" : page.getString("cursor");
          final String saved = cursor;
          final int count = queued;
          repo.store.edit(
              state -> {
                JSONObject live = state.getJSONObject("autoBackup");
                if (config.getString("revision").equals(live.optString("revision")))
                  live.put("cursor", saved)
                      .put("lastScan", System.currentTimeMillis())
                      .put("lastQueued", count)
                      .remove("error");
              });
          pages++;
          if (page.getBoolean("complete") || queued >= 80 || pages >= 10) break;
        } while (true);
      }
      return Result.success();
    } catch (Exception e) {
      try {
        repo.store.edit(
            state -> {
              JSONObject c = state.optJSONObject("autoBackup");
              if (c != null) c.put("error", R2Policy.safeError(e));
            });
      } catch (Exception ignored) {
      }
      return Set.of("NETWORK_UNAVAILABLE", "REMOTE_TEMPORARY_FAILURE")
              .contains(R2Policy.safeError(e))
          ? Result.retry()
          : Result.failure();
    }
  }
}
