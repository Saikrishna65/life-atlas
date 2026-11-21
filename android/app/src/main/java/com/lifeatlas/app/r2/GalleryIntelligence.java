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
  static final String OCR_VERSION = "latin-v1";

  static boolean hasCurrentOcr(JSONObject row) {
    return row != null
        && row.optBoolean("ocrDone")
        && OCR_VERSION.equals(row.optString("ocrVersion"));
  }

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
    synchronized (STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(secure)) {
        JSONObject saved = db.choice("analysis-settings");
        if (saved.length() > 0) return saved;
        JSONObject legacy = secure.snapshot().optJSONObject(KEY);
        if (legacy == null) return new JSONObject();
        db.choice("analysis-settings", legacy);
        secure.edit(root -> root.remove(KEY));
        return legacy;
      }
    }
  }

  void writeSettings(JSONObject value) throws Exception {
    synchronized (STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(secure)) {
        db.choice("analysis-settings", value);
      }
    }
  }

  boolean active(String epoch) throws Exception {
    JSONObject v = settings();
    return v.optBoolean("enabled") && epoch.equals(v.optString("epoch"));
  }

  void change(String epoch, java.util.function.Consumer<JSONObject> mutation) throws Exception {
    synchronized (STATE_LOCK) {
      JSONObject value = settings();
      if (epoch.equals(value.optString("epoch"))) {
        mutation.accept(value);
        writeSettings(value);
      }
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
        .put("similar", v.optBoolean("similar"))
        .put("people", v.optBoolean("people"))
        .put("peopleModelReady", GalleryFaceModels.ready(context))
        .put("peopleModelBytes", GalleryFaceModels.BYTES)
        .put("downloadTarget", v.optString("downloadTarget", "visual"))
        .put("waitReason", v.optString("waitReason"))
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

  static void validatePeopleConsent(JSONObject input, JSONObject previous) throws Exception {
    if (input.optBoolean("people")
        && !previous.optBoolean("people")
        && !input.optBoolean("peopleApproved")) throw new R2Exception("PEOPLE_CONSENT_REQUIRED");
  }

  JSONObject configure(JSONObject input) throws Exception {
    JSONArray albums = input.optJSONArray("albums");
    if (albums == null
        || albums.length() > 500
        || (!input.optBoolean("ocr")
            && !input.optBoolean("visual")
            && !input.optBoolean("similar")
            && !input.optBoolean("people"))) throw new R2Exception("INVALID_SELECTION");
    for (int i = 0; i < albums.length(); i++)
      if (albums.getString(i).length() > 200) throw new R2Exception("INVALID_SELECTION");
    synchronized (STATE_LOCK) {
      JSONObject previous = settings();
      validatePeopleConsent(input, previous);
      String epoch = UUID.randomUUID().toString();
      JSONObject v =
          new JSONObject()
              .put("enabled", true)
              .put("epoch", epoch)
              .put("ocr", input.optBoolean("ocr"))
              .put("visual", input.optBoolean("visual"))
              .put("similar", input.optBoolean("similar"))
              .put("people", input.optBoolean("people"))
              .put("chargingOnly", input.optBoolean("chargingOnly", true))
              .put("wifiOnly", input.optBoolean("wifiOnly", true))
              .put("albums", albums)
              .put("cursor", "")
              .put("since", 0)
              .put("scanStarted", System.currentTimeMillis())
              .put("state", "waiting")
              .put("scanned", 0)
              .put("failed", 0)
              .put("updatedAt", System.currentTimeMillis());
      writeSettings(v);
      WorkManager.getInstance(context).cancelAllWorkByTag(WORK);
      try (GallerySearchStore db = new GallerySearchStore(secure)) {
        if (!Objects.toString(previous.optJSONArray("albums"), "[]").equals(albums.toString()))
          db.clear();
        if (previous.optBoolean("people") && !v.optBoolean("people")) GalleryPeople.forget(db);
      }
      enqueue(v);
      schedule(v);
      watch(v);
    }
    if (!input.optBoolean("people"))
      synchronized (GalleryClip.LOCK) {
        GalleryFaceModels.remove(context);
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
        writeSettings(v);
        WorkManager.getInstance(context).cancelAllWorkByTag(WORK);
        if (action.equals("clear")) {
          try (GallerySearchStore db = new GallerySearchStore(secure)) {
            db.clear();
            GalleryRecovery.clearStaged(db);
            db.forgetChoices("people-undo");
            db.choice("people", new JSONObject());
            db.choice("similar", new JSONObject());
          }
          writeSettings(new JSONObject().put("state", "off"));
        }
      } else {
        if (!v.has("epoch")) throw new R2Exception("SEARCH_NOT_CONFIGURED");
        v.put("enabled", true)
            .put("state", "waiting")
            .put("error", "")
            .put("epoch", UUID.randomUUID().toString());
        WorkManager.getInstance(context).cancelAllWorkByTag(WORK);
        if (action.equals("scan") || v.optString("cursor").isEmpty())
          v.put("cursor", "")
              .put("since", 0)
              .put("scanStarted", System.currentTimeMillis())
              .put("scanned", 0)
              .put("failed", 0);
        writeSettings(v);
        enqueue(v);
        schedule(v);
        watch(v);
      }
    }
    // Cancel first, then acquire the model lock; a stopped download leaves no newly installed
    // model.
    if (action.equals("clear"))
      synchronized (GalleryClip.LOCK) {
        GalleryClip.remove(context);
        GalleryFaceModels.remove(context);
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

  boolean needsDownload(JSONObject v) {
    return (v.optBoolean("visual") && !GalleryClip.ready(context))
        || (v.optBoolean("people") && !GalleryFaceModels.ready(context));
  }

  void enqueue(JSONObject v) {
    OneTimeWorkRequest request =
        new OneTimeWorkRequest.Builder(GalleryIntelligenceWorker.class)
            .setInputData(new Data.Builder().putString("epoch", v.optString("epoch")).build())
            .addTag(WORK)
            .setConstraints(constraints(v, needsDownload(v)))
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build();
    WorkManager.getInstance(context)
        .enqueueUniqueWork(WORK, ExistingWorkPolicy.APPEND_OR_REPLACE, request);
  }

  void watch(JSONObject config) {
    if (!config.optBoolean("enabled")) return;
    Constraints c =
        new Constraints.Builder()
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)
            .setRequiresCharging(config.optBoolean("chargingOnly", true))
            .addContentUriTrigger(
                android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true)
            .addContentUriTrigger(
                android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, true)
            .setTriggerContentUpdateDelay(3, TimeUnit.SECONDS)
            .setTriggerContentMaxDelay(30, TimeUnit.SECONDS)
            .build();
    WorkManager.getInstance(context)
        .enqueueUniqueWork(
            "atlas-gallery-media-watch",
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            new OneTimeWorkRequest.Builder(GalleryWatchWorker.class)
                .addTag(WORK)
                .setConstraints(c)
                .build());
  }

  void mediaChanged() throws Exception {
    synchronized (STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(secure)) {
        db.invalidate();
      }
      JSONObject v = settings();
      if (!v.optBoolean("enabled")) {
        GalleryRecoveryWorker.photosChanged(context);
        return;
      }
      if (Set.of("ready", "error").contains(v.optString("state"))) {
        v.put("since", Math.max(0, v.optLong("lastScanStarted") - 2000))
            .put("scanStarted", System.currentTimeMillis())
            .put("cursor", "")
            .put("state", "waiting")
            .put("failed", 0)
            .put("scanned", 0)
            .put("mediaDirty", false);
        writeSettings(v);
        enqueue(v);
      } else {
        v.put("mediaDirty", true);
        writeSettings(v);
      }
    }
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
            .setConstraints(constraints(v, needsDownload(v)))
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
    return search(query, album, kind, offset, () -> false);
  }

  JSONObject search(
      String query,
      String album,
      String kind,
      int offset,
      java.util.function.BooleanSupplier cancelled)
      throws Exception {
    if (cancelled.getAsBoolean()) throw new R2Exception("SEARCH_CANCELLED");
    if (query == null
        || query.trim().isEmpty()
        || query.length() > 200
        || offset < 0
        || offset > 10000
        || album.length() > 200) throw new R2Exception("INVALID_SELECTION");
    if (offset == 10000)
      return new JSONObject()
          .put("items", new JSONArray())
          .put("cursor", "")
          .put("complete", true)
          .put("limitReached", true);
    JSONObject config = settings();
    Set<String> allowed = new HashSet<>();
    JSONArray approvedAlbums = config.optJSONArray("albums");
    if (approvedAlbums != null)
      for (int i = 0; i < approvedAlbums.length(); i++) allowed.add(approvedAlbums.getString(i));
    List<String> terms = terms(query);
    float[] vector = null;
    if (config.optBoolean("visual") && !kind.equals("video") && GalleryClip.ready(context))
      synchronized (GalleryClip.LOCK) {
        if (cancelled.getAsBoolean()) throw new R2Exception("SEARCH_CANCELLED");
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
        Cursor cursor = db.searchRows()) {
      while (cursor.moveToNext()) {
        if (cancelled.getAsBoolean()) throw new R2Exception("SEARCH_CANCELLED");
        JSONObject
            row = db.readSearch(cursor.getString(0), cursor.getBlob(1), cursor.getInt(2) == 1),
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
                    + (config.optBoolean("ocr") && hasCurrentOcr(row) ? row.optString("text") : ""),
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
      if (items.length() == 80 || i == 10000) break;
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
