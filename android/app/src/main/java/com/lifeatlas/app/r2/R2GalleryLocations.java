package com.lifeatlas.app.r2;

import android.content.Context;
import android.media.MediaMetadataRetriever;
import androidx.exifinterface.media.ExifInterface;
import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.regex.*;
import org.json.*;

/**
 * Read original metadata only. No reverse-geocoding service, location tracking, or file mutation.
 */
final class R2GalleryLocations {
  static JSONObject point(double lat, double lon) throws Exception {
    if (!Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
      throw new R2Exception("INVALID_MEDIA_METADATA");
    return new JSONObject().put("latitude", lat).put("longitude", lon);
  }

  static JSONObject videoPoint(String value) throws Exception {
    if (value == null) return null;
    Matcher m =
        Pattern.compile(
                "^([+-][0-9]{2}(?:\\.[0-9]+)?)([+-][0-9]{3}(?:\\.[0-9]+)?)(?:[+-][0-9.]+)?/?$")
            .matcher(value);
    return m.matches()
        ? point(Double.parseDouble(m.group(1)), Double.parseDouble(m.group(2)))
        : null;
  }

  static JSONArray read(
      Context context, JSONArray ids, JSONObject versions, boolean fingerprints, R2Repository repo)
      throws Exception {
    if (ids == null || ids.length() > 20) throw new R2Exception("INVALID_SELECTION");
    byte[] keys = fingerprints ? repo.keyset() : null;
    try {
      JSONArray result = new JSONArray();
      R2DeviceGallery gallery = new R2DeviceGallery(context, repo);
      for (int i = 0; i < ids.length(); i++) {
        String id = ids.getString(i);
        JSONObject media = gallery.one(id);
        String stamp = R2DeviceGallery.stamp(media);
        if (versions != null && !stamp.equals(versions.optString(id)))
          throw new R2Exception("SOURCE_CHANGED");
        JSONObject item =
            new JSONObject().put("id", id).put("sourceStamp", stamp).put("state", "missing");
        if (fingerprints) {
          java.security.MessageDigest hash = java.security.MessageDigest.getInstance("SHA-256");
          try (InputStream in =
              context.getContentResolver().openInputStream(R2DeviceGallery.originalUri(id))) {
            if (in == null) throw new R2Exception("SOURCE_UNAVAILABLE");
            byte[] buffer = new byte[65536];
            int n;
            while ((n = in.read(buffer)) != -1) hash.update(buffer, 0, n);
          }
          javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
          mac.init(new javax.crypto.spec.SecretKeySpec(keys, "HmacSHA256"));
          mac.update(
              "life-atlas-place-fingerprint-v1\n"
                  .getBytes(java.nio.charset.StandardCharsets.UTF_8));
          item.put(
              "fingerprint", R2Crypto.keyId(keys) + ":" + R2Policy.hex(mac.doFinal(hash.digest())));
        } else
          try {
            JSONObject gps = null;
            String date = null;
            if (id.startsWith("image:")) {
              try (InputStream in =
                  context.getContentResolver().openInputStream(R2DeviceGallery.originalUri(id))) {
                if (in == null) throw new IOException();
                ExifInterface exif = new ExifInterface(in);
                double[] coords = exif.getLatLong();
                if (coords != null) gps = point(coords[0], coords[1]);
                date = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL);
                if (date != null)
                  try {
                    String offset = exif.getAttribute(ExifInterface.TAG_OFFSET_TIME_ORIGINAL);
                    SimpleDateFormat format =
                        new SimpleDateFormat(
                            offset == null ? "yyyy:MM:dd HH:mm:ss" : "yyyy:MM:dd HH:mm:ssXXX",
                            Locale.US);
                    format.setLenient(false);
                    Date parsed = format.parse(date + (offset == null ? "" : offset));
                    if (parsed != null)
                      item.put("capturedAt", parsed.getTime())
                          .put(
                              "timeSource",
                              offset == null ? "camera-device-timezone" : "camera-offset");
                  } catch (Exception ignored) {
                  }
              }
            } else {
              MediaMetadataRetriever retriever = new MediaMetadataRetriever();
              try {
                retriever.setDataSource(context, R2DeviceGallery.originalUri(id));
                gps =
                    videoPoint(
                        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_LOCATION));
                date = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE);
                if (date != null)
                  try {
                    Date parsed =
                        new SimpleDateFormat("yyyyMMdd'T'HHmmss.SSS'Z'", Locale.US) {
                          {
                            setTimeZone(TimeZone.getTimeZone("UTC"));
                          }
                        }.parse(date);
                    if (parsed != null)
                      item.put("capturedAt", parsed.getTime()).put("timeSource", "video");
                  } catch (Exception ignored) {
                  }
              } finally {
                retriever.release();
              }
            }
            if (gps != null) item.put("gps", gps).put("state", "found");
          } catch (SecurityException error) {
            item.put("state", "unavailable");
          } catch (Exception error) {
            item.put("state", "unsupported");
          }
        if (!stamp.equals(R2DeviceGallery.stamp(gallery.one(id))))
          throw new R2Exception("SOURCE_CHANGED");
        result.put(item);
      }
      return result;
    } finally {
      if (keys != null) Arrays.fill(keys, (byte) 0);
    }
  }
}
