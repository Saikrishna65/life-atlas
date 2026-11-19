package com.lifeatlas.app.r2;

import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;
import org.json.*;

final class R2Takeout {
  static String path(String name) throws Exception {
    if (name == null
        || name.length() > 2048
        || name.startsWith("/")
        || name.startsWith("\\")
        || name.indexOf('\0') >= 0) throw new R2Exception("UNSAFE_IMPORT_PATH");
    String value = name.replace('\\', '/');
    for (String part : value.split("/"))
      if (part.equals("..") || part.equals(".")) throw new R2Exception("UNSAFE_IMPORT_PATH");
    return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFC);
  }

  static String parent(String path) {
    int at = path.lastIndexOf('/');
    return at < 0 ? "" : path.substring(0, at);
  }

  static String name(String path) {
    return path.substring(path.lastIndexOf('/') + 1);
  }

  static String mime(String name) {
    String ext = name.substring(Math.max(0, name.lastIndexOf('.') + 1)).toLowerCase(Locale.US);
    return Map.ofEntries(
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("png", "image/png"),
            Map.entry("webp", "image/webp"),
            Map.entry("heic", "image/heic"),
            Map.entry("heif", "image/heif"),
            Map.entry("avif", "image/avif"),
            Map.entry("gif", "image/gif"),
            Map.entry("dng", "image/x-adobe-dng"),
            Map.entry("cr2", "image/x-canon-cr2"),
            Map.entry("nef", "image/x-nikon-nef"),
            Map.entry("arw", "image/x-sony-arw"),
            Map.entry("mp4", "video/mp4"),
            Map.entry("mov", "video/quicktime"),
            Map.entry("webm", "video/webm"),
            Map.entry("mkv", "video/x-matroska"),
            Map.entry("m4v", "video/mp4"))
        .getOrDefault(ext, "");
  }

  static JSONObject metadata(JSONObject json) throws Exception {
    JSONObject out = new JSONObject();
    String title = json.optString("title");
    if (title.length() > 1024) title = title.substring(0, 1024);
    out.put("title", title);
    String description = json.optString("description");
    if (description.length() > 20000) description = description.substring(0, 20000);
    out.put("description", description);
    JSONObject time = json.optJSONObject("photoTakenTime");
    if (time == null) time = json.optJSONObject("creationTime");
    if (time != null)
      try {
        long seconds = Long.parseLong(time.optString("timestamp"));
        if (seconds > 0 && seconds < 253402300800L) out.put("capturedAt", seconds * 1000L);
      } catch (NumberFormatException ignored) {
      }
    for (String source : List.of("geoData", "geoDataExif")) {
      JSONObject geo = json.optJSONObject(source);
      if (geo == null) continue;
      double lat = geo.optDouble("latitude", Double.NaN),
          lon = geo.optDouble("longitude", Double.NaN);
      if (Double.isFinite(lat)
          && Double.isFinite(lon)
          && Math.abs(lat) <= 90
          && Math.abs(lon) <= 180
          && (lat != 0 || lon != 0)) {
        out.put("gps", new JSONObject().put("latitude", lat).put("longitude", lon));
        break;
      }
    }
    return out;
  }

  static String uriId(Uri uri) {
    return "uri:" + R2Policy.digest(uri.toString().getBytes(StandardCharsets.UTF_8));
  }

  static JSONObject imported(R2LibraryStore store, Uri uri) throws Exception {
    return store.importGet(uriId(uri));
  }

  interface Control {
    void check() throws Exception;

    void progress(String file, long bytes, int files) throws Exception;
  }

  static void applyMetadata(
      Context context, R2LibraryStore store, String folder, String candidate, JSONObject meta)
      throws Exception {
    String key =
        "path:" + R2Policy.digest((folder + "/" + candidate).getBytes(StandardCharsets.UTF_8));
    JSONObject record = store.importGet(key);
    if (record == null) {
      store.importPut(
          "sidecar:" + R2Policy.digest((folder + "/" + candidate).getBytes(StandardCharsets.UTF_8)),
          "",
          new JSONObject().put("path", folder + "/" + candidate).put("metadata", meta));
      return;
    }
    record.put("metadata", meta);
    Uri uri = Uri.parse(record.getString("uri"));
    store.importPut(key, uri.toString(), record);
    store.importPut(uriId(uri), uri.toString(), record);
    String hashKey = record.optString("hashKey");
    if (!hashKey.isEmpty()) store.importPut(hashKey, uri.toString(), record);
    if (meta.has("capturedAt"))
      try {
        ContentValues values = new ContentValues();
        values.put("datetaken", meta.getLong("capturedAt"));
        context.getContentResolver().update(uri, values, null, null);
      } catch (Exception ignored) {
      }
  }

  static int run(Context context, R2Repository repo, String id, Control control) throws Exception {
    if (Build.VERSION.SDK_INT < 29) throw new R2Exception("ANDROID_10_REQUIRED");
    JSONObject job = repo.store.snapshot().getJSONObject("takeoutJobs").getJSONObject(id);
    String source = job.getString("uri");
    Set<String> completed = new HashSet<>();
    JSONArray old = job.optJSONArray("completed");
    if (old != null) for (int i = 0; i < old.length(); i++) completed.add(old.getString(i));
    int files = completed.size();
    // Clean up only a pending MediaStore row created by this import before a crash.
    String pending = job.optString("pendingUri");
    if (!pending.isEmpty()) {
      context.getContentResolver().delete(Uri.parse(pending), "is_pending=1", null);
      repo.store.edit(
          state -> state.getJSONObject("takeoutJobs").getJSONObject(id).remove("pendingUri"));
    }
    try (R2LibraryStore store = new R2LibraryStore(repo);
        InputStream raw = context.getContentResolver().openInputStream(Uri.parse(source));
        ZipInputStream zip =
            new ZipInputStream(new BufferedInputStream(raw), StandardCharsets.UTF_8)) {
      for (String entry : completed)
        store.importPut("entry:" + id + ":" + entry, "", new JSONObject().put("complete", true));
      files = store.importedEntries(id);
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        control.check();
        String path = path(entry.getName());
        if (entry.isDirectory()) {
          zip.closeEntry();
          continue;
        }
        String folder = parent(path), file = name(path), mime = mime(file);
        String entryId =
            R2Policy.digest(
                (path + "|" + entry.getCrc() + "|" + entry.getSize())
                    .getBytes(StandardCharsets.UTF_8));
        if (file.toLowerCase(Locale.US).endsWith(".json")) {
          try {
            JSONObject json =
                new JSONObject(new String(R2Io.read(zip, 2 * 1024 * 1024), StandardCharsets.UTF_8));
            JSONObject meta = metadata(json);
            String base =
                file.endsWith(".supplemental-metadata.json")
                    ? file.substring(0, file.length() - 27)
                    : file.substring(0, file.length() - 5);
            String candidate = !mime(base).isEmpty() ? base : meta.optString("title");
            if (!candidate.isEmpty()
                && candidate.equals(name(candidate))
                && !mime(candidate).isEmpty())
              applyMetadata(context, store, folder, candidate, meta);
            else if (!json.optString("title").isEmpty())
              store.importPut(
                  "album:" + R2Policy.digest(folder.getBytes(StandardCharsets.UTF_8)),
                  "",
                  new JSONObject().put("folder", folder).put("title", json.optString("title")));
          } catch (org.json.JSONException ignored) {
          }
          zip.closeEntry();
          continue;
        }
        if (mime.isEmpty() || store.importGet("entry:" + id + ":" + entryId) != null) {
          zip.closeEntry();
          continue;
        }
        if (entry.getSize()
            > Math.max(0, context.getFilesDir().getUsableSpace() - 128L * 1024 * 1024))
          throw new R2Exception("INSUFFICIENT_DEVICE_SPACE");
        boolean video = mime.startsWith("video/");
        Uri collection =
            video
                ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                : MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, file.replaceAll("[\\p{Cntrl}]", "_"));
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(
            MediaStore.MediaColumns.RELATIVE_PATH,
            (video ? "Movies/" : "Pictures/") + "Atlas Imports");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = context.getContentResolver().insert(collection, values);
        if (uri == null) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
        final Uri createdUri = uri;
        String savedUri = uri.toString();
        final String pendingUri = savedUri;
        repo.store.edit(
            state ->
                state.getJSONObject("takeoutJobs").getJSONObject(id).put("pendingUri", pendingUri));
        boolean success = false;
        long bytes = 0;
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        try {
          try (OutputStream out = context.getContentResolver().openOutputStream(uri, "w")) {
            if (out == null) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
            byte[] buffer = new byte[65536];
            int n;
            long next = 0;
            while ((n = zip.read(buffer)) != -1) {
              control.check();
              out.write(buffer, 0, n);
              hash.update(buffer, 0, n);
              bytes += n;
              if (bytes >= next) {
                control.progress(file, bytes, files);
                next = bytes + 4 * 1024 * 1024;
              }
            }
          }
          zip.closeEntry();
          String sha = R2Policy.hex(hash.digest()), hashKey = "hash:" + repo.store.localToken(sha);
          JSONObject duplicate = store.importGet(hashKey);
          if (duplicate != null) {
            Uri existing = Uri.parse(duplicate.getString("uri"));
            try (InputStream check = context.getContentResolver().openInputStream(existing)) {
              if (check != null) {
                MessageDigest verified = MessageDigest.getInstance("SHA-256");
                byte[] buffer = new byte[65536];
                int length;
                while ((length = check.read(buffer)) != -1) {
                  control.check();
                  verified.update(buffer, 0, length);
                }
                if (sha.equals(R2Policy.hex(verified.digest()))) {
                  context.getContentResolver().delete(createdUri, "is_pending=1", null);
                  uri = existing;
                  savedUri = uri.toString();
                }
              }
            } catch (FileNotFoundException ignored) {
            }
          }
          String pathKey = "path:" + R2Policy.digest(path.getBytes(StandardCharsets.UTF_8));
          JSONObject sidecar =
              store.importGet("sidecar:" + R2Policy.digest(path.getBytes(StandardCharsets.UTF_8)));
          JSONObject record =
              new JSONObject()
                  .put("path", path)
                  .put("folder", folder)
                  .put("name", file)
                  .put("mimeType", mime)
                  .put("size", bytes)
                  .put("sha256", sha)
                  .put("hashKey", hashKey)
                  .put("uri", uri.toString())
                  .put("importId", id);
          if (sidecar != null) record.put("metadata", sidecar.getJSONObject("metadata"));
          else if (duplicate != null && duplicate.has("metadata"))
            record.put("metadata", duplicate.getJSONObject("metadata"));
          JSONArray albums = duplicate == null ? new JSONArray() : duplicate.optJSONArray("albums");
          if (albums == null) albums = new JSONArray();
          Set<String> names = new LinkedHashSet<>();
          for (int i = 0; i < albums.length(); i++) names.add(albums.getString(i));
          if (!folder.isEmpty()) names.add(folder.substring(folder.lastIndexOf('/') + 1));
          record.put("albums", new JSONArray(names));
          store.importPut(pathKey, uri.toString(), record);
          store.importPut(uriId(uri), uri.toString(), record);
          store.importPut(hashKey, uri.toString(), record);
          values = new ContentValues();
          values.put(MediaStore.MediaColumns.IS_PENDING, 0);
          if (record.optJSONObject("metadata") != null
              && record.getJSONObject("metadata").has("capturedAt"))
            values.put("datetaken", record.getJSONObject("metadata").getLong("capturedAt"));
          context.getContentResolver().update(uri, values, null, null);
          store.importPut(
              "entry:" + id + ":" + entryId, "", new JSONObject().put("complete", true));
          files++;
          final int processed = files;
          repo.store.edit(
              state -> {
                JSONObject live = state.getJSONObject("takeoutJobs").getJSONObject(id);
                live.put("files", processed).remove("completed");
                live.remove("pendingUri");
              });
          success = true;
        } finally {
          if (!success) {
            try {
              context.getContentResolver().delete(createdUri, "is_pending=1", null);
            } catch (Exception ignored) {
            }
          }
        }
      }
    }
    return files;
  }
}
