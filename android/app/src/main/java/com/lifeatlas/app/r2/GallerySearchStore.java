package com.lifeatlas.app.r2;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.*;

/** Rebuildable search data. OCR, file details and vectors are encrypted before SQLite sees them. */
final class GallerySearchStore implements AutoCloseable {
  private final R2SecureStore secure;
  private final SQLiteDatabase db;

  GallerySearchStore(R2SecureStore secure) {
    this.secure = secure;
    db =
        SQLiteDatabase.openOrCreateDatabase(
            new File(secure.directory(), "gallery-search.db"), null);
    db.execSQL("CREATE TABLE IF NOT EXISTS photos (token TEXT PRIMARY KEY, payload BLOB NOT NULL)");
    db.execSQL(
        "CREATE TABLE IF NOT EXISTS summaries (token TEXT PRIMARY KEY, payload BLOB NOT NULL)");
    db.execSQL(
        "CREATE TABLE IF NOT EXISTS choices (token TEXT PRIMARY KEY, payload BLOB NOT NULL)");
    db.execSQL(
        "CREATE TABLE IF NOT EXISTS search_entries (token TEXT PRIMARY KEY, payload BLOB NOT"
            + " NULL)");
    db.execSQL(
        "CREATE TABLE IF NOT EXISTS collection_cache (kind TEXT NOT NULL, token TEXT NOT NULL,"
            + " payload BLOB NOT NULL, PRIMARY KEY(kind,token))");
    db.execSQL(
        "CREATE TABLE IF NOT EXISTS collection_meta (id INTEGER PRIMARY KEY, revision INTEGER NOT"
            + " NULL)");
    db.execSQL("INSERT OR IGNORE INTO collection_meta VALUES (1,0)");
    // This PRAGMA returns a row, so Android requires the query API even when setting it.
    try (Cursor setting = db.rawQuery("PRAGMA secure_delete=ON", null)) {
      if (!setting.moveToFirst() || setting.getInt(0) != 1)
        throw new IllegalStateException("LOCAL_STORAGE_UNAVAILABLE");
    }
  }

  static String token(String id) throws Exception {
    return R2Policy.hex(
        MessageDigest.getInstance("SHA-256").digest(id.getBytes(StandardCharsets.UTF_8)));
  }

  JSONObject get(String id) throws Exception {
    String key = token(id);
    try (Cursor c = db.rawQuery("SELECT payload FROM photos WHERE token=?", new String[] {key})) {
      return c.moveToFirst() ? read(key, c.getBlob(0)) : null;
    }
  }

