package com.lifeatlas.app.r2;

import android.content.*;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.util.Size;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** MediaStore reads only. Originals are never modified, deleted or copied into the WebView. */
final class R2DeviceGallery {
  private final Context context;
  private final R2Repository repository;
  static final int PAGE = 80;

  R2DeviceGallery(Context context) {
    this(context, new R2Repository(context));
  }

  R2DeviceGallery(Context context, R2Repository repository) {
    this.context = context;
    this.repository = repository;
  }

  static long mediaNumber(String id) {
    if (id == null || !id.matches("(?:image|video):[a-zA-Z0-9_-]{1,80}:[1-9][0-9]{0,17}"))
      throw new IllegalArgumentException("INVALID_SELECTION");
    return Long.parseLong(id.substring(id.lastIndexOf(':') + 1));
  }

  static Uri uri(String id) {
    mediaNumber(id);
    String volume = id.split(":")[1];
    Uri collection =
        Build.VERSION.SDK_INT >= 29
            ? id.startsWith("image:")
                ? MediaStore.Images.Media.getContentUri(volume)
                : MediaStore.Video.Media.getContentUri(volume)
            : id.startsWith("image:")
                ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                : MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
    return ContentUris.withAppendedId(collection, mediaNumber(id));
  }

  static Uri originalUri(String id) {
    Uri value = uri(id);
    return Build.VERSION.SDK_INT >= 29 ? MediaStore.setRequireOriginal(value) : value;
  }

  static String stamp(JSONObject item) {
    return item.optLong("size")
        + ":"
        + item.optLong("modifiedAt")
        + (item.optLong("generation") > 0 ? ":" + item.optLong("generation") : "");
  }

  static String selectionId(JSONObject item) {
    return UUID.nameUUIDFromBytes(
            ("original-v1:" + item.optString("id") + ":" + stamp(item))
                .getBytes(StandardCharsets.UTF_8))
        .toString();
  }

  private static long number(Cursor cursor, String key) {
    int index = cursor.getColumnIndex(key);
    return index < 0 || cursor.isNull(index) ? 0 : cursor.getLong(index);
  }

  private static String string(Cursor cursor, String key) {
    int index = cursor.getColumnIndex(key);
    return index < 0 || cursor.isNull(index) ? "" : cursor.getString(index);
  }

  private JSONObject item(Cursor c) throws Exception {
    boolean video = number(c, "media_type") == 3;
    String volume = Build.VERSION.SDK_INT >= 29 ? string(c, "volume_name") : "external";
    String id = (video ? "video:" : "image:") + volume + ":" + number(c, "_id");
    return new JSONObject()
        .put("id", id)
        .put("name", string(c, "_display_name"))
        .put("kind", video ? "video" : "photo")
        .put("mimeType", string(c, "mime_type"))
        .put("size", number(c, "_size"))
        .put("addedAt", number(c, "date_added") * 1000)
        .put("capturedAt", number(c, "datetaken"))
        .put("modifiedAt", number(c, "date_modified") * 1000)
        .put("generation", number(c, "generation_modified"))
        .put("width", number(c, "width"))
        .put("height", number(c, "height"))
        .put("duration", number(c, "duration"))
        .put("album", string(c, "bucket_display_name"))
        .put("albumId", volume + ":" + number(c, "bucket_id"))
        .put("uri", uri(id).toString());
  }

  private String[] projection() {
    List<String> values =
        new ArrayList<>(
            List.of(
                "_id",
                "_display_name",
                "mime_type",
                "_size",
                "date_added",
                "datetaken",
                "date_modified",
                "width",
                "height",
                "duration",
                "bucket_display_name",
                "bucket_id",
                "media_type"));
    if (Build.VERSION.SDK_INT >= 29) values.add("volume_name");
    if (Build.VERSION.SDK_INT >= 30) values.add("generation_modified");
    return values.toArray(new String[0]);
  }

  JSONObject list(String cursor, String query, String kind, String album, String order)
      throws Exception {
    return list(cursor, query, kind, album, order, "", List.of(), false);
  }

