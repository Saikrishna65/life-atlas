package com.lifeatlas.app.r2;

import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import com.google.android.gms.tasks.*;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.segmentation.subject.*;
import com.google.mlkit.vision.text.*;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.*;

/** Read-only source operations. OCR choices remain encrypted; stickers are explicit PNG copies. */
final class GalleryExtraction {
  private static final AtomicBoolean BUSY = new AtomicBoolean();

  static JSONObject text(Context context, R2SecureStore secure, String id) throws Exception {
    JSONObject media = new R2DeviceGallery(context).one(id);
    if (!media.optString("kind").equals("photo")) throw new R2Exception("INVALID_SELECTION");
    String key = media.getString("id") + "|" + R2DeviceGallery.stamp(media);
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      JSONObject cached = db.choice("extraction-text").optJSONObject(key);
      if (cached != null) return cached;
    }
    if (!BUSY.compareAndSet(false, true)) throw new R2Exception("EXTRACTION_BUSY");
    Bitmap bitmap = null;
    TextRecognizer recognizer = null;
    Task<Text> task = null;
    try {
      bitmap = GalleryIntelligenceWorker.decode(context, id);
      recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
      task = recognizer.process(InputImage.fromBitmap(bitmap, 0));
      Text result = Tasks.await(task, 30, TimeUnit.SECONDS);
      JSONArray blocks = new JSONArray();
      for (Text.TextBlock block : result.getTextBlocks())
        for (Text.Line line : block.getLines()) {
          if (blocks.length() >= 1000) break;
          Rect rect = line.getBoundingBox();
          if (rect == null) continue;
          blocks.put(
              new JSONObject()
                  .put("text", line.getText().substring(0, Math.min(2000, line.getText().length())))
                  .put("left", Math.max(0, rect.left / (double) bitmap.getWidth()))
                  .put("top", Math.max(0, rect.top / (double) bitmap.getHeight()))
                  .put("width", Math.min(1, rect.width() / (double) bitmap.getWidth()))
                  .put("height", Math.min(1, rect.height() / (double) bitmap.getHeight())));
        }
      JSONObject out =
          new JSONObject()
              .put(
                  "text", result.getText().substring(0, Math.min(24000, result.getText().length())))
              .put("blocks", blocks);
      try (GallerySearchStore db = new GallerySearchStore(secure)) {
        JSONObject cache = db.choice("extraction-text");
        if (cache.length() >= 32 && !cache.has(key)) cache.remove(cache.keys().next());
        cache.put(key, out);
        db.choice("extraction-text", cache);
      }
      return out;
    } finally {
      if (task != null && !task.isComplete()) {
        final Bitmap image = bitmap;
        final TextRecognizer client = recognizer;
        task.addOnCompleteListener(
            Runnable::run,
            ignored -> {
              if (image != null) image.recycle();
              if (client != null) client.close();
              BUSY.set(false);
            });
      } else {
        if (bitmap != null) bitmap.recycle();
        if (recognizer != null) recognizer.close();
        BUSY.set(false);
      }
    }
  }

  static File directory(Context c) throws Exception {
    File dir = new File(c.getCacheDir(), "gallery-stickers");
    if (!dir.isDirectory() && !dir.mkdirs()) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
    return dir;
  }

  static File file(Context c, String token) throws Exception {
    if (!token.matches("[a-f0-9-]{36}")) throw new R2Exception("INVALID_SELECTION");
    File file = new File(directory(c), token + ".png");
    if (!file.isFile()) throw new R2Exception("OBJECT_NOT_FOUND");
    return file;
  }

  static JSONObject sticker(Context context, JSONObject input) throws Exception {
    if (!input.optBoolean("consent")) throw new R2Exception("EXTRACTION_CONSENT_REQUIRED");
    String id = input.getString("id");
    JSONObject media = new R2DeviceGallery(context).one(id);
    if (!media.optString("kind").equals("photo")) throw new R2Exception("INVALID_SELECTION");
    if (!BUSY.compareAndSet(false, true)) throw new R2Exception("EXTRACTION_BUSY");
    Bitmap bitmap = null;
    SubjectSegmenter segmenter = null;
    Task<SubjectSegmentationResult> task = null;
    try {
      bitmap = GalleryIntelligenceWorker.decode(context, id);
      segmenter =
          SubjectSegmentation.getClient(
              new SubjectSegmenterOptions.Builder()
                  .enableForegroundBitmap()
                  .enableMultipleSubjects(
                      new SubjectSegmenterOptions.SubjectResultOptions.Builder()
                          .enableSubjectBitmap()
                          .build())
                  .build());
      task = segmenter.process(InputImage.fromBitmap(bitmap, 0));
      SubjectSegmentationResult result = Tasks.await(task, 30, TimeUnit.SECONDS);
      double x = Math.max(0, Math.min(1, input.optDouble("x", .5))) * bitmap.getWidth(),
          y = Math.max(0, Math.min(1, input.optDouble("y", .5))) * bitmap.getHeight();
      Subject chosen = null;
      long area = Long.MAX_VALUE;
      for (Subject candidate : result.getSubjects())
        if (x >= candidate.getStartX()
            && x <= candidate.getStartX() + candidate.getWidth()
            && y >= candidate.getStartY()
            && y <= candidate.getStartY() + candidate.getHeight()) {
          long size = (long) candidate.getWidth() * candidate.getHeight();
          if (size < area) {
            chosen = candidate;
            area = size;
          }
        }
      Bitmap cutout = chosen == null ? null : chosen.getBitmap();
      if (cutout == null) throw new R2Exception("SUBJECT_NOT_FOUND");
      File[] old = directory(context).listFiles();
      if (old != null) {
        Arrays.sort(old, Comparator.comparingLong(File::lastModified));
        long total = 0;
        for (File f : old) total += f.length();
        for (int i = 0; i < old.length && (total > 24 * 1024 * 1024 || i < old.length - 23); i++) {
          total -= old[i].length();
          old[i].delete();
        }
      }
      String token = UUID.randomUUID().toString();
      File file = new File(directory(context), token + ".png");
      try (FileOutputStream out = new FileOutputStream(file)) {
        if (!cutout.compress(Bitmap.CompressFormat.PNG, 100, out))
          throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
      }
      JSONObject value =
          new JSONObject()
              .put("token", token)
              .put("path", file.getAbsolutePath())
              .put("width", cutout.getWidth())
              .put("height", cutout.getHeight());
      for (Subject subject : result.getSubjects())
        if (subject.getBitmap() != null) subject.getBitmap().recycle();
      if (result.getForegroundBitmap() != null) result.getForegroundBitmap().recycle();
      return value;
    } catch (java.util.concurrent.ExecutionException | java.util.concurrent.TimeoutException e) {
      throw new R2Exception("SUBJECT_MODEL_UNAVAILABLE");
    } finally {
      if (task != null && !task.isComplete()) {
        final Bitmap image = bitmap;
        final SubjectSegmenter client = segmenter;
        task.addOnCompleteListener(
            Runnable::run,
            ignored -> {
              if (image != null) image.recycle();
              if (client != null) client.close();
              BUSY.set(false);
            });
      } else {
        if (bitmap != null) bitmap.recycle();
        if (segmenter != null) segmenter.close();
        BUSY.set(false);
      }
    }
  }

  static void save(Context c, String token) throws Exception {
    if (Build.VERSION.SDK_INT < 29) throw new R2Exception("ANDROID_VERSION_UNSUPPORTED");
    File source = file(c, token);
    ContentValues values = new ContentValues();
    values.put(
        MediaStore.Images.Media.DISPLAY_NAME,
        "Atlas sticker " + System.currentTimeMillis() + ".png");
    values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
    values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Atlas Stickers");
    values.put(MediaStore.Images.Media.IS_PENDING, 1);
    Uri uri =
        c.getContentResolver()
            .insert(
                MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
    if (uri == null) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
    boolean done = false;
    try (InputStream in = new FileInputStream(source);
        OutputStream out = c.getContentResolver().openOutputStream(uri)) {
      if (out == null) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
      byte[] buf = new byte[32768];
      int n;
      while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
      done = true;
    } finally {
      if (!done) c.getContentResolver().delete(uri, null, null);
    }
    values.clear();
    values.put(MediaStore.Images.Media.IS_PENDING, 0);
    c.getContentResolver().update(uri, values, null, null);
  }
}
