package com.lifeatlas.app.r2;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.*;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** One queued foreground worker at a time. Persisted multipart state survives process death. */
public final class R2TransferWorker extends Worker {
  static final String CHANNEL = "atlas-r2-transfers";

  public R2TransferWorker(@NonNull Context context, @NonNull WorkerParameters params) {
    super(context, params);
  }

  public static void enqueue(Context context, String id) {
    OneTimeWorkRequest work =
        new OneTimeWorkRequest.Builder(R2TransferWorker.class)
            .setInputData(new Data.Builder().putString("id", id).build())
            .setConstraints(
                new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL, 30, java.util.concurrent.TimeUnit.SECONDS)
            .addTag("atlas-r2")
            .addTag("atlas-r2-" + id)
            .build();
    WorkManager.getInstance(context)
        .enqueueUniqueWork("atlas-r2-queue", ExistingWorkPolicy.APPEND_OR_REPLACE, work);
  }

  private ForegroundInfo notification(String id, String text, int progress) {
    Context context = getApplicationContext();
    NotificationManager manager =
        (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26)
      manager.createNotificationChannel(
          new NotificationChannel(
              CHANNEL, "Cloud media transfers", NotificationManager.IMPORTANCE_LOW));
    Notification notification =
        new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("Life Atlas · Cloud storage")
            .setContentText(text)
            .setOngoing(true)
            .setProgress(100, progress, progress < 0)
            .setOnlyAlertOnce(true)
            .build();
    return Build.VERSION.SDK_INT >= 29
        ? new ForegroundInfo(
            id.hashCode(), notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        : new ForegroundInfo(id.hashCode(), notification);
  }

  private long lastControlCheck = 0;

  private void check(R2Repository repository, String id) throws Exception {
    if (isStopped() || Thread.currentThread().isInterrupted())
      throw new R2Exception("TRANSFER_INTERRUPTED");
    long now = System.currentTimeMillis();
    if (now - lastControlCheck < 250) return;
    lastControlCheck = now;
    String status = repository.job(id).optString("status");
    if (Set.of("cancelled", "cancelling", "paused").contains(status))
      throw new R2Exception("TRANSFER_INTERRUPTED");
  }

  @NonNull
  @Override
  public Result doWork() {
    String id = getInputData().getString("id");
    if (id == null) return Result.failure();
    R2Repository repository = new R2Repository(getApplicationContext());
    try {
      JSONObject job = repository.job(id);
      if (Set.of("complete", "cancelled", "paused", "cancelling").contains(job.optString("status")))
        return Result.success();
      setForegroundAsync(notification(id, "Preparing original media", -1)).get();
      repository.checkCredentialRevision(job);
      check(repository, id);
      if (job.optString("direction").equals("download")) {
        download(repository, job);
        notifyFinished(id, true);
        return Result.success();
      }
      File staged = repository.staging(id);
      if (!job.has("sha256") || !staged.exists()) prepare(repository, job, staged);
      job = repository.job(id);
      repository.transition(id, "uploading");
      R2Client client = new R2Client(repository.store.credentials(job.getString("slot")));
      String key = job.getString("key");
      long total = staged.length();
      final long began = System.currentTimeMillis();
      final long[] last = {0};
      R2Client.Progress update =
          sent -> {
            check(repository, id);
            long now = System.currentTimeMillis();
            if (now - last[0] < 500 && sent < total) return;
            last[0] = now;
            long speed = sent * 1000 / Math.max(1, now - began);
            repository.update(
                id,
                j ->
                    j.put("uploadedBytes", sent)
                        .put("speed", speed)
                        .put("eta", speed == 0 ? 0 : (total - sent) / speed));
            setForegroundAsync(
                notification(
                    id,
                    "Uploading original · " + (sent * 100 / Math.max(1, total)) + "%",
                    (int) (sent * 100 / Math.max(1, total))));
          };
      // An interrupted completion may already have committed the unique key.
      boolean already = false;
      try {
        JSONObject remote = client.head(key);
        already =
            remote.getLong("size") == total
                && remote.optString("sha256").equals(job.getString("sha256"));
        if (!already) throw new R2Exception("OBJECT_KEY_CONFLICT");
      } catch (R2Exception e) {
        if (!e.code.equals("OBJECT_NOT_FOUND")) throw e;
      }
      if (!already) {
        if (total < 32L * 1024 * 1024) {
          Map<String, String> headers = repository.metadata(job);
          headers.put("If-None-Match", "*");
          try (R2Client.Response ignored =
              client.request(
                  "PUT",
                  key,
                  Collections.emptyMap(),
                  headers,
                  R2Client.file(staged, 0, total),
                  update)) {}
          ;
        } else {
          String uploadId = job.optString("uploadId");
          if (uploadId.isEmpty()) {
            uploadId = client.startMultipart(key, repository.metadata(job));
            final String saved = uploadId;
            repository.update(id, j -> j.put("uploadId", saved).put("parts", new JSONArray()));
          }
          JSONArray parts = repository.job(id).optJSONArray("parts");
          if (parts == null) parts = new JSONArray();
          long partSize = R2Policy.partSize(total);
          long sent = 0;
          for (int number = 1; sent < total; number++) {
            check(repository, id);
            repository.checkCredentialRevision(repository.job(id));
            long size = Math.min(partSize, total - sent);
            if (number > parts.length()) {
              final long offset = sent;
              String etag =
                  client.part(
                      key,
                      uploadId,
                      number,
                      R2Client.file(staged, sent, size),
                      n -> update.bytes(offset + n));
              parts.put(new JSONObject().put("number", number).put("etag", etag));
              final JSONArray saved = new JSONArray(parts.toString());
              repository.update(id, j -> j.put("parts", saved));
            }
            sent += size;
            update.bytes(sent);
          }
          lastControlCheck = 0;
          check(repository, id);
          client.complete(key, uploadId, parts);
        }
      }
      check(repository, id);
      repository.transition(id, "verifying");
      setForegroundAsync(notification(id, "Verifying uploaded bytes", -1));
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      long received = 0;
      try (R2Client.Response response =
          client.request("GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
        byte[] buffer = new byte[65536];
        int n;
        while ((n = response.input.read(buffer)) != -1) {
          check(repository, id);
          digest.update(buffer, 0, n);
          received += n;
        }
      }
      if (received != total || !R2Policy.hex(digest.digest()).equals(job.getString("sha256")))
        throw new R2Exception("INTEGRITY_FAILED");
      if (job.getString("slot").equals("public")) {
        try {
          byte[] thumbnail = R2Thumbnails.create(staged, job.getString("mimeType"));
          if (thumbnail != null) {
            String previewKey = "galleries/previews/" + id + ".jpg";
            String previewSha = R2Policy.digest(thumbnail);
            boolean exists = false;
            try {
              JSONObject current = client.head(previewKey);
              exists = previewSha.equals(current.optString("sha256"));
              if (!exists) throw new R2Exception("OBJECT_KEY_CONFLICT");
            } catch (R2Exception e) {
              if (!e.code.equals("OBJECT_NOT_FOUND")) throw e;
            }
            if (!exists)
              try (R2Client.Response ignored =
                  client.request(
                      "PUT",
                      previewKey,
                      Collections.emptyMap(),
                      Map.of(
                          "Content-Type",
                          "image/jpeg",
                          "Cache-Control",
                          "public, max-age=31536000, immutable",
                          "If-None-Match",
                          "*",
                          "x-amz-meta-sha256",
                          previewSha),
                      R2Client.bytes(thumbnail),
                      null)) {}
            R2Credentials publicCredentials = repository.store.credentials("public");
            repository.update(
                id,
                j ->
                    j.put("thumbnailKey", previewKey)
                        .put(
                            "thumbnailUrl",
                            publicCredentials.base.isEmpty()
                                ? ""
                                : publicCredentials.base + "/" + previewKey));
          }
        } catch (Exception e) {
          repository.update(id, j -> j.put("previewWarning", "PREVIEW_UNAVAILABLE"));
        }
      }
      R2Credentials credentials = repository.store.credentials(job.getString("slot"));
      final String url =
          job.getString("slot").equals("public") && !credentials.base.isEmpty()
              ? credentials.base + "/" + R2Policy.path(key)
              : "";
      repository.update(
          id,
          j -> {
            if (Set.of("cancelled", "cancelling", "paused").contains(j.optString("status")))
              throw new R2Exception("TRANSFER_INTERRUPTED");
            j.put("status", "complete")
                .put("verified", true)
                .put("uploadedBytes", total)
                .put("publicUrl", url)
                .put("speed", 0)
                .put("eta", 0);
            j.remove("uploadId");
            j.remove("parts");
          });
      staged.delete();
      notifyFinished(id, true);
      return Result.success();
    } catch (Exception error) {
      String code = R2Policy.safeError(error);
      try {
        String state = repository.job(id).optString("status");
        if (Set.of("cancelled", "cancelling").contains(state)) {
          try {
            repository.cleanupCancelled(id);
          } catch (Exception cleanup) {
            repository.update(
                id, j -> j.put("status", "cancelling").put("error", "CLOUD_CLEANUP_REQUIRED"));
          }
          return Result.success();
        }
        if (!Set.of("cancelled", "cancelling", "paused").contains(state))
          repository.update(
              id, j -> j.put("status", isStopped() ? "interrupted" : "failed").put("error", code));
      } catch (Exception ignored) {
      }
      if (!isStopped()) notifyFinished(id, false);
      return (code.equals("NETWORK_UNAVAILABLE") || code.equals("REMOTE_TEMPORARY_FAILURE"))
              && getRunAttemptCount() < 5
          ? Result.retry()
          : Result.success();
    }
  }

  private void notifyFinished(String id, boolean success) {
    try {
      NotificationManager manager =
          (NotificationManager)
              getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);
      manager.notify(
          id.hashCode() + 1,
          new NotificationCompat.Builder(getApplicationContext(), CHANNEL)
              .setSmallIcon(
                  success
                      ? android.R.drawable.stat_sys_upload_done
                      : android.R.drawable.stat_notify_error)
              .setContentTitle("Life Atlas cloud storage")
              .setContentText(
                  success
                      ? "Original media transfer verified."
                      : "A cloud transfer needs attention. Open Cloud Storage.")
              .setAutoCancel(true)
              .build());
    } catch (SecurityException ignored) {
    }
  }

  private void prepare(R2Repository repository, JSONObject job, File staged) throws Exception {
    String id = job.getString("id");
    repository.transition(id, "preparing");
    Uri uri = Uri.parse(job.getString("source"));
    boolean encrypted = job.getString("slot").equals("private");
    if (staged.exists() && !staged.delete()) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
    try {
      if (encrypted) {
        byte[] keyset = repository.keyset();
        try {
          if (!repository.store.snapshot().optBoolean("recoveryVerified"))
            throw new R2Exception("RECOVERY_REQUIRED");
          MessageDigest digest = MessageDigest.getInstance("SHA-256");
          long count = 0;
          byte[] buffer = new byte[65536];
          int n;
          try (InputStream input =
              getApplicationContext().getContentResolver().openInputStream(uri)) {
            if (input == null) throw new R2Exception("SOURCE_UNAVAILABLE");
            while ((n = input.read(buffer)) != -1) {
              check(repository, id);
              digest.update(buffer, 0, n);
              count += n;
            }
          }
          if (count + 128L * 1024 * 1024 > staged.getParentFile().getUsableSpace())
            throw new R2Exception("INSUFFICIENT_DEVICE_SPACE");
          JSONObject metadata =
              new JSONObject()
                  .put("name", job.getString("name"))
                  .put("mimeType", job.getString("mimeType"))
                  .put("size", count)
                  .put("sha256", R2Policy.hex(digest.digest()));
          try (InputStream source =
                  getApplicationContext().getContentResolver().openInputStream(uri);
              OutputStream output = new FileOutputStream(staged)) {
            if (source == null) throw new R2Exception("SOURCE_UNAVAILABLE");
            R2Envelope.encrypt(source, output, keyset, job.getString("key"), metadata);
          }
          final String keyId = R2Crypto.keyId(keyset);
          repository.update(id, j -> j.put("keyId", keyId));
        } finally {
          Arrays.fill(keyset, (byte) 0);
        }
      } else {
        if (job.optLong("size") + 128L * 1024 * 1024 > staged.getParentFile().getUsableSpace())
          throw new R2Exception("INSUFFICIENT_DEVICE_SPACE");
        try (InputStream input = getApplicationContext().getContentResolver().openInputStream(uri);
            OutputStream output = new FileOutputStream(staged)) {
          if (input == null) throw new R2Exception("SOURCE_UNAVAILABLE");
          byte[] buffer = new byte[65536];
          int n;
          while ((n = input.read(buffer)) != -1) {
            check(repository, id);
            output.write(buffer, 0, n);
          }
        }
      }
      if (!encrypted && job.optBoolean("stripMetadata")) {
        String mime = job.getString("mimeType");
        if (!java.util.Set.of("image/jpeg", "image/png", "image/webp").contains(mime))
          throw new R2Exception("METADATA_REMOVAL_UNSUPPORTED");
        androidx.exifinterface.media.ExifInterface exif =
            new androidx.exifinterface.media.ExifInterface(staged);
        java.util.Set<String> sensitive =
            java.util.Set.of(
                "TAG_MAKE",
                "TAG_MODEL",
                "TAG_BODY_SERIAL_NUMBER",
                "TAG_LENS_SERIAL_NUMBER",
                "TAG_CAMERA_OWNER_NAME",
                "TAG_IMAGE_UNIQUE_ID",
                "TAG_USER_COMMENT",
                "TAG_ARTIST",
                "TAG_COPYRIGHT",
                "TAG_IMAGE_DESCRIPTION",
                "TAG_DATETIME",
                "TAG_DATETIME_ORIGINAL",
                "TAG_DATETIME_DIGITIZED",
                "TAG_XMP");
        for (java.lang.reflect.Field field :
            androidx.exifinterface.media.ExifInterface.class.getFields())
          if (field.getType() == String.class
              && (field.getName().startsWith("TAG_GPS") || sensitive.contains(field.getName())))
            exif.setAttribute((String) field.get(null), null);
        exif.saveAttributes();
      }
      if (staged.length() == 0) throw new R2Exception("EMPTY_FILE");
      String sha = R2Io.sha(staged);
      long total = staged.length();
      repository.update(id, j -> j.put("sha256", sha).put("totalBytes", total));
    } catch (Exception e) {
      staged.delete();
      throw e;
    }
  }

  private void download(R2Repository repository, JSONObject job) throws Exception {
    String id = job.getString("id"), slot = job.getString("slot"), key = job.getString("key");
    R2Client client = new R2Client(repository.store.credentials(slot));
    File encrypted = repository.staging(id),
        plain = new File(repository.store.directory(), id + ".download");
    repository.transition(id, "downloading");
    try {
      JSONObject metadata = client.head(key);
      MessageDigest hash = MessageDigest.getInstance("SHA-256");
      long received = 0;
      try (R2Client.Response response =
              client.request(
                  "GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null);
          OutputStream output = new FileOutputStream(encrypted)) {
        byte[] buffer = new byte[65536];
        int n;
        long last = 0;
        while ((n = response.input.read(buffer)) != -1) {
          check(repository, id);
          output.write(buffer, 0, n);
          hash.update(buffer, 0, n);
          received += n;
          long now = System.currentTimeMillis();
          if (now - last > 500) {
            last = now;
            final long sent = received;
            repository.update(
                id, j -> j.put("uploadedBytes", sent).put("totalBytes", metadata.getLong("size")));
          }
        }
      }
      if (received != metadata.getLong("size")
          || (!metadata.optString("sha256").isEmpty()
              && !R2Policy.hex(hash.digest()).equals(metadata.getString("sha256"))))
        throw new R2Exception("INTEGRITY_FAILED");
      File outputFile = encrypted;
      JSONObject original =
          new JSONObject()
              .put("name", job.getString("name"))
              .put("mimeType", job.getString("mimeType"));
      if (slot.equals("private")) {
        byte[] keyset = repository.keyset();
        try (InputStream input = new FileInputStream(encrypted);
            OutputStream output = new FileOutputStream(plain)) {
          original = R2Envelope.decrypt(input, output, keyset, key);
        } finally {
          Arrays.fill(keyset, (byte) 0);
        }
        outputFile = plain;
      }
      check(repository, id);
      // SAF destination is only written after the complete download has authenticated.
      try (InputStream input = new FileInputStream(outputFile);
          OutputStream output =
              getApplicationContext()
                  .getContentResolver()
                  .openOutputStream(Uri.parse(job.getString("destination")), "wt")) {
        if (output == null) throw new R2Exception("DESTINATION_UNAVAILABLE");
        byte[] buffer = new byte[65536];
        int n;
        while ((n = input.read(buffer)) != -1) {
          check(repository, id);
          output.write(buffer, 0, n);
        }
      }
      final JSONObject fields = original;
      repository.update(
          id,
          j ->
              j.put("status", "complete")
                  .put("verified", true)
                  .put("name", fields.getString("name"))
                  .put("mimeType", fields.getString("mimeType")));
    } finally {
      encrypted.delete();
      plain.delete();
    }
  }
}