  JSONObject listBetween(
      String cursor, String query, String kind, String album, String order, long from, long to)
      throws Exception {
    if (from < 0 || to < 0 || (from > 0 && to > 0 && from > to))
      throw new R2Exception("INVALID_SELECTION");
    List<String> args = new ArrayList<>();
    String date = "CASE WHEN datetaken>0 THEN datetaken ELSE date_added*1000 END", extra = "";
    if (from > 0) {
      extra = "(" + date + ")>=?";
      args.add(Long.toString(from));
    }
    if (to > 0) {
      extra += (extra.isEmpty() ? "" : " AND ") + "(" + date + ")<=?";
      args.add(Long.toString(to));
    }
    return list(cursor, query, kind, album, order, extra, args, false);
  }

  JSONObject changedPhotos(String cursor, long since) throws Exception {
    return list(
        cursor,
        "",
        "photo",
        "",
        "newest",
        since > 0 ? "(date_modified>=? OR date_added>=?)" : "",
        since > 0 ? List.of(Long.toString(since / 1000), Long.toString(since / 1000)) : List.of(),
        false);
  }

  JSONObject smartPage(String cursor, GallerySmartAlbums.Filter filter) throws Exception {
    return list(
        cursor,
        "",
        "all",
        "",
        "newest",
        filter.sql,
        filter.args,
        filter.sql.startsWith("datetaken"));
  }

