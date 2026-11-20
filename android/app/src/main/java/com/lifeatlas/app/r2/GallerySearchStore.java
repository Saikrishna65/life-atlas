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
                .put("embedding", face.optJSONArray("embedding")));
      }
    if (thinFaces.length() > 0)
      summary.put("faces", thinFaces).put("faceVersion", row.optString("faceVersion"));
    JSONObject search =
        new JSONObject()
            .put("media", row.getJSONObject("media"))
            .put("stamp", row.optString("stamp"));
    for (String field : java.util.List.of("text", "ocrDone", "ocrVersion", "embedding", "model"))
      if (row.has(field)) search.put(field, row.get(field));
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
      db.setTransactionSuccessful();
    } finally {
      db.endTransaction();
    }
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

  JSONObject choice(String id) throws Exception {
    String key = token(id);
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

  void choice(String id, JSONObject data) throws Exception {
    String key = token(id);
    byte[] plain = data.toString().getBytes(StandardCharsets.UTF_8);
    ContentValues v = new ContentValues();
    v.put("token", key);
    try {
      v.put("payload", secure.seal("gallery-choices-v1:" + key, plain));
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
    if (db.insertWithOnConflict("choices", null, v, SQLiteDatabase.CONFLICT_REPLACE) < 0)
      throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
  }

  void forgetChoices(String id) throws Exception {
    db.delete("choices", "token=?", new String[] {token(id)});
  }

  void forgetAllChoices() {
    db.delete("choices", null, null);
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
      db.setTransactionSuccessful();
    } finally {
      db.endTransaction();
    }
  }

  public void close() {
    db.close();
  }
}