  JSONObject read(String key, byte[] value) throws Exception {
    byte[] plain = secure.unseal("gallery-search-v1:" + key, value);
    try {
      return new JSONObject(new String(plain, StandardCharsets.UTF_8));
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
  }

  private ContentValues sealed(String key, String domain, JSONObject data) throws Exception {
    byte[] plain = data.toString().getBytes(StandardCharsets.UTF_8);
    ContentValues values = new ContentValues();
    values.put("token", key);
    try {
      values.put("payload", secure.seal(domain + key, plain));
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
    return values;
  }

  void put(JSONObject row) throws Exception {
    String key = token(row.getJSONObject("media").getString("id"));
    JSONObject summary =
        new JSONObject()
            .put("media", row.getJSONObject("media"))
            .put("stamp", row.optString("stamp"));
    if (row.has("quality")) summary.put("quality", row.get("quality"));
    JSONArray faces = row.optJSONArray("faces"), thinFaces = new JSONArray();
    if (faces != null)
      for (int i = 0; i < faces.length(); i++) {
        JSONObject face = faces.getJSONObject(i);
        thinFaces.put(
            new JSONObject()
                .put("id", face.optString("id"))
                .put("embedding", face.optJSONArray("embedding"))
                .put("quality", face.optDouble("quality", 1)));
      }
    if (thinFaces.length() > 0)
      summary.put("faces", thinFaces).put("faceVersion", row.optString("faceVersion"));
    JSONObject search =
        new JSONObject()
            .put("media", row.getJSONObject("media"))
            .put("stamp", row.optString("stamp"));
    for (String field :
        java.util.List.of(
            "text",
            "ocrDone",
            "ocrVersion",
            "embedding",
            "model",
            "visualDone",
            "faceVersion",
            "faceQualityVersion")) if (row.has(field)) search.put(field, row.get(field));
    search.put("completionVersion", 1);
    if (row.optJSONObject("quality") != null)
      search.put(
          "quality",
          new JSONObject().put("version", row.getJSONObject("quality").optString("version")));
    ContentValues searchValues = sealed(key, "gallery-search-entry-v1:", search);
    ContentValues full = sealed(key, "gallery-search-v1:", row),
        thin = sealed(key, "gallery-summary-v1:", summary);
    db.beginTransaction();
    try {
      if (db.insertWithOnConflict("photos", null, full, SQLiteDatabase.CONFLICT_REPLACE) < 0)
        throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
      if (summary.has("quality") || summary.has("faces")) {
        if (db.insertWithOnConflict("summaries", null, thin, SQLiteDatabase.CONFLICT_REPLACE) < 0)
          throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
      } else db.delete("summaries", "token=?", new String[] {key});
      if (db.insertWithOnConflict(
              "search_entries", null, searchValues, SQLiteDatabase.CONFLICT_REPLACE)
          < 0) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
      invalidate();
      db.setTransactionSuccessful();
    } finally {
      db.endTransaction();
    }
  }

  JSONObject readiness(String id) throws Exception {
    String key = token(id);
    try (Cursor cursor =
        db.rawQuery("SELECT payload FROM search_entries WHERE token=?", new String[] {key})) {
      if (cursor.moveToFirst()) {
        JSONObject row = readSearch(key, cursor.getBlob(0), false);
        if (row.optInt("completionVersion") == 1) return row;
      }
    }
    return get(id); // Older installations remain compatible until their next index write.
  }

  Cursor searchRows() {
    // Existing OCR-only installations keep working without a blocking re-index on app update.
    return db.rawQuery(
        "SELECT token,payload,0 AS legacy FROM search_entries UNION ALL SELECT token,payload,1 AS"
            + " legacy FROM photos WHERE token NOT IN (SELECT token FROM search_entries) ORDER BY"
            + " token",
        null);
  }

  JSONObject readSearch(String key, byte[] payload, boolean legacy) throws Exception {
    if (legacy) return read(key, payload);
    byte[] plain = secure.unseal("gallery-search-entry-v1:" + key, payload);
    try {
      return new JSONObject(new String(plain, StandardCharsets.UTF_8));
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
  }

  GallerySearchHotCache.Entry hotSearch(String key, byte[] payload, boolean legacy)
      throws Exception {
    return GallerySearchHotCache.get(
        secure.directory().getAbsolutePath(),
        key,
        payload,
        legacy,
        () -> readSearch(key, payload, legacy));
  }

  Cursor summaryRows() {
    return db.rawQuery("SELECT token,payload FROM summaries ORDER BY token", null);
  }

  JSONObject readSummary(String key, byte[] payload) throws Exception {
    byte[] plain = secure.unseal("gallery-summary-v1:" + key, payload);
    try {
      return new JSONObject(new String(plain, StandardCharsets.UTF_8));
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
  }

  JSONObject byToken(String key) throws Exception {
    if (!key.matches("[0-9a-f]{64}")) throw new R2Exception("INVALID_SELECTION");
    try (Cursor c = db.rawQuery("SELECT payload FROM photos WHERE token=?", new String[] {key})) {
      return c.moveToFirst() ? read(key, c.getBlob(0)) : null;
    }
  }

  // SQLite CursorWindow cannot hold multi-megabyte recovery records. Keep large notes as
  // immutable ciphertext files, with a tiny authenticated pointer committed last in SQLite.
  private File noteFile(String key, String version) throws Exception {
    if (!version.matches("[a-f0-9-]{36}")) throw new R2Exception("INVALID_GALLERY_RECOVERY");
    File directory = new File(secure.directory(), "gallery-notes");
    if (!directory.isDirectory() && !directory.mkdirs())
      throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
    return new File(directory, key + "-" + version);
  }

  private JSONObject storedChoice(String key) throws Exception {
    try (Cursor c = db.rawQuery("SELECT payload FROM choices WHERE token=?", new String[] {key})) {
      if (!c.moveToFirst()) return new JSONObject();
      byte[] plain = secure.unseal("gallery-choices-v1:" + key, c.getBlob(0));
      try {
        return new JSONObject(new String(plain, StandardCharsets.UTF_8));
      } finally {
        java.util.Arrays.fill(plain, (byte) 0);
      }
    }
  }

  JSONObject choice(String id) throws Exception {
    String key = token(id);
    JSONObject value = storedChoice(key);
    String version = value.optString("_atlasEncryptedNote");
    if (version.isEmpty()) return value;
    File file = noteFile(key, version);
    if (file.length() > 32L * 1024 * 1024 + 4096) throw new IOException("INVALID_GALLERY_RECOVERY");
    byte[] plain =
        secure.unseal(
            "gallery-large-choice-v1:" + key + ":" + version,
            java.nio.file.Files.readAllBytes(file.toPath()));
    try {
      return new JSONObject(new String(plain, StandardCharsets.UTF_8));
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
  }

  void choice(String id, JSONObject data) throws Exception {
    String key = token(id), previous = storedChoice(key).optString("_atlasEncryptedNote");
    byte[] plain = data.toString().getBytes(StandardCharsets.UTF_8);
    File pending = null;
    ContentValues v = new ContentValues();
    v.put("token", key);
    try {
      if (plain.length > 32 * 1024 * 1024) throw new IOException("INVALID_GALLERY_RECOVERY");
      if (plain.length > 512 * 1024) {
        String version = java.util.UUID.randomUUID().toString();
        pending = noteFile(key, version);
        byte[] encrypted = secure.seal("gallery-large-choice-v1:" + key + ":" + version, plain);
        try (FileOutputStream out = new FileOutputStream(pending)) {
          out.write(encrypted);
          out.getFD().sync();
        }
        byte[] pointer =
            new JSONObject()
                .put("_atlasEncryptedNote", version)
                .toString()
                .getBytes(StandardCharsets.UTF_8);
        v.put("payload", secure.seal("gallery-choices-v1:" + key, pointer));
      } else v.put("payload", secure.seal("gallery-choices-v1:" + key, plain));
      if (db.insertWithOnConflict("choices", null, v, SQLiteDatabase.CONFLICT_REPLACE) < 0)
        throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
    } catch (Exception e) {
      if (pending != null) pending.delete();
      throw e;
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
    if (!previous.isEmpty()) noteFile(key, previous).delete();
    if (java.util.Set.of(
                "people",
                "similar",
                "memories",
                "media-preferences",
                "albums",
                "search-feedback",
                "edits")
            .contains(id)
        || id.startsWith("album:")) invalidate();
  }

  JSONObject cache(String kind, String key) throws Exception {
    String token = token(key);
    try (Cursor c =
        db.rawQuery(
            "SELECT payload FROM collection_cache WHERE kind=? AND token=?",
            new String[] {kind, token})) {
      if (!c.moveToFirst()) return new JSONObject();
      byte[] plain = secure.unseal("gallery-cache-v1:" + kind + ":" + token, c.getBlob(0));
      try {
        return new JSONObject(new String(plain, StandardCharsets.UTF_8));
      } finally {
        java.util.Arrays.fill(plain, (byte) 0);
      }
    }
  }

  void cachePut(String kind, String key, JSONObject value) throws Exception {
    String token = token(key);
    ContentValues values = sealed(token, "gallery-cache-v1:" + kind + ":", value);
    values.put("kind", kind);
    if (db.insertWithOnConflict("collection_cache", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        < 0) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
  }

  void boundCache(String kind, int count) {
    db.execSQL(
        "DELETE FROM collection_cache WHERE kind=? AND rowid NOT IN (SELECT rowid FROM"
            + " collection_cache WHERE kind=? ORDER BY rowid DESC LIMIT ?)",
        new Object[] {kind, kind, count});
  }

  void clearCollections(String kind) {
    db.delete("collection_cache", "kind=?", new String[] {kind});
  }

  void saveCollections(String kind, JSONObject snapshot) throws Exception {
    db.beginTransaction();
    try {
      clearCollections(kind);
      JSONArray cards = snapshot.getJSONArray("collections");
      JSONObject groups = snapshot.getJSONObject("groups");
      for (int start = 0; start < Math.max(1, cards.length()); start += 40) {
        JSONArray page = new JSONArray();
        for (int i = start; i < Math.min(start + 40, cards.length()); i++) page.put(cards.get(i));
        cachePut(
            kind,
            "page:" + start,
            new JSONObject()
                .put("collections", page)
                .put("cursor", start + 40 < cards.length() ? Integer.toString(start + 40) : "")
                .put("complete", start + 40 >= cards.length()));
      }
      boolean namesSaved = false;
      java.util.Iterator<String> keys = groups.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        JSONObject group = groups.getJSONObject(key);
        JSONArray ids = group.getJSONArray("ids"), faces = group.optJSONArray("faces");
        for (int start = 0; start < Math.max(1, ids.length()); start += 80) {
          JSONArray page = new JSONArray();
          for (int i = start; i < Math.min(start + 80, ids.length()); i++) page.put(ids.get(i));
          cachePut(
              kind,
              "media:" + key + ":" + start,
              new JSONObject()
                  .put("ids", page)
                  .put("bestId", group.optString("bestId"))
                  .put("pickedId", group.optString("pickedId"))
                  .put("bestReason", group.optString("bestReason"))
                  .put("relationship", group.optString("relationship"))
                  .put("cursor", start + 80 < ids.length() ? Integer.toString(start + 80) : "")
                  .put("complete", start + 80 >= ids.length()));
        }
        if (faces != null && !namesSaved) {
          cachePut(kind, "names", new JSONObject().put("people", group.getJSONArray("people")));
          namesSaved = true;
        }
        if (faces != null)
          for (int start = 0; start < Math.max(1, faces.length()); start += 80) {
            JSONArray page = new JSONArray();
            for (int i = start; i < Math.min(start + 80, faces.length()); i++)
              page.put(faces.get(i));
            cachePut(
                kind,
                "faces:" + key + ":" + start,
                new JSONObject()
                    .put("faces", page)
                    .put("cursor", start + 80 < faces.length() ? Integer.toString(start + 80) : "")
                    .put("complete", start + 80 >= faces.length()));
          }
      }
      cachePut(
          kind,
          "matches",
          new JSONObject()
              .put(
                  "matches",
                  snapshot.optJSONArray("matches") == null
                      ? new JSONArray()
                      : snapshot.getJSONArray("matches")));
      JSONObject info = new JSONObject();
      for (String field : java.util.List.of("revision", "scope", "partial", "needsAnalysis"))
        info.put(field, snapshot.get(field));
      cachePut(kind, "info", info);
      db.setTransactionSuccessful();
    } finally {
      db.endTransaction();
    }
  }

  long revision() {
    try (Cursor c = db.rawQuery("SELECT revision FROM collection_meta WHERE id=1", null)) {
      c.moveToFirst();
      return c.getLong(0);
    }
  }

  void invalidate() {
    db.execSQL("UPDATE collection_meta SET revision=revision+1 WHERE id=1");
  }

  void forgetChoices(String id) throws Exception {
    String key = token(id), previous = storedChoice(key).optString("_atlasEncryptedNote");
    db.delete("choices", "token=?", new String[] {key});
    if (!previous.isEmpty()) noteFile(key, previous).delete();
  }

  void forgetAllChoices() {
    db.delete("choices", null, null);
    File[] files = new File(secure.directory(), "gallery-notes").listFiles();
    if (files != null) for (File file : files) file.delete();
  }

  Cursor rows() {
    return db.rawQuery("SELECT token,payload FROM photos ORDER BY token", null);
  }

  int count() {
    try (Cursor c = db.rawQuery("SELECT COUNT(*) FROM photos", null)) {
      c.moveToFirst();
      return c.getInt(0);
    }
  }

  void clear() {
    db.beginTransaction();
    try {
      db.delete("photos", null, null);
      db.delete("summaries", null, null);
      db.delete("search_entries", null, null);
      db.delete("collection_cache", null, null);
      invalidate();
      db.setTransactionSuccessful();
    } finally {
      db.endTransaction();
    }
  }

  void remove(String id) throws Exception {
    String key = token(id);
    db.beginTransaction();
    try {
      db.delete("photos", "token=?", new String[] {key});
      db.delete("summaries", "token=?", new String[] {key});
      db.delete("search_entries", "token=?", new String[] {key});
      invalidate();
      db.setTransactionSuccessful();
    } finally {
      db.endTransaction();
    }
  }

  public void close() {
    db.close();
  }
}
