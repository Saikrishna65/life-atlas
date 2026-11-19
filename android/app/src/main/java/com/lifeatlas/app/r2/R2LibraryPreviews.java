package com.lifeatlas.app.r2;

import android.content.Context;
import android.net.Uri;
import java.io.*;
import java.util.*;
import org.json.*;

final class R2LibraryPreviews {
  static File cache(Context context) {
    File file = new File(context.getCacheDir(), "library-thumbnails");
    file.mkdirs();
    return file;
  }

  static void clear(Context context) {
    File[] files = cache(context).listFiles();
    if (files != null) for (File f : files) f.delete();
  }

  static void thumbnail(Context context, R2Repository repo, JSONObject job) throws Exception {
    if (!job.getString("slot").equals("private") || job.optBoolean("hasThumbnail")) return;
    File plain = File.createTempFile("preview-original", ".tmp", context.getCacheDir());
    byte[] keys = repo.keyset();
    try {
      // Images and video frames are bounded derivatives. The original is never re-encoded.
      byte[] thumb;
      Uri source = Uri.parse(job.getString("source"));
      if (job.getString("mimeType").startsWith("video/")) {
        android.media.MediaMetadataRetriever reader = new android.media.MediaMetadataRetriever();
        android.graphics.Bitmap bitmap = null;
        try {
          reader.setDataSource(context, source);
          bitmap =
              reader.getScaledFrameAtTime(
                  0, android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 480, 320);
          if (bitmap == null) return;
          ByteArrayOutputStream out = new ByteArrayOutputStream();
          bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 75, out);
          thumb = out.toByteArray();
        } finally {
          if (bitmap != null) bitmap.recycle();
          reader.release();
        }
      } else {
        android.graphics.BitmapFactory.Options bounds =
            new android.graphics.BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = context.getContentResolver().openInputStream(source)) {
          android.graphics.BitmapFactory.decodeStream(in, null, bounds);
        }
        if (bounds.outWidth <= 0) return;
        android.graphics.BitmapFactory.Options options =
            new android.graphics.BitmapFactory.Options();
        int sample = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / sample > 640) sample *= 2;
        options.inSampleSize = sample;
        android.graphics.Bitmap bitmap;
        try (InputStream in = context.getContentResolver().openInputStream(source)) {
          bitmap = android.graphics.BitmapFactory.decodeStream(in, null, options);
        }
        if (bitmap == null) return;
        try {
          ByteArrayOutputStream out = new ByteArrayOutputStream();
          bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 75, out);
          thumb = out.toByteArray();
        } finally {
          bitmap.recycle();
        }
      }
      if (thumb.length > 400000) return;
      String key = "encrypted/previews/" + job.getString("id") + "-thumbnail.atlas";
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      R2Envelope.encrypt(
          new ByteArrayInputStream(thumb),
          output,
          keys,
          key,
          new JSONObject()
              .put("name", "thumbnail.jpg")
              .put("mimeType", "image/jpeg")
              .put("size", thumb.length)
              .put("sha256", R2Policy.digest(thumb)));
      byte[] cipher = output.toByteArray();
      String hash = R2Policy.digest(cipher);
      R2Client client = new R2Client(repo.store.credentials("private"));
      try (R2Client.Response response =
          client.request(
              "PUT",
              key,
              Collections.emptyMap(),
              Map.of(
                  "content-type",
                  "application/octet-stream",
                  "x-amz-meta-sha256",
                  hash,
                  "cache-control",
                  "private, no-store"),
              R2Client.bytes(cipher),
              null)) {}
      try (R2Client.Response response =
          client.request("GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
        if (!hash.equals(R2Policy.digest(response.read(1024 * 1024))))
          throw new R2Exception("INTEGRITY_FAILED");
      }
      repo.update(
          job.getString("id"),
          j -> j.put("thumbnailKey", key).put("thumbnailSha256", hash).put("hasThumbnail", true));
    } finally {
      Arrays.fill(keys, (byte) 0);
      plain.delete();
    }
  }

  static JSONObject open(Context c, R2Repository repo, JSONObject r, String variant)
      throws Exception {
    R2Library.checkScope(repo, r);
    if (!r.getString("state").equals("active")
        && !(variant.equals("thumbnail") && r.getString("state").equals("trashed")))
      throw new R2Exception("LIBRARY_ITEM_IN_TRASH");
    String key =
        variant.equals("thumbnail")
            ? r.optString("thumbnailKey")
            : variant.equals("clip") ? r.optString("clipKey") : r.getString("key");
    if (key.isEmpty()) throw new R2Exception("PREVIEW_UNAVAILABLE");
    if (r.getString("slot").equals("public") && !key.startsWith("encrypted/")) {
      R2Credentials creds = repo.store.credentials("public");
      if (creds.base.isEmpty()) throw new R2Exception("PUBLIC_BASE_URL_REQUIRED");
      return new JSONObject().put("url", creds.base + "/" + R2Policy.path(key));
    }
    JSONObject opened = R2GalleryPreview.open(c, repo, key);
    if (variant.equals("thumbnail")) {
      File original = new File(opened.getString("path")),
          target = new File(cache(c), r.getString("id") + ".jpg");
      if (target.exists()) target.delete();
      if (!original.renameTo(target)) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
      target.setLastModified(System.currentTimeMillis());
      File[] cached = cache(c).listFiles();
      if (cached != null && cached.length > 200) {
        Arrays.sort(cached, Comparator.comparingLong(File::lastModified));
        for (int i = 0; i < cached.length - 150; i++)
          if (!cached[i].equals(target)) cached[i].delete();
      }
      R2GalleryPreview.release(c, opened.getString("token"));
      return new JSONObject().put("path", target.getAbsolutePath());
    }
    return opened;
  }
}
