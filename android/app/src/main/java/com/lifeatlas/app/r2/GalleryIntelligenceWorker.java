package com.lifeatlas.app.r2;

import android.content.Context;
import android.graphics.*;
import android.os.Build;
import androidx.exifinterface.media.ExifInterface;
import androidx.work.*;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.*;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.json.*;

/** Resumable, bounded MediaStore page. A unique WorkManager chain serializes indexing. */
public final class GalleryIntelligenceWorker extends Worker {
  public GalleryIntelligenceWorker(Context c, WorkerParameters p) {
    super(c, p);
  }

  private boolean stopped(GalleryIntelligence service, String epoch) {
    try {
      return isStopped() || !service.active(epoch);
    } catch (Exception e) {
      return true;
    }
  }

  static Bitmap decode(Context c, String id) throws Exception {
    if (Build.VERSION.SDK_INT >= 28)
      return ImageDecoder.decodeBitmap(
          ImageDecoder.createSource(c.getContentResolver(), R2DeviceGallery.uri(id)),
          (decoder, info, source) -> {
            decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            int width = info.getSize().getWidth(), height = info.getSize().getHeight();
            double scale = Math.min(1, 1600d / Math.max(width, height));
            decoder.setTargetSize(
                Math.max(1, (int) (width * scale)), Math.max(1, (int) (height * scale)));
          });
    BitmapFactory.Options bounds = new BitmapFactory.Options();
    bounds.inJustDecodeBounds = true;
    try (InputStream in = c.getContentResolver().openInputStream(R2DeviceGallery.uri(id))) {
      BitmapFactory.decodeStream(in, null, bounds);
    }
    if (bounds.outWidth < 1 || bounds.outHeight < 1) throw new IOException("SOURCE_UNAVAILABLE");
    BitmapFactory.Options options = new BitmapFactory.Options();
    options.inSampleSize = 1;
    while (Math.max(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 1600)
      options.inSampleSize *= 2;
    Bitmap bitmap;
    try (InputStream in = c.getContentResolver().openInputStream(R2DeviceGallery.uri(id))) {
      bitmap = BitmapFactory.decodeStream(in, null, options);
    }
    if (bitmap == null) throw new IOException("SOURCE_UNAVAILABLE");
    try (InputStream in = c.getContentResolver().openInputStream(R2DeviceGallery.uri(id))) {
      ExifInterface exif = new ExifInterface(in);
      Matrix transform = new Matrix();
      if (exif.isFlipped()) transform.postScale(-1, 1);
      transform.postRotate(exif.getRotationDegrees());
      if (!transform.isIdentity()) {
        Bitmap oriented =
            Bitmap.createBitmap(
                bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), transform, true);
        if (oriented != bitmap) bitmap.recycle();
        bitmap = oriented;
      }
    } catch (IOException ignored) {
    }
    return bitmap;
  }

  static boolean current(JSONObject row, JSONObject media, JSONObject config) {
    return row != null
        && R2DeviceGallery.stamp(media).equals(row.optString("stamp"))
        && (!config.optBoolean("ocr") || GalleryIntelligence.hasCurrentOcr(row))
        && (!config.optBoolean("visual") || row.optBoolean("visualDone"));
  }

  private static JSONObject metadata(JSONObject media) throws Exception {
    JSONObject out = new JSONObject();
    for (String k :
        List.of("id", "name", "album", "size", "modifiedAt", "capturedAt", "generation"))
      if (media.has(k)) out.put(k, media.get(k));
    return out;
  }

