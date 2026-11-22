package com.lifeatlas.app.r2;

import android.content.Context;
import androidx.work.*;
import java.util.concurrent.TimeUnit;
import org.json.*;

/** Serialized, opt-in private metadata backups; no original uploads and no JavaScript secrets. */
public final class GalleryRecoveryWorker extends Worker {
  static final String WORK = "atlas-gallery-analysis-recovery";

  public GalleryRecoveryWorker(Context c, WorkerParameters p) {
    super(c, p);
  }

  static void scheduleIfEnabled(Context c) {
    try {
      GalleryIntelligence service = new GalleryIntelligence(c);
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        JSONObject state = db.choice("recovery-settings");
        if (state.optBoolean("enabled") && state.optLong("savedRevision", -1) != db.revision())
          schedule(c, "backup", false);
      }
    } catch (Exception ignored) {
    }
  }

  static void photosChanged(Context context) {
    try {
      GalleryIntelligence service = new GalleryIntelligence(context);
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        if (db.choice("recovery-settings").optInt("unmatched") > 0
            && db.choice("recovery-staged").length() > 0) {
          schedule(context, "reconnect", false);
          return;
        }
      }
    } catch (Exception ignored) {
    }
    scheduleIfEnabled(context);
  }

  static void schedule(Context c, String action, boolean faces) throws Exception {
    schedule(
        c,
        action,
        faces,
        action.equals("restore") ? ExistingWorkPolicy.REPLACE : ExistingWorkPolicy.KEEP);
  }

  static void schedule(Context c, String action, boolean faces, ExistingWorkPolicy policy)
      throws Exception {
    GalleryIntelligence service = new GalleryIntelligence(c);
    JSONObject config = service.settings();
    Constraints.Builder constraints =
        new Constraints.Builder()
            .setRequiresCharging(config.optBoolean("chargingOnly", true))
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true);
    if (!action.equals("reconnect")) constraints.setRequiredNetworkType(NetworkType.UNMETERED);
    GalleryRecovery.progress(service, "waiting", 0, 0, "");
    WorkManager.getInstance(c)
        .enqueueUniqueWork(
            WORK,
            policy,
            new OneTimeWorkRequest.Builder(GalleryRecoveryWorker.class)
                .setInputData(
                    new Data.Builder()
                        .putString("action", action)
                        .putBoolean("faces", faces)
                        .build())
                .setConstraints(constraints.build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build());
  }

  public Result doWork() {
    GalleryIntelligence service = new GalleryIntelligence(getApplicationContext());
    String action = getInputData().getString("action");
    try {
      if (!GalleryAiBudget.reason(getApplicationContext()).isEmpty()) {
        GalleryRecovery.progress(service, "waiting", 0, 0, "");
        return Result.retry();
      }
      if ("restore".equals(action))
        GalleryRecovery.restore(
            getApplicationContext(), getInputData().getBoolean("faces", false), this::isStopped);
      else if ("reconnect".equals(action))
        GalleryRecovery.reconnect(getApplicationContext(), this::isStopped);
      else GalleryRecovery.backup(getApplicationContext(), this::isStopped);
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        JSONObject state = db.choice("recovery-settings");
        if (db.count() > 0
            && state.optBoolean("enabled")
            && state.optLong("savedRevision", -1) != db.revision()
            && !"restore".equals(action))
          schedule(getApplicationContext(), "backup", false, ExistingWorkPolicy.APPEND_OR_REPLACE);
      }
      return Result.success();
    } catch (Exception e) {
      if (isStopped()) return Result.success();
      try {
        GalleryRecovery.progress(service, "error", 0, 0, R2Policy.safeError(e));
      } catch (Exception ignored) {
      }
      return e instanceof java.io.IOException && getRunAttemptCount() < 3
          ? Result.retry()
          : Result.failure();
    }
  }
}
