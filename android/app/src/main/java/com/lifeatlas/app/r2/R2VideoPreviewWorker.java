package com.lifeatlas.app.r2;

import android.content.Context;
import android.net.Uri;
import android.os.*;
import androidx.media3.common.*;
import androidx.media3.effect.Presentation;
import androidx.media3.transformer.*;
import androidx.work.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Official Media3 creates a separate, explicitly labelled 15-second 720p H.264 preview. */
@androidx.media3.common.util.UnstableApi
public final class R2VideoPreviewWorker extends Worker {
  public R2VideoPreviewWorker(Context c, WorkerParameters p) {
    super(c, p);
  }

  static void enqueue(Context c, String id, String source) {
    WorkManager.getInstance(c)
        .enqueueUniqueWork(
            "atlas-video-preview-" + id,
            ExistingWorkPolicy.KEEP,
            new OneTimeWorkRequest.Builder(R2VideoPreviewWorker.class)
                .addTag("atlas-r2")
                .setInputData(
                    new Data.Builder().putString("id", id).putString("source", source).build())
                .setConstraints(
                    new Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.UNMETERED)
                        .setRequiresCharging(true)
                        .build())
                .build());
  }

  @Override
  public Result doWork() {
    R2Repository repo = new R2Repository(getApplicationContext());
    File output =
        new File(getApplicationContext().getCacheDir(), UUID.randomUUID() + "-preview.mp4");
    final Transformer[] active = {null};
    java.util.concurrent.atomic.AtomicBoolean cancelled =
        new java.util.concurrent.atomic.AtomicBoolean();
    Handler main = new Handler(Looper.getMainLooper());
    try {
      setForegroundAsync(
              R2LibraryWorker.foreground(
                  getApplicationContext(),
                  "Atlas · Video preview",
                  "Creating a separate short preview; original stays unchanged"))
          .get();
      String id = getInputData().getString("id"), source = getInputData().getString("source");
      try (R2LibraryStore store = new R2LibraryStore(repo)) {
        JSONObject r = store.get(id);
        R2Library.checkScope(repo, r);
        if (!r.getString("state").equals("active") || r.optBoolean("hasClip"))
          return Result.success();
        if (!source.startsWith("content://")) throw new R2Exception("SOURCE_UNAVAILABLE");
        CompletableFuture<Void> done = new CompletableFuture<>();
        main.post(
            () -> {
              try {
                if (cancelled.get()) return;
                MediaItem item =
                    new MediaItem.Builder()
                        .setUri(Uri.parse(source))
                        .setClippingConfiguration(
                            new MediaItem.ClippingConfiguration.Builder()
                                .setEndPositionMs(15000)
                                .build())
                        .build();
                EditedMediaItem edit =
                    new EditedMediaItem.Builder(item)
                        .setEffects(
                            new Effects(
                                Collections.emptyList(),
                                Collections.singletonList(Presentation.createForHeight(720))))
                        .build();
                active[0] =
                    new Transformer.Builder(getApplicationContext())
                        .setVideoMimeType(MimeTypes.VIDEO_H264)
                        .setAudioMimeType(MimeTypes.AUDIO_AAC)
                        .addListener(
                            new Transformer.Listener() {
                              @Override
                              public void onCompleted(
                                  Composition composition, ExportResult result) {
                                done.complete(null);
                              }

                              @Override
                              public void onError(
                                  Composition composition,
                                  ExportResult result,
                                  ExportException error) {
                                done.completeExceptionally(error);
                              }
                            })
                        .build();
                active[0].start(edit, output.getAbsolutePath());
              } catch (Exception e) {
                done.completeExceptionally(e);
              }
            });
        long began = System.currentTimeMillis();
        while (!done.isDone()) {
          if (isStopped() || System.currentTimeMillis() - began > 8 * 60 * 1000)
            throw new R2Exception("PREVIEW_UNAVAILABLE");
          try {
            done.get(1, TimeUnit.SECONDS);
          } catch (TimeoutException ignored) {
          }
        }
        done.get();
        if (!output.exists() || output.length() == 0 || output.length() > 64L * 1024 * 1024)
          throw new R2Exception("PREVIEW_UNAVAILABLE");
        String key = "encrypted/previews/" + id + "-" + UUID.randomUUID() + "-clip.atlas";
        File encrypted = new File(output.getAbsolutePath() + ".atlas");
        byte[] keys = repo.keyset();
        try {
          try (InputStream in = new FileInputStream(output);
              OutputStream out = new FileOutputStream(encrypted)) {
            R2Envelope.encrypt(
                in,
                out,
                keys,
                key,
                new JSONObject()
                    .put("name", "preview.mp4")
                    .put("mimeType", "video/mp4")
                    .put("size", output.length())
                    .put("sha256", R2Io.sha(output)));
          }
          r = store.get(id);
          R2Library.checkScope(repo, r);
          if (!r.optString("state").equals("active")) return Result.success();
          String sha = R2Io.sha(encrypted);
          R2Client client = new R2Client(repo.store.credentials("private"));
          try (R2Client.Response response =
              client.request(
                  "PUT",
                  key,
                  Collections.emptyMap(),
                  Map.of(
                      "content-type",
                      "application/octet-stream",
                      "if-none-match",
                      "*",
                      "x-amz-meta-sha256",
                      sha),
                  R2Client.file(encrypted, 0, encrypted.length()),
                  null)) {}
          try (R2Client.Response response =
              client.request(
                  "GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
            java.security.MessageDigest hash = java.security.MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[65536];
            int n;
            while ((n = response.input.read(buffer)) != -1) hash.update(buffer, 0, n);
            if (!sha.equals(R2Policy.hex(hash.digest()))) throw new R2Exception("INTEGRITY_FAILED");
          }
          r = store.get(id);
          R2Library.checkScope(repo, r);
          if (!r.optString("state").equals("active")) {
            client.delete(key);
            return Result.success();
          }
          JSONObject next =
              R2Library.revise(r, "active")
                  .put("clipKey", key)
                  .put("clipSha256", sha)
                  .put("hasClip", true);
          next.remove("previewError");
          store.put(next, true);
          R2Library.sync(repo, store, next);
        } finally {
          Arrays.fill(keys, (byte) 0);
          encrypted.delete();
        }
      }
      return Result.success();
    } catch (Exception e) {
      try (R2LibraryStore store = new R2LibraryStore(repo)) {
        JSONObject r = store.get(getInputData().getString("id"));
        r = R2Library.revise(r, r.getString("state")).put("previewError", R2Policy.safeError(e));
        store.put(r, true);
      } catch (Exception ignored) {
      }
      return Result.failure();
    } finally {
      cancelled.set(true);
      main.post(
          () -> {
            if (active[0] != null) active[0].cancel();
            output.delete();
          });
      output.delete();
    }
  }
}
