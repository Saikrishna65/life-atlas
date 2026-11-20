package com.lifeatlas.app.r2;

import android.content.*;
import android.database.Cursor;
import androidx.work.*;
import java.io.FileNotFoundException;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.json.*;

/** Search approval is independent of storage credentials, publishing approval and cloud backup. */
final class GalleryIntelligence {
  static final Object STATE_LOCK = new Object();
  static final String WORK = "atlas-gallery-search",
      PERIODIC = WORK + "-periodic",
      KEY = "galleryIntelligence";
  final Context context;
  final R2SecureStore secure;

  GalleryIntelligence(Context c) {
    this(c, new R2SecureStore(c));
  }

  GalleryIntelligence(Context c, R2SecureStore secure) {
    context = c.getApplicationContext();
    this.secure = secure;
  }

  JSONObject settings() throws Exception {
    JSONObject v = secure.snapshot().optJSONObject(KEY);
    return v == null ? new JSONObject() : v;
  }

  boolean active(String epoch) throws Exception {
    JSONObject v = settings();
    return v.optBoolean("enabled") && epoch.equals(v.optString("epoch"));
  }

  void change(String epoch, java.util.function.Consumer<JSONObject> mutation) throws Exception {
    synchronized (STATE_LOCK) {
      secure.edit(
          root -> {
            JSONObject v = root.optJSONObject(KEY);
            if (v != null && epoch.equals(v.optString("epoch"))) mutation.accept(v);
          });
    }
  }

