package com.lifeatlas.app.r2;

import android.content.*;
import android.net.Uri;
import androidx.core.content.FileProvider;
import java.io.*;
import java.util.*;
import org.json.*;

/**
 * Explicit Android actions. Sharing grants read access only; editing always uses a separate copy.
 */
final class GalleryMediaActions {
  static String hash(File file) throws Exception {
    java.security.MessageDigest hash = java.security.MessageDigest.getInstance("SHA-256");
    try (InputStream in = new FileInputStream(file)) {
      byte[] b = new byte[65536];
      int n;
      while ((n = in.read(b)) != -1) hash.update(b, 0, n);
    }
    return R2Policy.hex(hash.digest());
  }

  static List<JSONObject> media(Context context, JSONArray ids) throws Exception {
    if (ids == null || ids.length() == 0 || ids.length() > 100)
      throw new R2Exception("INVALID_SELECTION");
    List<JSONObject> out = new ArrayList<>();
    Set<String> unique = new HashSet<>();
    for (int i = 0; i < ids.length(); i++)
      if (unique.add(ids.getString(i))) out.add(new R2DeviceGallery(context).one(ids.getString(i)));
    return out;
  }

  static Intent share(Context context, JSONArray ids) throws Exception {
    List<JSONObject> photos = media(context, ids);
    ArrayList<Uri> uris = new ArrayList<>();
    String type = photos.get(0).getString("mimeType");
    for (JSONObject photo : photos) {
      uris.add(R2DeviceGallery.uri(photo.getString("id")));
      if (!type.equals(photo.getString("mimeType")))
        type =
            type.split("/")[0].equals(photo.getString("mimeType").split("/")[0])
                ? type.split("/")[0] + "/*"
                : "*/*";
    }
    Intent intent =
        new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE)
            .setType(type)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    if (uris.size() == 1) intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
    else intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
    ClipData clip = ClipData.newUri(context.getContentResolver(), "Selected media", uris.get(0));
    for (int i = 1; i < uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
    intent.setClipData(clip);
    return Intent.createChooser(intent, "Share").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
  }

  static Intent sharePreview(Context context, String token) throws Exception {
    if (!token.matches("[a-f0-9-]{36}")) throw new R2Exception("INVALID_SELECTION");
    File found = null;
    File[] files = R2GalleryPreview.root(context).listFiles();
    if (files != null)
      for (File f : files)
        if (f.getName().startsWith(token + ".")
            && !f.getName().endsWith(".encrypted")
            && !f.getName().endsWith(".plain")) {
          found = f;
          break;
        }
    if (found == null) throw new R2Exception("PREVIEW_UNAVAILABLE");
    File dir = new File(context.getCacheDir(), "gallery-shared");
    if (!dir.exists() && !dir.mkdirs()) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
    File[] old = dir.listFiles();
    if (old != null)
      for (File f : old) if (f.lastModified() < System.currentTimeMillis() - 86400000L) f.delete();
    if (dir.getUsableSpace() < found.length() + 64L * 1024 * 1024)
      throw new R2Exception("INSUFFICIENT_DEVICE_SPACE");
    File copy = new File(dir, found.getName());
    try (InputStream in = new FileInputStream(found);
        OutputStream out = new FileOutputStream(copy)) {
      byte[] buffer = new byte[65536];
      int n;
      while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
    }
    String ext = copy.getName().substring(copy.getName().lastIndexOf('.') + 1),
        mime = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
    Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", copy);
    Intent intent =
        new Intent(Intent.ACTION_SEND)
            .setType(mime == null ? "application/octet-stream" : mime)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    intent.setClipData(ClipData.newUri(context.getContentResolver(), "Shared original", uri));
    return Intent.createChooser(intent, "Share original");
  }

  static File directory(Context context) throws Exception {
    File dir = new File(context.getCacheDir(), "gallery-edits");
    if (!dir.exists() && !dir.mkdirs()) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
    File[] old = dir.listFiles();
    if (old != null)
      for (File file : old)
        if (file.lastModified() < System.currentTimeMillis() - 86400000L) file.delete();
    return dir;
  }

