package com.lifeatlas.app.r2;

import android.content.*;
import android.database.Cursor;
import android.os.Build;
import android.provider.MediaStore;
import java.text.SimpleDateFormat;
import java.util.*;
import org.json.*;

/** Metadata-only, on demand. No AI download, background scan, notification or photo decode. */
final class GallerySmartAlbums {
  static final class Filter {
    final String sql;
    final List<String> args;

    Filter(String sql, String... args) {
      this.sql = sql;
      this.args = List.of(args);
    }
  }

  static Calendar day(long time, TimeZone zone) {
    Calendar c = Calendar.getInstance(zone);
    c.setTimeInMillis(time);
    return c;
  }

  static Calendar start(Calendar value) {
    Calendar c = (Calendar) value.clone();
    c.set(Calendar.HOUR_OF_DAY, 0);
    c.set(Calendar.MINUTE, 0);
    c.set(Calendar.SECOND, 0);
    c.set(Calendar.MILLISECOND, 0);
    return c;
  }

  static Filter filter(String key, long now, TimeZone zone) throws Exception {
    if (key.equals("videos")) return new Filter("media_type=3");
    if (key.equals("screenshots"))
      return new Filter(
          "media_type=1 AND (LOWER(bucket_display_name) IN ('screenshots','screen captures') OR"
              + " LOWER(_display_name) LIKE 'screenshot%')");
    Calendar from = start(day(now, zone)), to;
    if (key.equals("this-month")) {
      from.set(Calendar.DAY_OF_MONTH, 1);
      to = (Calendar) from.clone();
      to.add(Calendar.MONTH, 1);
    } else if (key.equals("this-year")) {
      from.set(Calendar.DAY_OF_YEAR, 1);
      to = (Calendar) from.clone();
      to.add(Calendar.YEAR, 1);
    } else if (key.matches("memory:[0-9]{4}-[0-9]{2}-[0-9]{2}")) {
      SimpleDateFormat parser = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
      parser.setTimeZone(zone);
      parser.setLenient(false);
      Date parsed = parser.parse(key.substring(7));
      from = start(day(parsed.getTime(), zone));
      to = (Calendar) from.clone();
      to.add(Calendar.DAY_OF_YEAR, 1);
    } else throw new R2Exception("INVALID_SELECTION");
    return new Filter(
        "datetaken>=? AND datetaken<?",
        Long.toString(from.getTimeInMillis()),
        Long.toString(to.getTimeInMillis()));
  }

  static List<String> keys(
      long capturedAt, boolean video, String album, String name, long now, TimeZone zone) {
    album = Objects.toString(album, "");
    name = Objects.toString(name, "");
    List<String> out = new ArrayList<>();
    if (video) out.add("videos");
    if (!video
        && (Set.of("screenshots", "screen captures").contains(album.toLowerCase(Locale.ROOT))
            || name.toLowerCase(Locale.ROOT).startsWith("screenshot"))) out.add("screenshots");
    if (capturedAt <= 0) return out;
    Calendar date = day(capturedAt, zone), today = day(now, zone);
    if (date.get(Calendar.YEAR) == today.get(Calendar.YEAR)) {
      out.add("this-year");
      if (date.get(Calendar.MONTH) == today.get(Calendar.MONTH)) out.add("this-month");
    }
    if (date.get(Calendar.YEAR) < today.get(Calendar.YEAR)
        && date.get(Calendar.MONTH) == today.get(Calendar.MONTH)
        && date.get(Calendar.DAY_OF_MONTH) == today.get(Calendar.DAY_OF_MONTH)) {
      SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
      format.setTimeZone(zone);
      out.add("memory:" + format.format(new Date(capturedAt)));
    }
    return out;
  }

  static List<JSONObject> summaries(Context context, GallerySearchStore db, long now, TimeZone zone)
      throws Exception {
    Set<String> hidden = GalleryPeople.set(db.choice("memories").optJSONArray("hidden"));
    Map<String, JSONObject> rows = new LinkedHashMap<>();
    String where =
        "media_type IN (1,3)"
            + (Build.VERSION.SDK_INT >= 29 ? " AND is_pending=0" : "")
            + (Build.VERSION.SDK_INT >= 30 ? " AND is_trashed=0" : "");
    List<String> columns =
        new ArrayList<>(
            List.of("_id", "media_type", "datetaken", "bucket_display_name", "_display_name"));
    if (Build.VERSION.SDK_INT >= 29) columns.add("volume_name");
    try (Cursor c =
        context
            .getContentResolver()
            .query(
                MediaStore.Files.getContentUri("external"),
                columns.toArray(new String[0]),
                where,
                null,
                "date_added DESC, _id DESC")) {
      while (c != null && c.moveToNext()) {
        boolean video = c.getInt(c.getColumnIndexOrThrow("media_type")) == 3;
        String id =
            (video ? "video:" : "image:")
                + (Build.VERSION.SDK_INT >= 29
                    ? c.getString(c.getColumnIndexOrThrow("volume_name"))
                    : "external")
                + ":"
                + c.getLong(c.getColumnIndexOrThrow("_id"));
        long taken =
            c.isNull(c.getColumnIndexOrThrow("datetaken"))
                ? 0
                : c.getLong(c.getColumnIndexOrThrow("datetaken"));
        String
            album =
                Objects.toString(c.getString(c.getColumnIndexOrThrow("bucket_display_name")), ""),
            name = Objects.toString(c.getString(c.getColumnIndexOrThrow("_display_name")), "");
        for (String key : keys(taken, video, album, name, now, zone)) {
          if (hidden.contains(key)) continue;
          JSONObject row = rows.get(key);
          if (row == null) {
            boolean memory = key.startsWith("memory:");
            String title =
                memory
                    ? "This day in " + key.substring(7, 11)
                    : key.equals("this-month")
                        ? "This month"
                        : key.equals("this-year")
                            ? "This year"
                            : key.equals("videos") ? "Videos" : "Screenshots";
            row =
                new JSONObject()
                    .put("id", key)
                    .put("kind", memory ? "memory" : "album")
                    .put("title", title)
                    .put("subtitle", memory ? "From your camera dates" : "Automatically collected")
                    .put("count", 0)
                    .put("coverId", id);
            rows.put(key, row);
          }
          row.put("count", row.getInt("count") + 1);
        }
      }
    }
    List<JSONObject> result = new ArrayList<>(rows.values());
    result.sort(
        Comparator.comparing((JSONObject r) -> !r.optString("kind").equals("memory"))
            .thenComparing(r -> r.optString("id"), Comparator.reverseOrder()));
    return result;
  }
}
