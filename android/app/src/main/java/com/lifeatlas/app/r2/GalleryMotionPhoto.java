package com.lifeatlas.app.r2;

import android.content.*;
import android.database.Cursor;
import android.os.*;
import android.provider.MediaStore;
import androidx.exifinterface.media.ExifInterface;
import java.io.*;
import java.util.*;
import org.json.*;
import org.xmlpull.v1.*;

/** Recognises supported embedded XMP MP4s and same-folder JPEG/HEIC + MOV companions. */
final class GalleryMotionPhoto {
  static long offset(String xmp, long size) throws Exception {
    if (xmp == null
        || xmp.length() > 1024 * 1024
        || xmp.contains("<!DOCTYPE")
        || xmp.contains("<!ENTITY")) return 0;
    XmlPullParser parser = android.util.Xml.newPullParser();
    parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true);
    parser.setInput(new StringReader(xmp));
    long length = 0;
    for (int event = parser.getEventType();
        event != XmlPullParser.END_DOCUMENT;
        event = parser.next())
      if (event == XmlPullParser.START_TAG) {
        boolean motion = false;
        String itemLength = "";
        for (int i = 0; i < parser.getAttributeCount(); i++) {
          String name = parser.getAttributeName(i), value = parser.getAttributeValue(i);
          if (name.equals("MicroVideoOffset")) length = Long.parseLong(value);
          if (name.equals("Semantic") && value.equals("MotionPhoto")) motion = true;
          if (name.equals("Length")) itemLength = value;
        }
        if (motion && !itemLength.isEmpty()) length = Long.parseLong(itemLength);
      }
    return length >= 16 && length < size && length <= 512L * 1024 * 1024 ? length : 0;
  }

  static JSONObject inspect(Context context, String id, boolean extract) throws Exception {
    JSONObject media = new R2DeviceGallery(context).one(id), result = new JSONObject();
    if (!"photo".equals(media.getString("kind"))) return result;
    long length = 0;
    try (InputStream in =
        context.getContentResolver().openInputStream(R2DeviceGallery.originalUri(id))) {
      if (in != null) {
        ExifInterface exif = new ExifInterface(in);
        length = offset(exif.getAttribute(ExifInterface.TAG_XMP), media.optLong("size"));
      }
    } catch (Exception ignored) {
    }
    if (length > 0) {
      ParcelFileDescriptor pfd =
          context.getContentResolver().openFileDescriptor(R2DeviceGallery.originalUri(id), "r");
      if (pfd == null) throw new IOException();
      try (ParcelFileDescriptor.AutoCloseInputStream in =
          new ParcelFileDescriptor.AutoCloseInputStream(pfd)) {
        in.getChannel().position(media.getLong("size") - length);
        byte[] header = new byte[12];
        if (in.read(header) != 12
            || header[4] != 'f'
            || header[5] != 't'
            || header[6] != 'y'
            || header[7] != 'p') return result;
        result.put("embedded", true);
        if (extract) {
          if (length > 64L * 1024 * 1024) throw new R2Exception("MOTION_CLIP_TOO_LARGE");
          File dir = GalleryMediaTools.cache(context, "gallery-motion"),
              file =
                  new File(
                      dir, GallerySearchStore.token(id + R2DeviceGallery.stamp(media)) + ".mp4");
          if (!file.exists()) {
            try (OutputStream out = new FileOutputStream(file)) {
              out.write(header);
              byte[] buffer = new byte[65536];
              long remaining = length - 12;
              while (remaining > 0) {
                int n = in.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                if (n < 0) throw new IOException();
                out.write(buffer, 0, n);
                remaining -= n;
              }
            } catch (Exception failure) {
              file.delete();
              throw failure;
            }
            GalleryPreviewSettings.pruneIfDue(dir, 64L * 1024 * 1024, file);
          }
          if (System.currentTimeMillis() - file.lastModified() >= 60000)
            file.setLastModified(System.currentTimeMillis());
          result.put("path", file.getAbsolutePath());
        }
      }
      return result;
    }
    String name = media.optString("name"),
        stem = name.lastIndexOf('.') > 0 ? name.substring(0, name.lastIndexOf('.')) : "";
    if (stem.length() < 2) return result;
    // A filename match is only a suggested companion. Never search across different folders.
    String[] projection = {"_id", "_display_name", "bucket_id"};
    String parent = "";
    try (Cursor current =
        context
            .getContentResolver()
            .query(R2DeviceGallery.uri(id), new String[] {"bucket_id"}, null, null, null)) {
      if (current != null && current.moveToFirst()) parent = current.getString(0);
    }
    if (parent == null || parent.isEmpty()) return result;
    try (Cursor peers =
        context
            .getContentResolver()
            .query(
                MediaStore.Files.getContentUri("external"),
                projection,
                "media_type=3 AND bucket_id=? AND (_display_name=? OR _display_name=? OR"
                    + " _display_name=?)"
                    + (Build.VERSION.SDK_INT >= 29 ? " AND volume_name=?" : ""),
                Build.VERSION.SDK_INT >= 29
                    ? new String[] {
                      parent,
                      stem + ".MOV",
                      stem + ".mov",
                      stem + ".mp4",
                      media.getString("id").split(":")[1]
                    }
                    : new String[] {parent, stem + ".MOV", stem + ".mov", stem + ".mp4"},
                null)) {
      if (peers != null && peers.moveToFirst()) {
        String volume = media.getString("id").split(":")[1],
            peer = "video:" + volume + ":" + peers.getLong(0);
        JSONObject companion = new R2DeviceGallery(context).one(peer);
        if (!"video".equals(companion.optString("kind"))) return result;
        if (media.optLong("capturedAt") > 0
            && companion.optLong("capturedAt") > 0
            && Math.abs(media.getLong("capturedAt") - companion.getLong("capturedAt")) > 120000)
          return result;
        result.put("companion", companion);
      }
    }
    return result;
  }
}