  @Override
  public Result doWork() {
    if (Build.VERSION.SDK_INT < 26) return Result.failure();
    GalleryIntelligence service = new GalleryIntelligence(getApplicationContext());
    String epoch = getInputData().getString("epoch");
    if (epoch == null || stopped(service, epoch)) return Result.success();
    try {
      JSONObject config = service.settings();
      // Periodic work only queues a serialized scan; it never competes with an active batch.
      if (getInputData().getBoolean("rescan", false)) {
        synchronized (GalleryIntelligence.STATE_LOCK) {
          if (!service.active(epoch)
              || !Set.of("ready", "error").contains(service.settings().optString("state")))
            return Result.success();
          service.change(
              epoch,
              v -> {
                try {
                  v.put("cursor", "").put("state", "waiting").put("scanned", 0).put("failed", 0);
                } catch (JSONException e) {
                  throw new IllegalStateException(e);
                }
              });
          service.enqueue(service.settings());
        }
        return Result.success();
      }
      if (config.optBoolean("visual") && !GalleryClip.ready(getApplicationContext())) {
        service.change(
            epoch,
            v -> {
              try {
                v.put("state", "downloading").put("error", "");
              } catch (JSONException e) {
                throw new IllegalStateException(e);
              }
            });
        synchronized (GalleryClip.LOCK) {
          GalleryClip.ensure(
              getApplicationContext(),
              () -> stopped(service, epoch),
              bytes -> setProgressAsync(new Data.Builder().putLong("downloaded", bytes).build()));
        }
        // The next page needs no network constraint once the models are installed.
        synchronized (GalleryIntelligence.STATE_LOCK) {
          if (!stopped(service, epoch)) {
            service.change(
                epoch,
                v -> {
                  try {
                    v.put("state", "waiting");
                  } catch (JSONException e) {
                    throw new IllegalStateException(e);
                  }
                });
            service.enqueue(service.settings());
          }
        }
        return Result.success();
      }
      if (stopped(service, epoch)) return Result.success();
      service.change(
          epoch,
          v -> {
            try {
              v.put("state", "indexing").put("error", "");
            } catch (JSONException e) {
              throw new IllegalStateException(e);
            }
          });
      R2DeviceGallery gallery = new R2DeviceGallery(getApplicationContext());
      JSONObject page = gallery.list(config.optString("cursor"), "", "photo", "", "newest");
      JSONArray photos = page.getJSONArray("items"), allowed = config.getJSONArray("albums");
      Set<String> albums = new HashSet<>();
      for (int i = 0; i < allowed.length(); i++) albums.add(allowed.getString(i));
      try (GallerySearchStore db = new GallerySearchStore(service.secure);
          TextRecognizer latin = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
          GalleryClip clip = new GalleryClip(getApplicationContext())) {
        for (int i = 0; i < photos.length(); i++) {
          if (stopped(service, epoch)) return Result.success();
          JSONObject media = photos.getJSONObject(i);
          if (!albums.isEmpty() && !albums.contains(media.optString("album"))) continue;
          String id = media.getString("id"), stamp = R2DeviceGallery.stamp(media);
          JSONObject row = db.get(id);
          if (current(row, media, config)) continue;
          Bitmap bitmap = null;
          com.google.android.gms.tasks.Task<Text> pending = null;
          boolean failed = false;
          try {
            bitmap = decode(getApplicationContext(), id);
            if (row == null || !stamp.equals(row.optString("stamp")))
              row = new JSONObject().put("media", metadata(media)).put("stamp", stamp);
            if (config.optBoolean("ocr") && !GalleryIntelligence.hasCurrentOcr(row)) {
              InputImage image = InputImage.fromBitmap(bitmap, 0);
              pending = latin.process(image);
              String text = Tasks.await(pending, 45, TimeUnit.SECONDS).getText();
              row.put("text", text.substring(0, Math.min(24000, text.length())))
                  .put("ocrDone", true)
                  .put("ocrVersion", GalleryIntelligence.OCR_VERSION);
            }
            if (config.optBoolean("visual") && !row.optBoolean("visualDone")) {
              float[] vector;
              synchronized (GalleryClip.LOCK) {
                if (stopped(service, epoch)) return Result.success();
                vector = clip.image(bitmap);
              }
              JSONArray values = new JSONArray();
              for (float f : vector) values.put((double) f);
              row.put("embedding", values)
                  .put("visualDone", true)
                  .put("model", GalleryClip.REVISION);
              Arrays.fill(vector, 0);
            }
            // Ignore bytes changed or removed during analysis and do not commit after pause/clear.
            synchronized (GalleryIntelligence.STATE_LOCK) {
              if (stopped(service, epoch)) return Result.success();
              if (stamp.equals(R2DeviceGallery.stamp(gallery.one(id)))) db.put(row);
            }
          } catch (SecurityException
              | java.util.concurrent.TimeoutException
              | InterruptedException e) {
            // Stop this batch rather than accumulating recognizers still holding input bitmaps.
            throw e;
          } catch (Exception e) {
            failed = true;
          } finally {
            if (bitmap != null) {
              Bitmap owned = bitmap;
              if (pending != null && !pending.isComplete())
                pending.addOnCompleteListener(Runnable::run, done -> owned.recycle());
              else owned.recycle();
            }
          }
          final boolean didFail = failed;
          service.change(
              epoch,
              v -> {
                try {
                  v.put("scanned", v.optInt("scanned") + 1)
                      .put("failed", v.optInt("failed") + (didFail ? 1 : 0))
                      .put("updatedAt", System.currentTimeMillis());
                } catch (JSONException e) {
                  throw new IllegalStateException(e);
                }
              });
        }
      }
      synchronized (GalleryIntelligence.STATE_LOCK) {
        if (stopped(service, epoch)) return Result.success();
        service.change(
            epoch,
            v -> {
              try {
                v.put("cursor", page.optString("cursor"))
                    .put("state", page.optBoolean("complete") ? "ready" : "waiting")
                    .put("updatedAt", System.currentTimeMillis());
              } catch (JSONException e) {
                throw new IllegalStateException(e);
              }
            });
        if (!page.optBoolean("complete")) service.enqueue(service.settings());
      }
      return Result.success();
    } catch (Exception error) {
      try {
        service.change(
            epoch,
            v -> {
              try {
                v.put("state", "error")
                    .put(
                        "error",
                        error instanceof SecurityException
                            ? "permission"
                            : error instanceof java.io.IOException ? "download" : "analysis");
              } catch (JSONException e) {
                throw new IllegalStateException(e);
              }
            });
      } catch (Exception ignored) {
      }
      return isStopped()
          ? Result.success()
          : getRunAttemptCount() < 3 ? Result.retry() : Result.failure();
    }
  }
}
