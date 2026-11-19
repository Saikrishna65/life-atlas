package com.lifeatlas.app.r2;

import android.content.Context;
import androidx.work.*;
import org.json.*;

public final class R2TakeoutWorker extends Worker {
  public R2TakeoutWorker(Context c, WorkerParameters p) {
    super(c, p);
  }

  static void enqueue(Context c, String id) {
    WorkManager.getInstance(c)
        .enqueueUniqueWork(
            "atlas-takeout-" + id,
            ExistingWorkPolicy.KEEP,
            new OneTimeWorkRequest.Builder(R2TakeoutWorker.class)
                .addTag("atlas-r2")
                .setInputData(new Data.Builder().putString("id", id).build())
                .build());
  }

  @Override
  public Result doWork() {
    String id = getInputData().getString("id");
    R2Repository repo = new R2Repository(getApplicationContext());
    try {
      setForegroundAsync(
              R2LibraryWorker.foreground(
                  getApplicationContext(),
                  "Life Atlas · Takeout import",
                  "Importing original files without re-encoding"))
          .get();
      repo.store.edit(
          state ->
              state
                  .getJSONObject("takeoutJobs")
                  .getJSONObject(id)
                  .put("status", "running")
                  .remove("error"));
      int files =
          R2Takeout.run(
              getApplicationContext(),
              repo,
              id,
              new R2Takeout.Control() {
                public void check() throws Exception {
                  if (isStopped()
                      || repo.store
                          .snapshot()
                          .getJSONObject("takeoutJobs")
                          .getJSONObject(id)
                          .optString("status")
                          .equals("paused")) throw new R2Exception("TRANSFER_INTERRUPTED");
                }

                private long last = 0;

                public void progress(String file, long bytes, int count) throws Exception {
                  long now = System.currentTimeMillis();
                  if (now - last < 500) return;
                  last = now;
                  repo.store.edit(
                      state ->
                          state
                              .getJSONObject("takeoutJobs")
                              .getJSONObject(id)
                              .put("currentFile", file)
                              .put("bytes", bytes)
                              .put("files", count));
                }
              });
      repo.store.edit(
          state ->
              state
                  .getJSONObject("takeoutJobs")
                  .getJSONObject(id)
                  .put("status", "complete")
                  .put("files", files));
      return Result.success();
    } catch (Exception e) {
      try {
        repo.store.edit(
            state -> {
              JSONObject job = state.getJSONObject("takeoutJobs").getJSONObject(id);
              if (!job.optString("status").equals("paused")) job.put("status", "failed");
              job.put("error", R2Policy.safeError(e));
            });
      } catch (Exception ignored) {
      }
      return Result.failure();
    }
  }
}