  static JSONObject editCopy(Context context, String id) throws Exception {
    JSONObject photo = new R2DeviceGallery(context).one(id);
    String mime = photo.getString("mimeType");
    if (!mime.startsWith("image/")) throw new R2Exception("EDIT_PHOTO_ONLY");
    File dir = directory(context);
    if (photo.optLong("size") > 256L * 1024 * 1024
        || dir.getUsableSpace() < photo.optLong("size") + 32L * 1024 * 1024)
      throw new R2Exception("INSUFFICIENT_STORAGE");
    String suffix = photo.optString("name").replaceAll("[^a-zA-Z0-9._-]", "_");
    if (suffix.length() > 100) suffix = suffix.substring(suffix.length() - 100);
    File copy = new File(dir, UUID.randomUUID() + "-" + suffix);
    long copied = 0;
    try (InputStream in = context.getContentResolver().openInputStream(R2DeviceGallery.uri(id));
        OutputStream out = new FileOutputStream(copy)) {
      if (in == null) throw new R2Exception("SOURCE_UNAVAILABLE");
      byte[] buffer = new byte[65536];
      int n;
      while ((n = in.read(buffer)) != -1) {
        copied += n;
        if (copied > 256L * 1024 * 1024) throw new IOException("INSUFFICIENT_STORAGE");
        out.write(buffer, 0, n);
      }
    }
    return new JSONObject()
        .put("path", copy.getAbsolutePath())
        .put("mimeType", mime)
        .put("name", photo.getString("name"))
        .put("hash", hash(copy));
  }

  static Intent editor(Context context, JSONObject copy) throws Exception {
    Uri uri =
        FileProvider.getUriForFile(
            context, context.getPackageName() + ".fileprovider", new File(copy.getString("path")));
    return new Intent(Intent.ACTION_EDIT)
        .setDataAndType(uri, copy.getString("mimeType"))
        .putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra("output", uri)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
  }

  static JSONObject saveEdited(Context context, JSONObject copy, Uri returned) throws Exception {
    File path = new File(copy.getString("path"));
    Uri source =
        returned != null && "content".equals(returned.getScheme()) ? returned : Uri.fromFile(path);
    // Decode only bounds to validate that the editor produced an image and identify its actual
    // format.
    android.graphics.BitmapFactory.Options options = new android.graphics.BitmapFactory.Options();
    options.inJustDecodeBounds = true;
    try (InputStream in = context.getContentResolver().openInputStream(source)) {
      android.graphics.BitmapFactory.decodeStream(in, null, options);
    }
    if (options.outWidth <= 0 || options.outHeight <= 0 || options.outMimeType == null)
      throw new R2Exception("EDIT_OUTPUT_INVALID");
    if (returned == null && copy.getString("hash").equals(hash(path))) {
      path.delete();
      return new JSONObject().put("saved", false);
    }
    if (android.os.Build.VERSION.SDK_INT < 29) throw new R2Exception("ANDROID_10_REQUIRED");
    ContentValues values = new ContentValues();
    values.put(
        "_display_name",
        "Atlas edit "
            + System.currentTimeMillis()
            + (options.outMimeType.equals("image/png")
                ? ".png"
                : options.outMimeType.equals("image/webp") ? ".webp" : ".jpg"));
    values.put("mime_type", options.outMimeType);
    values.put("relative_path", "Pictures/Atlas Edits/");
    values.put("is_pending", 1);
    Uri target =
        context
            .getContentResolver()
            .insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
    if (target == null) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
    try (InputStream in = context.getContentResolver().openInputStream(source);
        OutputStream out = context.getContentResolver().openOutputStream(target)) {
      if (in == null || out == null) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
      byte[] b = new byte[65536];
      int n;
      long count = 0;
      while ((n = in.read(b)) != -1) {
        count += n;
        if (count > 256L * 1024 * 1024) throw new IOException("INSUFFICIENT_STORAGE");
        out.write(b, 0, n);
      }
    } catch (Exception e) {
      context.getContentResolver().delete(target, null, null);
      throw e;
    }
    values.clear();
    values.put("is_pending", 0);
    context.getContentResolver().update(target, values, null, null);
    path.delete();
    return new JSONObject().put("saved", true);
  }
}