  JSONObject status() throws Exception {
    JSONObject v = settings();
    int count;
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      count = db.count();
    }
    return new JSONObject()
        .put("enabled", v.optBoolean("enabled"))
        .put("ocr", v.optBoolean("ocr", true))
        .put("visual", v.optBoolean("visual"))
        .put("chargingOnly", v.optBoolean("chargingOnly", true))
        .put("wifiOnly", v.optBoolean("wifiOnly", true))
        .put(
            "albums", v.optJSONArray("albums") == null ? new JSONArray() : v.getJSONArray("albums"))
        .put("state", v.optString("state", "off"))
        .put("indexed", count)
        .put("scanned", v.optInt("scanned"))
        .put("failed", v.optInt("failed"))
        .put("error", v.optString("error"))
        .put("updatedAt", v.optLong("updatedAt"))
        .put("modelReady", GalleryClip.ready(context))
        .put("modelBytes", GalleryClip.DOWNLOAD_BYTES);
  }

  JSONObject configure(JSONObject input) throws Exception {
    JSONArray albums = input.optJSONArray("albums");
    if (albums == null
        || albums.length() > 500
        || (!input.optBoolean("ocr") && !input.optBoolean("visual")))
      throw new R2Exception("INVALID_SELECTION");
    for (int i = 0; i < albums.length(); i++)
      if (albums.getString(i).length() > 200) throw new R2Exception("INVALID_SELECTION");
    synchronized (STATE_LOCK) {
      String epoch = UUID.randomUUID().toString();
      JSONObject v =
          new JSONObject()
              .put("enabled", true)
              .put("epoch", epoch)
              .put("ocr", input.optBoolean("ocr"))
              .put("visual", input.optBoolean("visual"))
              .put("chargingOnly", input.optBoolean("chargingOnly", true))
              .put("wifiOnly", input.optBoolean("wifiOnly", true))
              .put("albums", albums)
              .put("cursor", "")
              .put("state", "waiting")
              .put("scanned", 0)
              .put("failed", 0)
              .put("updatedAt", System.currentTimeMillis());
      secure.edit(root -> root.put(KEY, v));
      WorkManager.getInstance(context).cancelAllWorkByTag(WORK);
      try (GallerySearchStore db = new GallerySearchStore(secure)) {
        db.clear();
      }
      enqueue(v);
      schedule(v);
    }
    return status();
  }

  JSONObject control(String action) throws Exception {
    if (!Set.of("pause", "resume", "scan", "clear").contains(action))
      throw new R2Exception("INVALID_SELECTION");
    synchronized (STATE_LOCK) {
      JSONObject v = settings();
      if (action.equals("pause") || action.equals("clear")) {
        v.put("enabled", false)
            .put("state", action.equals("clear") ? "off" : "paused")
            .put("epoch", UUID.randomUUID().toString());
        secure.edit(root -> root.put(KEY, v));
        WorkManager.getInstance(context).cancelAllWorkByTag(WORK);
        if (action.equals("clear")) {
          try (GallerySearchStore db = new GallerySearchStore(secure)) {
            db.clear();
          }
          secure.edit(root -> root.remove(KEY));
        }
      } else {
        if (!v.has("epoch")) throw new R2Exception("SEARCH_NOT_CONFIGURED");
        v.put("enabled", true)
            .put("state", "waiting")
            .put("error", "")
            .put("epoch", UUID.randomUUID().toString());
        WorkManager.getInstance(context).cancelAllWorkByTag(WORK);
        if (action.equals("scan") || v.optString("cursor").isEmpty())
          v.put("cursor", "").put("scanned", 0).put("failed", 0);
        secure.edit(root -> root.put(KEY, v));
        enqueue(v);
        schedule(v);
      }
    }
    // Cancel first, then acquire the model lock; a stopped download leaves no newly installed
    // model.
    if (action.equals("clear"))
      synchronized (GalleryClip.LOCK) {
        GalleryClip.remove(context);
      }
    return status();
  }

  Constraints constraints(JSONObject v, boolean download) {
    Constraints.Builder b =
        new Constraints.Builder()
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)
            .setRequiresCharging(v.optBoolean("chargingOnly", true));
    if (download)
      b.setRequiredNetworkType(
          v.optBoolean("wifiOnly", true) ? NetworkType.UNMETERED : NetworkType.CONNECTED);
    return b.build();
  }

  void enqueue(JSONObject v) {
    OneTimeWorkRequest request =
        new OneTimeWorkRequest.Builder(GalleryIntelligenceWorker.class)
            .setInputData(new Data.Builder().putString("epoch", v.optString("epoch")).build())
            .addTag(WORK)
            .setConstraints(constraints(v, v.optBoolean("visual") && !GalleryClip.ready(context)))
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build();
    WorkManager.getInstance(context)
        .enqueueUniqueWork(WORK, ExistingWorkPolicy.APPEND_OR_REPLACE, request);
  }

  void schedule(JSONObject v) {
    PeriodicWorkRequest request =
        new PeriodicWorkRequest.Builder(GalleryIntelligenceWorker.class, 12, TimeUnit.HOURS)
            .setInitialDelay(12, TimeUnit.HOURS)
            .setInputData(
                new Data.Builder()
                    .putBoolean("rescan", true)
                    .putString("epoch", v.optString("epoch"))
                    .build())
            .addTag(WORK)
            .setConstraints(constraints(v, v.optBoolean("visual") && !GalleryClip.ready(context)))
            .build();
    WorkManager.getInstance(context)
        .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, request);
  }

  static List<String> terms(String q) {
    return Arrays.stream(q.toLowerCase(Locale.ROOT).trim().split("\\s+"))
        .filter(s -> !s.isEmpty())
        .limit(30)
        .collect(java.util.stream.Collectors.toList());
  }

  static boolean textMatch(String text, List<String> terms) {
    String lower = text.toLowerCase(Locale.ROOT);
    return !terms.isEmpty() && terms.stream().allMatch(lower::contains);
  }

  JSONObject search(String query, String album, String kind, int offset) throws Exception {
    if (query == null
        || query.trim().isEmpty()
        || query.length() > 200
        || offset < 0
        || offset > 10000
        || album.length() > 200) throw new R2Exception("INVALID_SELECTION");
    JSONObject config = settings();
    Set<String> allowed = new HashSet<>();
    JSONArray approvedAlbums = config.optJSONArray("albums");
    if (approvedAlbums != null)
      for (int i = 0; i < approvedAlbums.length(); i++) allowed.add(approvedAlbums.getString(i));
    List<String> terms = terms(query);
    float[] vector = null;
    if (config.optBoolean("visual") && !kind.equals("video") && GalleryClip.ready(context))
      synchronized (GalleryClip.LOCK) {
        try (GalleryClip clip = new GalleryClip(context)) {
          vector = clip.query(query);
        }
      }
    record Hit(String id, String stamp, double rank) {}
    // Bound memory while scanning encrypted vectors. No OCR or vector is returned through the
    // bridge.
    int limit = Math.min(10080, offset + 81);
    PriorityQueue<Hit> top =
        new PriorityQueue<>(
            Comparator.comparingDouble(Hit::rank)
                .thenComparing(Hit::id, Comparator.reverseOrder()));
    try (GallerySearchStore db = new GallerySearchStore(secure);
        Cursor cursor = db.rows()) {
      while (cursor.moveToNext()) {
        JSONObject row = db.read(cursor.getString(0), cursor.getBlob(1)),
            media = row.getJSONObject("media");
        if (!album.isEmpty() && !album.equals(media.optString("album"))) continue;
        if (!allowed.isEmpty() && !allowed.contains(media.optString("album"))) continue;
        if (kind.equals("video")) continue;
        boolean text =
            textMatch(
                media.optString("name")
                    + " "
                    + media.optString("album")
                    + " "
                    + (config.optBoolean("ocr") ? row.optString("text") : ""),
                terms);
        double score = text ? 2 : 0;
        JSONArray embedding = row.optJSONArray("embedding");
        if (vector != null && embedding != null && embedding.length() == 512) {
          float[] values = new float[512];
          for (int i = 0; i < 512; i++) values[i] = (float) embedding.getDouble(i);
          double similarity = GalleryClip.cosine(vector, values);
          if (similarity >= .20) score = Math.max(score, similarity);
        }
        if (score == 0) continue;
        top.add(new Hit(media.getString("id"), row.getString("stamp"), score));
        if (top.size() > limit) top.poll();
      }
    }
    List<Hit> sorted = new ArrayList<>(top);
    sorted.sort(Comparator.comparingDouble(Hit::rank).reversed().thenComparing(Hit::id));
    JSONArray items = new JSONArray();
    R2DeviceGallery gallery = new R2DeviceGallery(context);
    int consumed = offset;
    for (int i = offset; i < sorted.size(); i++) {
      if (items.length() == 80) break;
      Hit hit = sorted.get(i);
      consumed = i + 1;
      try {
        JSONObject media = gallery.one(hit.id());
        // Permission revocation, deletion, edits and trashed photos must not expose stale search
        // results.
        if (!hit.stamp().equals(R2DeviceGallery.stamp(media))) continue;
        if (!album.isEmpty() && !album.equals(media.optString("album"))) continue;
        if (!allowed.isEmpty() && !allowed.contains(media.optString("album"))) continue;
        items.put(media);
      } catch (SecurityException
          | FileNotFoundException
          | IllegalArgumentException
          | R2Exception ignored) {
      }
    }
    boolean complete = consumed >= sorted.size();
    return new JSONObject()
        .put("items", items)
        .put("cursor", complete ? "" : Integer.toString(consumed))
        .put("complete", complete)
        .put("indexedOnly", true)
        .put("visual", vector != null);
  }
}
