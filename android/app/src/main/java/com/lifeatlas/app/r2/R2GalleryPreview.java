package com.lifeatlas.app.r2;

import android.content.Context;
import java.io.*;
import java.util.*;
import org.json.*;

/** Private cache previews are temporary, never public selections or cloud uploads. */
final class R2GalleryPreview {
  static File root(Context context) {
    File root = new File(context.getCacheDir(), "gallery-private-preview");
    root.mkdirs();
    return root;
  }

  static void clear(Context context) {
    File[] files = root(context).listFiles();
    if (files != null) for (File file : files) file.delete();
  }

  static void release(Context context, String token) {
    if (token == null || !token.matches("[a-f0-9-]{36}")) return;
    File[] files = root(context).listFiles();
    if (files != null)
      for (File file : files) if (file.getName().startsWith(token + ".")) file.delete();
  }

  static JSONObject open(Context context, R2Repository repository, String key) throws Exception {
    return open(context, repository, key, new R2Client(repository.store.credentials("private")));
  }

  static JSONObject open(Context context, R2Repository repository, String key, R2Transport client)
      throws Exception {
    R2Policy.key(key);
    File directory = root(context);
    File[] old = directory.listFiles();
    if (old != null)
      for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 3600000) f.delete();
    JSONObject head = client.head(key);
    long size = head.getLong("size");
    if (size <= 0 || size > Math.max(0, (directory.getUsableSpace() - 128L * 1024 * 1024) / 2))
      throw new R2Exception("INSUFFICIENT_DEVICE_SPACE");
    String token = UUID.randomUUID().toString();
    File raw = new File(directory, token + ".encrypted"),
        plain = new File(directory, token + ".plain");
    boolean ready = false;
    try {
      try (R2Client.Response response =
              client.request(
                  "GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null);
          OutputStream out = new FileOutputStream(raw)) {
        byte[] buffer = new byte[65536];
        long total = 0;
        int count;
        while ((count = response.input.read(buffer)) != -1) {
          total += count;
          if (total > size) throw new R2Exception("INTEGRITY_FAILED");
          out.write(buffer, 0, count);
        }
        if (total != size) throw new R2Exception("INTEGRITY_FAILED");
      }
      if (!R2Io.sha(raw).equals(head.optString("sha256")))
        throw new R2Exception("INTEGRITY_FAILED");
      byte[] keys = repository.keyset();
      JSONObject metadata;
      try (InputStream in = new FileInputStream(raw);
          OutputStream out = new FileOutputStream(plain)) {
        metadata = R2Envelope.decrypt(in, out, keys, key);
      } finally {
        Arrays.fill(keys, (byte) 0);
      }
      String mime = metadata.getString("mimeType");
      if (!mime.startsWith("image/") && !mime.startsWith("video/"))
        throw new R2Exception("PREVIEW_UNAVAILABLE");
      File target =
          new File(
              directory,
              token
                  + Map.ofEntries(
                          Map.entry("image/jpeg", ".jpg"),
                          Map.entry("image/png", ".png"),
                          Map.entry("image/webp", ".webp"),
                          Map.entry("image/avif", ".avif"),
                          Map.entry("image/heic", ".heic"),
                          Map.entry("image/heif", ".heif"),
                          Map.entry("image/gif", ".gif"),
                          Map.entry("video/mp4", ".mp4"),
                          Map.entry("video/webm", ".webm"),
                          Map.entry("video/quicktime", ".mov"))
                      .getOrDefault(mime, ".bin"));
      if (!plain.renameTo(target)) throw new R2Exception("LOCAL_STORAGE_UNAVAILABLE");
      ready = true;
      return new JSONObject()
          .put("token", token)
          .put("path", target.getAbsolutePath())
          .put("mimeType", mime)
          .put("name", metadata.getString("name"));
    } finally {
      raw.delete();
      if (!ready) plain.delete();
    }
  }
}