  private JSONObject list(
      String cursor,
      String query,
      String kind,
      String album,
      String order,
      String extra,
      List<String> extraArgs,
      boolean captureOrder)
      throws Exception {
    String selection = "media_type IN (1,3)";
    if (!extra.isEmpty()) selection += " AND (" + extra + ")";
    List<String> args = new ArrayList<>(extraArgs);
    if (Build.VERSION.SDK_INT >= 29) selection += " AND is_pending=0";
    if (Build.VERSION.SDK_INT >= 30) selection += " AND is_trashed=0";
    if (kind.equals("photo") || kind.equals("video"))
      selection += " AND media_type=" + (kind.equals("photo") ? "1" : "3");
    if (query.length() > 200 || album.length() > 200)
      throw new IllegalArgumentException("INVALID_SELECTION");
    if (!query.isEmpty()) {
      selection += " AND _display_name LIKE ? ESCAPE '\\'";
      args.add("%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
    }
    if (!album.isEmpty()) {
      selection += " AND bucket_display_name=?";
      args.add(album);
    }
    String dateColumn = captureOrder ? "datetaken" : "date_added";
    boolean ascending = order.equals("oldest");
    String comparison = ascending ? ">" : "<";
    if (!cursor.isEmpty()) {
      if (!cursor.matches("[0-9]{1,15}:[0-9]{1,18}:[a-zA-Z0-9_-]{1,80}"))
        throw new IllegalArgumentException("INVALID_SELECTION");
      String[] parts = cursor.split(":");
      selection +=
          " AND ("
              + dateColumn
              + " "
              + comparison
              + " ? OR ("
              + dateColumn
              + "=? AND _id "
              + comparison
              + " ?)";
      args.add(parts[0]);
      args.add(parts[0]);
      args.add(parts[1]);
      if (Build.VERSION.SDK_INT >= 29) {
        selection += " OR (" + dateColumn + "=? AND _id=? AND volume_name " + comparison + " ?)";
        args.add(parts[0]);
        args.add(parts[1]);
        args.add(parts[2]);
      }
      selection += ")";
    }
    Bundle options = new Bundle();
    options.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection);
    options.putStringArray(
        ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, args.toArray(new String[0]));
    options.putString(
        ContentResolver.QUERY_ARG_SQL_SORT_ORDER,
        dateColumn + " " + (ascending ? "ASC" : "DESC") + ", _id " + (ascending ? "ASC" : "DESC"));
    if (Build.VERSION.SDK_INT >= 29)
      options.putString(
          ContentResolver.QUERY_ARG_SQL_SORT_ORDER,
          options.getString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER)
              + ", volume_name "
              + (ascending ? "ASC" : "DESC"));
    options.putInt(ContentResolver.QUERY_ARG_LIMIT, PAGE + 1);
    JSONArray items = new JSONArray();
    String next = "";
    boolean more = false;
    JSONObject index = null;
    try {
      index = repository.store.snapshot().optJSONObject("galleryChecks");
    } catch (Exception ignored) {
      /* Phone media never depends on cloud credentials or a recoverable Keystore. */
    }
    Map<String, String> scopes = new HashMap<>();
    if (index != null)
      for (String slot : List.of("public", "private"))
        try {
          scopes.put(slot, R2Duplicates.scope(repository.store.credentials(slot)));
        } catch (Exception ignored) {
        }
    try (Cursor c =
        context
            .getContentResolver()
            .query(MediaStore.Files.getContentUri("external"), projection(), options, null)) {
      while (c != null && c.moveToNext()) {
        if (items.length() == PAGE) {
          more = true;
          break;
        }
        JSONObject entry = item(c),
            saved = index == null ? null : index.optJSONObject(entry.getString("id"));
        if (saved != null && stamp(entry).equals(saved.optString("stamp"))) {
          JSONObject copies = new JSONObject();
          for (String slot : List.of("public", "private")) {
            JSONObject copy = saved.optJSONObject(slot);
            if (copy != null)
              try {
                if (copy.optString("scope").equals(scopes.get(slot))) copies.put(slot, copy);
              } catch (Exception ignored) {
              }
          }
          entry.put("copies", copies);
        }
        items.put(entry);
        next =
            number(c, dateColumn)
                + ":"
                + number(c, "_id")
                + ":"
                + (Build.VERSION.SDK_INT >= 29 ? string(c, "volume_name") : "external");
      }
    }
    return new JSONObject()
        .put("items", items)
        .put("cursor", more ? next : "")
        .put("complete", !more);
  }

  Map<String, String> accessibleVersions(Set<String> wanted) throws Exception {
    Map<String, String> values = new HashMap<>();
    if (wanted.isEmpty()) return values;
    List<String> columns = new ArrayList<>(List.of("_id", "_size", "date_modified", "media_type"));
    if (Build.VERSION.SDK_INT >= 29) columns.add("volume_name");
    if (Build.VERSION.SDK_INT >= 30) columns.add("generation_modified");
    String where =
        "media_type IN (1,3)"
            + (Build.VERSION.SDK_INT >= 29 ? " AND is_pending=0" : "")
            + (Build.VERSION.SDK_INT >= 30 ? " AND is_trashed=0" : "");
    try (Cursor c =
        context
            .getContentResolver()
            .query(
                MediaStore.Files.getContentUri("external"),
                columns.toArray(new String[0]),
                where,
                null,
                null)) {
      while (c != null && c.moveToNext()) {
        String id =
            (number(c, "media_type") == 3 ? "video:" : "image:")
                + (Build.VERSION.SDK_INT >= 29 ? string(c, "volume_name") : "external")
                + ":"
                + number(c, "_id");
        if (wanted.contains(id))
          values.put(
              id,
              number(c, "_size")
                  + ":"
                  + (number(c, "date_modified") * 1000)
                  + (number(c, "generation_modified") > 0
                      ? ":" + number(c, "generation_modified")
                      : ""));
      }
    }
    return values;
  }

  JSONArray albums() throws Exception {
    Map<String, Integer> values = new TreeMap<>();
    String where = "media_type IN (1,3)";
    if (Build.VERSION.SDK_INT >= 29) where += " AND is_pending=0";
    if (Build.VERSION.SDK_INT >= 30) where += " AND is_trashed=0";
    try (Cursor c =
        context
            .getContentResolver()
            .query(
                MediaStore.Files.getContentUri("external"),
                new String[] {"bucket_display_name"},
                where,
                null,
                null)) {
      while (c != null && c.moveToNext()) {
        String name = string(c, "bucket_display_name");
        if (!name.isEmpty()) values.put(name, values.getOrDefault(name, 0) + 1);
      }
    }
    JSONArray out = new JSONArray();
    for (Map.Entry<String, Integer> entry : values.entrySet())
      out.put(new JSONObject().put("name", entry.getKey()).put("count", entry.getValue()));
    return out;
  }

  JSONObject one(String id) throws Exception {
    mediaNumber(id);
    try (Cursor c =
        context
            .getContentResolver()
            .query(
                MediaStore.Files.getContentUri("external"),
                projection(),
                "_id=? AND media_type=?"
                    + (Build.VERSION.SDK_INT >= 29 ? " AND is_pending=0" : "")
                    + (Build.VERSION.SDK_INT >= 30 ? " AND is_trashed=0" : "")
                    + (Build.VERSION.SDK_INT >= 29 ? " AND volume_name=?" : ""),
                Build.VERSION.SDK_INT >= 29
                    ? new String[] {
                      String.valueOf(mediaNumber(id)),
                      id.startsWith("image:") ? "1" : "3",
                      id.split(":")[1]
                    }
                    : new String[] {
                      String.valueOf(mediaNumber(id)), id.startsWith("image:") ? "1" : "3"
                    },
                null)) {
      if (c == null || !c.moveToFirst()) throw new R2Exception("SOURCE_UNAVAILABLE");
      return item(c);
    }
  }

  String thumbnail(String id) throws Exception {
    JSONObject media = one(id);
    File root = new File(context.getCacheDir(), "device-gallery");
    root.mkdirs();
    File file = new File(root, selectionId(media) + "-sharp-v2.jpg");
    if (!file.exists()) {
      Bitmap bitmap =
          id.startsWith("image:")
              ? GalleryIntelligenceWorker.decode(context, id)
              : Build.VERSION.SDK_INT >= 29
                  ? context.getContentResolver().loadThumbnail(uri(id), new Size(960, 960), null)
                  : id.startsWith("image:")
                      ? MediaStore.Images.Thumbnails.getThumbnail(
                          context.getContentResolver(),
                          mediaNumber(id),
                          MediaStore.Images.Thumbnails.MINI_KIND,
                          null)
                      : MediaStore.Video.Thumbnails.getThumbnail(
                          context.getContentResolver(),
                          mediaNumber(id),
                          MediaStore.Video.Thumbnails.MINI_KIND,
                          null);
      if (bitmap == null) throw new R2Exception("PREVIEW_UNAVAILABLE");
      double scale = Math.min(1, 960d / Math.max(bitmap.getWidth(), bitmap.getHeight()));
      if (scale < 1) {
        Bitmap resized =
            Bitmap.createScaledBitmap(
                bitmap,
                Math.max(1, (int) (bitmap.getWidth() * scale)),
                Math.max(1, (int) (bitmap.getHeight() * scale)),
                true);
        if (resized != bitmap) bitmap.recycle();
        bitmap = resized;
      }
      android.util.AtomicFile atomic = new android.util.AtomicFile(file);
      FileOutputStream out = null;
      try {
        out = atomic.startWrite();
        if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 94, out))
          throw new R2Exception("PREVIEW_UNAVAILABLE");
        atomic.finishWrite(out);
      } catch (Exception e) {
        if (out != null) atomic.failWrite(out);
        throw e;
      } finally {
        bitmap.recycle();
      }
      File[] files = root.listFiles();
      if (files != null) {
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        long bytes = 0;
        for (File cached : files) bytes += cached.length();
        int remaining = files.length;
        for (File cached : files) {
          if (bytes <= 96L * 1024 * 1024 && remaining <= 800) break;
          if (cached.equals(file)) continue;
          long length = cached.length();
          if (cached.delete()) {
            bytes -= length;
            remaining--;
          }
        }
      }
    }
    file.setLastModified(System.currentTimeMillis());
    return file.getAbsolutePath();
  }

  JSONArray register(JSONArray ids, JSONObject versions) throws Exception {
    if (ids == null || ids.length() == 0 || ids.length() > 100)
      throw new R2Exception("INVALID_SELECTION");
    JSONArray result = new JSONArray(), records = new JSONArray();
    for (int i = 0; i < ids.length(); i++) {
      JSONObject media = one(ids.getString(i));
      if (versions != null && !stamp(media).equals(versions.optString(media.getString("id"))))
        throw new R2Exception("SOURCE_CHANGED");
      // MediaStore runtime access is durable across process death, subject to user revocation.
      try (InputStream input =
          context.getContentResolver().openInputStream(originalUri(media.getString("id")))) {
        if (input == null) throw new R2Exception("SOURCE_UNAVAILABLE");
      }
      JSONObject record =
          new JSONObject()
              .put("id", selectionId(media))
              .put("name", media.getString("name"))
              .put("mimeType", media.getString("mimeType"))
              .put("size", media.getLong("size"))
              .put("persistent", true)
              .put("galleryId", media.getString("id"))
              .put("sourceStamp", stamp(media));
      result.put(new JSONObject(record.toString()));
      records.put(record.put("uri", originalUri(media.getString("id")).toString()));
    }
    repository.store.edit(
        state -> {
          JSONObject picks = state.optJSONObject("selections");
          if (picks == null) {
            picks = new JSONObject();
            state.put("selections", picks);
          }
          for (int i = 0; i < records.length(); i++) {
            JSONObject record = records.getJSONObject(i);
            picks.put(record.getString("id"), record);
          }
        });
    return result;
  }

  JSONArray check(JSONArray ids) throws Exception {
    if (ids == null || ids.length() > 30) throw new R2Exception("INVALID_SELECTION");
    JSONArray results = new JSONArray(), jobs = repository.jobs();
    for (int i = 0; i < ids.length(); i++) {
      JSONObject media = one(ids.getString(i));
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      try (InputStream in =
          context.getContentResolver().openInputStream(originalUri(media.getString("id")))) {
        if (in == null) throw new R2Exception("SOURCE_UNAVAILABLE");
        byte[] buffer = new byte[65536];
        int n;
        while ((n = in.read(buffer)) != -1) digest.update(buffer, 0, n);
      }
      if (!stamp(media).equals(stamp(one(media.getString("id")))))
        throw new R2Exception("SOURCE_CHANGED");
      String hash = R2Policy.hex(digest.digest());
      JSONObject saved = new JSONObject().put("stamp", stamp(media));
      for (String slot : List.of("public", "private")) {
        JSONObject copy =
            new JSONObject().put("state", "unchecked").put("checkedAt", System.currentTimeMillis());
        try {
          R2Credentials credentials = repository.store.credentials(slot);
          copy.put("scope", R2Duplicates.scope(credentials));
          JSONObject probe =
              new JSONObject()
                  .put("id", "gallery-check")
                  .put("slot", slot)
                  .put("mimeType", media.getString("mimeType"))
                  .put("contentSha256", hash)
                  .put("sha256", hash);
          if (slot.equals("private")) {
            byte[] keys = repository.keyset();
            try {
              probe.put("keyId", R2Crypto.keyId(keys));
            } finally {
              Arrays.fill(keys, (byte) 0);
            }
          }
          copy.put("state", "not-found");
          JSONArray candidates = new JSONArray(jobs.toString());
          JSONArray indexed = R2Library.duplicateCandidates(repository, probe, credentials);
          for (int j = 0; j < indexed.length(); j++) candidates.put(indexed.getJSONObject(j));
          for (int n = 0; n < candidates.length(); n++) {
            JSONObject job = candidates.getJSONObject(n);
            if (!R2Duplicates.matches(probe, job, credentials)) continue;
            try {
              JSONObject head = new R2Client(credentials).head(job.getString("key"));
              if (head.optLong("size", -1) == job.optLong("totalBytes")
                  && head.optString("sha256").equals(job.optString("sha256"))) {
                copy.put("state", "verified")
                    .put("key", job.getString("key"))
                    .put("thumbnailUrl", job.optString("thumbnailUrl"));
                break;
              } else copy.put("state", "missing");
            } catch (R2Exception e) {
              if (e.code.equals("OBJECT_NOT_FOUND")) copy.put("state", "missing");
              else throw e;
            }
          }
        } catch (Exception e) {
          copy.put("state", "unavailable");
        }
        saved.put(slot, copy);
      }
      final String id = media.getString("id");
      repository.store.edit(
          state -> {
            JSONObject checks = state.optJSONObject("galleryChecks");
            if (checks == null) {
              checks = new JSONObject();
              state.put("galleryChecks", checks);
            }
            checks.put(id, saved);
          });
      results.put(
          new JSONObject()
              .put("id", id)
              .put(
                  "copies",
                  new JSONObject()
                      .put("public", saved.getJSONObject("public"))
                      .put("private", saved.getJSONObject("private"))));
    }
    return results;
  }
}
