package com.lifeatlas.app.r2;

import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import androidx.work.*;
import java.util.*;
import org.json.*;

final class R2AutoBackup {
  static final String PERIODIC = "atlas-private-backup-periodic", NOW = "atlas-private-backup-scan";

  static boolean permissions(Context c, boolean images, boolean videos) {
    return (Build.VERSION.SDK_INT < 33
            ? granted(c, "android.permission.READ_EXTERNAL_STORAGE")
            : (!images || granted(c, "android.permission.READ_MEDIA_IMAGES"))
                && (!videos || granted(c, "android.permission.READ_MEDIA_VIDEO")))
        && (Build.VERSION.SDK_INT < 29 || granted(c, "android.permission.ACCESS_MEDIA_LOCATION"));
  }

  static boolean granted(Context c, String name) {
    return ContextCompat.checkSelfPermission(c, name) == PackageManager.PERMISSION_GRANTED;
  }

  static JSONObject configure(Context c, R2Repository repo, JSONObject input) throws Exception {
    boolean enabled = input.optBoolean("enabled");
    JSONObject old = repo.store.snapshot().optJSONObject("autoBackup");
    if (!enabled) {
      JSONObject value = old == null ? new JSONObject() : old;
      value.put("enabled", false);
      repo.store.edit(state -> state.put("autoBackup", value));
      WorkManager.getInstance(c).cancelUniqueWork(PERIODIC);
      WorkManager.getInstance(c).cancelUniqueWork(NOW);
      JSONArray jobs = repo.jobs();
      for (int i = 0; i < jobs.length(); i++) {
        JSONObject j = jobs.getJSONObject(i);
        if (j.optBoolean("autoBackup")
            && !Set.of("complete", "cancelled").contains(j.optString("status")))
          repo.update(j.getString("id"), v -> v.put("status", "paused"));
      }
      return value;
    }
    R2Credentials creds = repo.store.credentials("private");
    if (!repo.store.snapshot().optBoolean("recoveryVerified"))
      throw new R2Exception("RECOVERY_REQUIRED");
    repo.keyset();
    boolean photos = input.optBoolean("photos", true), videos = input.optBoolean("videos", true);
    if (!photos && !videos) throw new R2Exception("INVALID_BACKUP_SETTINGS");
    if (!permissions(c, photos, videos)) throw new R2Exception("FULL_MEDIA_ACCESS_REQUIRED");
    JSONArray albums = input.optJSONArray("albums");
    if (albums == null || albums.length() == 0 || albums.length() > 100)
      throw new R2Exception("BACKUP_ALBUM_REQUIRED");
    for (int i = 0; i < albums.length(); i++)
      if (albums.getString(i).length() > 200) throw new R2Exception("INVALID_BACKUP_SETTINGS");
    JSONObject value =
        new JSONObject()
            .put("enabled", true)
            .put("photos", photos)
            .put("videos", videos)
            .put("albums", albums)
            .put("wifiOnly", input.optBoolean("wifiOnly", true))
            .put("chargingOnly", input.optBoolean("chargingOnly", false))
            .put("videoPreviews", input.optBoolean("videoPreviews", false))
            .put("includeExisting", input.optBoolean("includeExisting", true))
            .put(
                "approvedAt",
                old == null
                        || (old.optBoolean("includeExisting", true)
                            && !input.optBoolean("includeExisting", true))
                    ? System.currentTimeMillis()
                    : old.optLong("approvedAt", System.currentTimeMillis()))
            .put("revision", creds.revision)
            .put("scope", R2Duplicates.scope(creds))
            .put("keyId", R2Crypto.keyId(repo.keyset()))
            .put("cursor", "");
    repo.store.edit(state -> state.put("autoBackup", value));
    JSONArray pending = repo.jobs(), resume = new JSONArray();
    for (int i = 0; i < pending.length(); i++) {
      JSONObject job = pending.getJSONObject(i);
      if (job.optBoolean("autoBackup")
          && creds.revision.equals(job.optString("revision"))
          && Set.of("paused", "failed", "interrupted").contains(job.optString("status"))) {
        repo.update(
            job.getString("id"),
            j ->
                j.put("status", "queued")
                    .put("backupWifiOnly", value.optBoolean("wifiOnly"))
                    .put("backupChargingOnly", value.optBoolean("chargingOnly")));
        resume.put(job.getString("id"));
      }
    }
    R2TransferWorker.enqueueBatch(c, resume);
    schedule(c, value);
    return value;
  }

  static Constraints constraints(JSONObject config) {
    return new Constraints.Builder()
        .setRequiredNetworkType(
            config.optBoolean("wifiOnly", true) ? NetworkType.UNMETERED : NetworkType.CONNECTED)
        .setRequiresCharging(config.optBoolean("chargingOnly"))
        .build();
  }

  static void schedule(Context c, JSONObject config) {
    if (!config.optBoolean("enabled")) return;
    WorkManager.getInstance(c)
        .enqueueUniquePeriodicWork(
            PERIODIC,
            ExistingPeriodicWorkPolicy.UPDATE,
            new PeriodicWorkRequest.Builder(
                    R2AutoBackupWorker.class, 1, java.util.concurrent.TimeUnit.HOURS)
                .setConstraints(constraints(config))
                .build());
    scan(c, config);
  }

  static void scan(Context c, JSONObject config) {
    if (!config.optBoolean("enabled")) return;
    WorkManager.getInstance(c)
        .enqueueUniqueWork(
            NOW,
            ExistingWorkPolicy.KEEP,
            new OneTimeWorkRequest.Builder(R2AutoBackupWorker.class)
                .addTag("atlas-r2")
                .setConstraints(constraints(config))
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL, 30, java.util.concurrent.TimeUnit.SECONDS)
                .build());
  }

  static void valid(Context c, R2Repository repo, JSONObject config) throws Exception {
    if (config == null || !config.optBoolean("enabled")) throw new R2Exception("BACKUP_DISABLED");
    R2Credentials creds = repo.store.credentials("private");
    if (!creds.revision.equals(config.optString("revision"))
        || !R2Duplicates.scope(creds).equals(config.optString("scope")))
      throw new R2Exception("CREDENTIALS_CHANGED");
    if (!repo.store.snapshot().optBoolean("recoveryVerified")
        || !R2Crypto.keyId(repo.keyset()).equals(config.optString("keyId")))
      throw new R2Exception("RECOVERY_REQUIRED");
    if (!permissions(c, config.optBoolean("photos"), config.optBoolean("videos")))
      throw new R2Exception("FULL_MEDIA_ACCESS_REQUIRED");
  }
}
