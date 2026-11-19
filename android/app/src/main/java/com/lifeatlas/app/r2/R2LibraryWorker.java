package com.lifeatlas.app.r2;

import android.app.*;
import android.content.Context;
import android.content.pm.ServiceInfo;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.work.*;
import java.util.*;
import org.json.*;

public final class R2LibraryWorker extends Worker {
  private static final java.util.concurrent.atomic.AtomicInteger NOTIFICATIONS =
      new java.util.concurrent.atomic.AtomicInteger(18406);

  public R2LibraryWorker(Context c, WorkerParameters p) {
    super(c, p);
  }

  static void enqueue(Context c, String action) {
    WorkManager.getInstance(c)
        .enqueueUniqueWork(
            "atlas-library-" + action,
            ExistingWorkPolicy.KEEP,
            new OneTimeWorkRequest.Builder(R2LibraryWorker.class)
                .addTag("atlas-r2")
                .setInputData(new Data.Builder().putString("action", action).build())
                .setConstraints(
                    new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL, 30, java.util.concurrent.TimeUnit.SECONDS)
                .build());
  }

  static ForegroundInfo foreground(Context context, String title, String text) {
    NotificationManager manager =
        (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    manager.createNotificationChannel(
        new NotificationChannel(
            "atlas-library", "Photo library", NotificationManager.IMPORTANCE_LOW));
    Notification n =
        new NotificationCompat.Builder(context, "atlas-library")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .build();
    return Build.VERSION.SDK_INT >= 29
        ? new ForegroundInfo(
            NOTIFICATIONS.incrementAndGet(), n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        : new ForegroundInfo(NOTIFICATIONS.incrementAndGet(), n);
  }

  void status(R2Repository repo, String action, String state, int count, String error)
      throws Exception {
    repo.store.edit(
        value ->
            value.put(
                "libraryTask",
                new JSONObject()
                    .put("action", action)
                    .put("status", state)
                    .put("processed", count)
                    .put("error", error)
                    .put("updatedAt", System.currentTimeMillis())));
  }

  @Override
  public Result doWork() {
    R2Repository repo = new R2Repository(getApplicationContext());
    String action = getInputData().getString("action");
    int count = 0;
    try {
      setForegroundAsync(
              foreground(
                  getApplicationContext(),
                  "Life Atlas · Library",
                  action.equals("restore")
                      ? "Restoring encrypted media index"
                      : "Synchronizing recovery records"))
          .get();
      status(repo, action, "running", 0, "");
      try (R2LibraryStore store = new R2LibraryStore(repo)) {
        if (action.equals("restore")) {
          byte[] keys = repo.keyset();
          try {
            R2Client client = new R2Client(repo.store.credentials("private"));
            String prefix = R2Library.prefix(keys), cursor = "";
            Set<String> seen = new HashSet<>();
            do {
              if (isStopped()) throw new R2Exception("TRANSFER_INTERRUPTED");
              JSONObject page = client.list(prefix, cursor);
              JSONArray objects = page.getJSONArray("objects");
              for (int i = 0; i < objects.length(); i++) {
                if (isStopped()) throw new R2Exception("TRANSFER_INTERRUPTED");
                String path = objects.getJSONObject(i).getString("key");
                try (R2Client.Response response =
                    client.request(
                        "GET", path, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
                  JSONObject record = R2LibraryStore.decode(response.read(256 * 1024), keys, path);
                  if (!R2Library.recordKey(keys, record).equals(path))
                    throw new R2Exception("INVALID_LIBRARY_RECORD");
                  store.merge(record);
                  count++;
                  status(repo, action, "running", count, "");
                }
              }
              if (page.getBoolean("complete")) break;
              cursor = page.getString("cursor");
              if (!seen.add(cursor)) throw new R2Exception("INVALID_LIBRARY_RECORD");
            } while (true);
          } finally {
            Arrays.fill(keys, (byte) 0);
          }
        } else if (action.equals("reconcile")) {
          JSONArray jobs = repo.jobs();
          for (int i = 0; i < jobs.length(); i++) {
            JSONObject job = jobs.getJSONObject(i);
            if (!job.optString("direction").equals("upload")
                || !job.optString("status").equals("complete")
                || !job.optBoolean("verified")) continue;
            if (isStopped()) throw new R2Exception("TRANSFER_INTERRUPTED");
            R2Client client = new R2Client(repo.store.credentials(job.getString("slot")));
            if (!job.optString("storageScope").isEmpty()
                && !R2Duplicates.scope(repo.store.credentials(job.getString("slot")))
                    .equals(job.optString("storageScope"))) continue;
            JSONObject head = client.head(job.getString("key"));
            if (head.optLong("size") != job.getLong("totalBytes")
                || !head.optString("sha256").equals(job.getString("sha256")))
              throw new R2Exception("INTEGRITY_FAILED");
            R2Library.commit(getApplicationContext(), repo, job);
            count++;
            status(repo, action, "running", count, "");
          }
        } else {
          JSONArray dirty;
          do {
            dirty = store.dirty(50);
            for (int i = 0; i < dirty.length(); i++) {
              if (isStopped()) throw new R2Exception("TRANSFER_INTERRUPTED");
              R2Library.sync(repo, store, dirty.getJSONObject(i));
              count++;
              status(repo, action, "running", count, "");
            }
          } while (dirty.length() > 0);
        }
      }
      status(repo, action, "complete", count, "");
      return Result.success();
    } catch (Exception e) {
      try {
        status(repo, action, "failed", count, R2Policy.safeError(e));
      } catch (Exception ignored) {
      }
      return Set.of("NETWORK_UNAVAILABLE", "REMOTE_TEMPORARY_FAILURE")
              .contains(R2Policy.safeError(e))
          ? Result.retry()
          : Result.failure();
    }
  }
}
