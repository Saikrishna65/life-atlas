package com.lifeatlas.app.r2;

import android.content.*;
import android.graphics.*;
import android.media.*;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import java.io.*;
import java.nio.ByteBuffer;
import java.util.*;
import org.json.*;

/** Bounded, explicit media operations. Camera originals are always read-only. */
final class GalleryMediaTools {
  static JSONObject viewer(Context context, R2SecureStore secure, String id) throws Exception {
    JSONObject media = new R2DeviceGallery(context).one(id);
    String key = media.getString("id") + "|" + R2DeviceGallery.stamp(media);
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      JSONObject state = db.choice("viewer-state"),
          positions = state.optJSONObject("positions"),
          covers = state.optJSONObject("covers"),
          edits = db.choice("edits");
      JSONObject result =
          new JSONObject()
              .put("position", positions == null ? 0 : positions.optDouble(key, 0))
              .put("cover", covers == null ? 0 : covers.optDouble(key, 0));
      JSONObject edit = edits.optJSONObject(key);
      if (edit != null) {
        String original = edit.optString("originalKey");
        int split = original.indexOf('|');
        if (split > 0)
          try {
            JSONObject source = new R2DeviceGallery(context).one(original.substring(0, split));
            if (original.equals(source.getString("id") + "|" + R2DeviceGallery.stamp(source)))
              result.put("original", source).put("recipe", edit.optJSONObject("recipe"));
          } catch (Exception ignored) {
          }
      }
      return result;
    }
  }

  static double duration(Context context, JSONObject media) throws Exception {
    double result = media.optLong("duration") / 1000d;
    if (result > 0) return result;
    MediaMetadataRetriever retriever = new MediaMetadataRetriever();
    try {
      retriever.setDataSource(context, R2DeviceGallery.uri(media.getString("id")));
      String value = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
      if (value != null) result = Long.parseLong(value) / 1000d;
    } finally {
      retriever.release();
    }
    if (result <= 0) throw new R2Exception("VIDEO_METADATA_UNAVAILABLE");
    return result;
  }

  static void videoState(Context context, R2SecureStore secure, JSONObject input) throws Exception {
    JSONObject media = new R2DeviceGallery(context).one(input.getString("id"));
    if (!"video".equals(media.getString("kind"))) throw new R2Exception("INVALID_SELECTION");
    double seconds = input.optDouble("seconds", -1);
    if (!Double.isFinite(seconds) || seconds < 0 || seconds > duration(context, media) + .5)
      throw new R2Exception("INVALID_SELECTION");
    String field = input.optBoolean("cover") ? "covers" : "positions",
        key = media.getString("id") + "|" + R2DeviceGallery.stamp(media);
    synchronized (GalleryIntelligence.STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(secure)) {
        JSONObject state = db.choice("viewer-state"), values = state.optJSONObject(field);
        if (values == null) values = new JSONObject();
        if (values.length() >= 2000 && !values.has(key)) values.remove(values.keys().next());
        values.put(key, seconds);
        state.put(field, values);
        db.choice("viewer-state", state);
        if (input.optBoolean("cover")) {
          if (db.get(media.getString("id")) == null)
            db.put(new JSONObject().put("media", media).put("stamp", R2DeviceGallery.stamp(media)));
          db.invalidate();
        }
      }
    }
  }

  static File cache(Context context, String name) throws Exception {
    File file = new File(context.getCacheDir(), name);
    if (!file.isDirectory() && !file.mkdirs()) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
    return file;
  }

  static void prune(File root, long limit) {
    File[] files = root.listFiles(f -> f.isFile() && !f.getName().endsWith(".new"));
    if (files == null) return;
    Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
    long total = 0;
    for (File file : files) {
      total += file.length();
      if (total > limit) file.delete();
    }
  }

  static String frame(Context context, JSONObject media, double seconds) throws Exception {
    return frame(context, media, seconds, false);
  }

  static String frame(Context context, JSONObject media, double seconds, boolean cover)
      throws Exception {
    int edge = cover ? 960 : 320,
        option =
            cover
                ? MediaMetadataRetriever.OPTION_CLOSEST
                : MediaMetadataRetriever.OPTION_CLOSEST_SYNC;
    if (!"video".equals(media.getString("kind"))) throw new R2Exception("INVALID_SELECTION");
    File dir = cache(context, "gallery-filmstrip"),
        file =
            new File(
                dir,
                GallerySearchStore.token(
                        media.getString("id")
                            + R2DeviceGallery.stamp(media)
                            + ":"
                            + Math.round(seconds * 1000)
                            + ":"
                            + edge)
                    + ".jpg");
    if (!file.isFile()) {
      MediaMetadataRetriever retriever = new MediaMetadataRetriever();
      Bitmap image = null, small = null;
      try {
        retriever.setDataSource(context, R2DeviceGallery.uri(media.getString("id")));
        int width = Math.max(1, media.optInt("width", 320)),
            height = Math.max(1, media.optInt("height", 180));
        double scale = Math.min(1, (double) edge / Math.max(width, height));
        if (Build.VERSION.SDK_INT >= 27)
          image = retriever.getScaledFrameAtTime((long) (seconds * 1000000), option, edge, edge);
        else
          image =
              retriever.getFrameAtTime(
                  (long) (seconds * 1000000), MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
        if (image == null) throw new R2Exception("PREVIEW_UNAVAILABLE");
        scale = Math.min(1, (double) edge / Math.max(image.getWidth(), image.getHeight()));
        small =
            Bitmap.createScaledBitmap(
                image,
                Math.max(1, (int) (image.getWidth() * scale)),
                Math.max(1, (int) (image.getHeight() * scale)),
                true);
        try (OutputStream out = new FileOutputStream(file)) {
          if (!small.compress(Bitmap.CompressFormat.JPEG, cover ? 94 : 88, out))
            throw new IOException();
        }
      } catch (Exception failure) {
        file.delete();
        throw failure;
      } finally {
        if (small != null && small != image) small.recycle();
        if (image != null) image.recycle();
        retriever.release();
      }
    }
    file.setLastModified(System.currentTimeMillis());
    prune(dir, 16L * 1024 * 1024);
    return file.getAbsolutePath();
  }

  static JSONObject frames(Context context, String id) throws Exception {
    JSONObject media = new R2DeviceGallery(context).one(id);
    double duration = duration(context, media);
    JSONArray frames = new JSONArray();
    for (int i = 0; i < 8; i++) {
      double at = Math.max(0, duration * i / 8);
      frames.put(new JSONObject().put("seconds", at).put("path", frame(context, media, at)));
    }
    return new JSONObject().put("frames", frames);
  }

  static double cover(Context context, R2SecureStore secure, JSONObject media) throws Exception {
    if (!"video".equals(media.optString("kind"))) return -1;
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      JSONObject covers = db.choice("viewer-state").optJSONObject("covers");
      return covers == null
          ? -1
          : covers.optDouble(media.getString("id") + "|" + R2DeviceGallery.stamp(media), -1);
    } catch (Exception ignored) {
      return -1;
    }
  }

  static JSONObject cacheReport(Context context, R2SecureStore secure) throws Exception {
    long bytes = 0;
    int count = 0;
    for (String directory : List.of("device-gallery", "gallery-filmstrip", "gallery-motion")) {
      File[] files = cache(context, directory).listFiles();
      if (files != null)
        for (File file : files)
          if (file.isFile()) {
            bytes += file.length();
            count++;
          }
    }
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      return new JSONObject()
          .put("bytes", bytes)
          .put("files", count)
          .put("limitMiB", db.choice("cache-settings").optInt("limitMiB", 96));
    }
  }

  static void cacheSettings(Context context, R2SecureStore secure, JSONObject input)
      throws Exception {
    int size = input.optInt("limitMiB", 96);
    if (!Set.of(32, 64, 96, 192).contains(size)) throw new R2Exception("INVALID_SELECTION");
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      db.choice("cache-settings", new JSONObject().put("limitMiB", size));
    }
    for (String directory : List.of("device-gallery", "gallery-filmstrip", "gallery-motion"))
      prune(
          cache(context, directory),
          input.optBoolean("clear")
              ? 0
              : (directory.equals("device-gallery")
                  ? (long) size * 1024 * 1024
                  : 16L * 1024 * 1024));
  }

  static long cacheLimit(R2SecureStore secure) throws Exception {
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      return db.choice("cache-settings").optInt("limitMiB", 96) * 1024L * 1024;
    } catch (Exception ignored) {
      return 96L * 1024 * 1024;
    }
  }

  static Bitmap decodeEdit(Context context, String id) throws Exception {
    if (Build.VERSION.SDK_INT < 26) throw new R2Exception("ANDROID_8_REQUIRED");
    if (Build.VERSION.SDK_INT < 28) return GalleryIntelligenceWorker.decode(context, id);
    return ImageDecoder.decodeBitmap(
        ImageDecoder.createSource(context.getContentResolver(), R2DeviceGallery.uri(id)),
        (decoder, info, source) -> {
          decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
          decoder.setTargetColorSpace(ColorSpace.get(ColorSpace.Named.SRGB));
          int w = info.getSize().getWidth(), h = info.getSize().getHeight();
          double scale =
              Math.min(1, Math.min(3072d / Math.max(w, h), Math.sqrt(6000000d / ((double) w * h))));
          decoder.setTargetSize(Math.max(1, (int) (w * scale)), Math.max(1, (int) (h * scale)));
        });
  }

  static JSONObject edit(Context context, R2SecureStore secure, JSONObject input) throws Exception {
    if (Build.VERSION.SDK_INT < 29) throw new R2Exception("ANDROID_10_REQUIRED");
    String id = input.getString("id");
    JSONObject media = new R2DeviceGallery(context).one(id), recipe = input.getJSONObject("recipe");
    if (!"photo".equals(media.getString("kind"))) throw new R2Exception("EDIT_PHOTO_ONLY");
    double angle = number(recipe, "angle", -360, 360, 0),
        aspect = number(recipe, "aspect", 0, 3, 0),
        zoom = number(recipe, "zoom", 1, 3, 1),
        x = number(recipe, "x", 0, 1, .5),
        y = number(recipe, "y", 0, 1, .5),
        brightness = number(recipe, "brightness", .5, 1.5, 1),
        contrast = number(recipe, "contrast", .5, 1.5, 1);
    Bitmap source = null, rotated = null, output = null;
    try {
      source =
          decodeEdit(context, id); // A bounded editing copy; the original file remains untouched.
      GalleryEditGeometry geometry =
          new GalleryEditGeometry(source.getWidth(), source.getHeight(), angle, aspect, zoom, x, y);
      double scale =
          Math.min(
              1,
              Math.min(
                  3072d / Math.max(geometry.width, geometry.height),
                  Math.sqrt(6000000d / (geometry.width * geometry.height))));
      int outputWidth = Math.max(1, (int) (geometry.width * scale)),
          outputHeight = Math.max(1, (int) (geometry.height * scale));
      output = Bitmap.createBitmap(outputWidth, outputHeight, Bitmap.Config.ARGB_8888);
      Matrix transform = new Matrix();
      transform.setTranslate((float) -geometry.x, (float) -geometry.y);
      transform.postRotate((float) angle);
      if (recipe.optBoolean("flip")) transform.postScale(-1, 1);
      transform.postScale((float) scale, (float) scale);
      transform.postTranslate(outputWidth / 2f, outputHeight / 2f);
      Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
      float factor = (float) (brightness * contrast),
          offset = (float) (128 * (1 - contrast) * brightness);
      paint.setColorFilter(
          new ColorMatrixColorFilter(
              new float[] {
                factor, 0, 0, 0, offset, 0, factor, 0, 0, offset, 0, 0, factor, 0, offset, 0, 0, 0,
                1, 0
              }));
      new Canvas(output).drawBitmap(source, transform, paint);
      if (!R2DeviceGallery.stamp(media)
          .equals(R2DeviceGallery.stamp(new R2DeviceGallery(context).one(id))))
        throw new R2Exception("SOURCE_CHANGED");
      Uri saved = savePhoto(context, output, media.optLong("capturedAt"));
      String target =
          "image:"
              + (Build.VERSION.SDK_INT >= 29 ? MediaStore.getVolumeName(saved) : "external")
              + ":"
              + saved.getLastPathSegment();
      JSONObject edited = new R2DeviceGallery(context).one(target);
      synchronized (GalleryIntelligence.STATE_LOCK) {
        try (GallerySearchStore db = new GallerySearchStore(secure)) {
          JSONObject edits = db.choice("edits");
          edits.put(
              edited.getString("id") + "|" + R2DeviceGallery.stamp(edited),
              new JSONObject()
                  .put("originalKey", media.getString("id") + "|" + R2DeviceGallery.stamp(media))
                  .put("recipe", recipe));
          db.choice("edits", edits);
          for (JSONObject value : List.of(media, edited))
            if (db.get(value.getString("id")) == null)
              db.put(
                  new JSONObject().put("media", value).put("stamp", R2DeviceGallery.stamp(value)));
        }
      }
      return new JSONObject().put("media", edited).put("saved", true);
    } finally {
      if (output != null) output.recycle();
      if (rotated != null && rotated != source) rotated.recycle();
      if (source != null) source.recycle();
    }
  }

  static double number(JSONObject value, String key, double min, double max, double fallback)
      throws Exception {
    double result = value.optDouble(key, fallback);
    if (!Double.isFinite(result) || result < min || result > max)
      throw new R2Exception("INVALID_SELECTION");
    return result;
  }

  static Uri savePhoto(Context context, Bitmap image, long captured) throws Exception {
    if (Build.VERSION.SDK_INT < 29) throw new R2Exception("ANDROID_10_REQUIRED");
    ContentValues values = new ContentValues();
    values.put("_display_name", "Atlas edit " + UUID.randomUUID() + ".jpg");
    values.put("mime_type", "image/jpeg");
    values.put("relative_path", "Pictures/Atlas Edits/");
    values.put("is_pending", 1);
    if (captured > 0) values.put("datetaken", captured);
    Uri target =
        context
            .getContentResolver()
            .insert(
                MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
    if (target == null) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
    try {
      try (OutputStream out = context.getContentResolver().openOutputStream(target)) {
        if (out == null || !image.compress(Bitmap.CompressFormat.JPEG, 95, out))
          throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
      }
      values.clear();
      values.put("is_pending", 0);
      context.getContentResolver().update(target, values, null, null);
      return target;
    } catch (Exception failure) {
      context.getContentResolver().delete(target, null, null);
      throw failure;
    }
  }

  static File sanitized(Context context, String id) throws Exception {
    JSONObject media = new R2DeviceGallery(context).one(id);
    File shared = cache(context, "gallery-shared");
    File[] stale = shared.listFiles();
    if (stale != null)
      for (File file : stale)
        if (file.lastModified() < System.currentTimeMillis() - 86400000L) file.delete();
    File dir = shared,
        file =
            new File(
                dir,
                UUID.randomUUID() + (media.getString("kind").equals("video") ? ".mp4" : ".jpg"));
    if (dir.getUsableSpace() < media.optLong("size") + 64L * 1024 * 1024)
      throw new R2Exception("INSUFFICIENT_DEVICE_SPACE");
    try {
      if ("photo".equals(media.getString("kind"))) {
        Bitmap image = decodeEdit(context, id);
        try (OutputStream out = new FileOutputStream(file)) {
          if (!image.compress(Bitmap.CompressFormat.JPEG, 95, out)) throw new IOException();
        } finally {
          image.recycle();
        }
      } else remux(context, R2DeviceGallery.uri(id), file);
      return file;
    } catch (Exception failure) {
      file.delete();
      throw failure;
    }
  }

  static void remux(Context context, Uri source, File file) throws Exception {
    MediaExtractor extractor = new MediaExtractor();
    MediaMuxer muxer = null;
    boolean started = false;
    try {
      extractor.setDataSource(context, source, null);
      muxer = new MediaMuxer(file.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
      Map<Integer, Integer> tracks = new HashMap<>();
      int largest = 1024 * 1024;
      for (int i = 0; i < extractor.getTrackCount(); i++) {
        MediaFormat format = extractor.getTrackFormat(i);
        String mime = format.getString(MediaFormat.KEY_MIME);
        if (mime != null && (mime.startsWith("audio/") || mime.startsWith("video/"))) {
          tracks.put(i, muxer.addTrack(format));
          extractor.selectTrack(i);
          if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE))
            largest = Math.max(largest, format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE));
        }
      }
      if (tracks.isEmpty() || largest > 16 * 1024 * 1024)
        throw new R2Exception("PRIVACY_EXPORT_UNSUPPORTED");
      MediaMetadataRetriever retriever = new MediaMetadataRetriever();
      try {
        retriever.setDataSource(context, source);
        String rotation =
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
        if (rotation != null) muxer.setOrientationHint(Integer.parseInt(rotation));
      } finally {
        retriever.release();
      }
      muxer.start();
      started = true;
      ByteBuffer buffer = ByteBuffer.allocate(largest);
      MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
      while (extractor.getSampleTrackIndex() >= 0) {
        int track = extractor.getSampleTrackIndex();
        buffer.clear();
        int length = extractor.readSampleData(buffer, 0);
        if (length < 0) break;
        if (length > buffer.capacity()) throw new R2Exception("PRIVACY_EXPORT_UNSUPPORTED");
        info.set(0, length, extractor.getSampleTime(), extractor.getSampleFlags());
        muxer.writeSampleData(tracks.get(track), buffer, info);
        extractor.advance();
      }
    } finally {
      extractor.release();
      if (muxer != null) {
        try {
          if (started) muxer.stop();
        } finally {
          muxer.release();
        }
      }
    }
  }
}
