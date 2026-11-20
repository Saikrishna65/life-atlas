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

  void put(JSONObject row) throws Exception {
    String key = token(row.getJSONObject("media").getString("id"));
    byte[] plain = row.toString().getBytes(StandardCharsets.UTF_8);
    ContentValues values = new ContentValues();
    values.put("token", key);
    try {
      values.put("payload", secure.seal("gallery-search-v1:" + key, plain));
    } finally {
      java.util.Arrays.fill(plain, (byte) 0);
    }
    db.insertWithOnConflict("photos", null, values, SQLiteDatabase.CONFLICT_REPLACE);
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
    db.delete("photos", null, null);
  }

  void remove(String id) throws Exception {
    db.delete("photos", "token=?", new String[] {token(id)});
  }

  public void close() {
    db.close();
  }
}
