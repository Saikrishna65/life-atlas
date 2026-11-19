package com.lifeatlas.app.r2;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Opaque lookup columns; names, object paths and original hashes are authenticated ciphertext. */
final class R2LibraryStore implements AutoCloseable {
  static final Object WRITE_LOCK = new Object();
  final R2Repository repo;
  final SQLiteDatabase db;

  R2LibraryStore(R2Repository repo) throws Exception {
    this.repo = repo;
    db = SQLiteDatabase.openOrCreateDatabase(new File(repo.store.directory(), "library.db"), null);
    db.execSQL(
        "CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,scope TEXT NOT NULL,slot TEXT NOT"
            + " NULL,state TEXT NOT NULL,changed INTEGER NOT NULL,clock INTEGER NOT NULL,revision"
            + " TEXT NOT NULL,source TEXT,fp TEXT,dirty INTEGER NOT NULL,payload BLOB NOT NULL)");
    db.execSQL("CREATE INDEX IF NOT EXISTS library_page ON media(scope,state,changed,id)");
    db.execSQL("CREATE INDEX IF NOT EXISTS library_source ON media(source,scope)");
    db.execSQL("CREATE INDEX IF NOT EXISTS library_fp ON media(fp,scope)");
    db.execSQL(
        "CREATE TABLE IF NOT EXISTS media_sources(source TEXT NOT NULL,scope TEXT NOT NULL,id TEXT"
            + " NOT NULL,PRIMARY KEY(source,scope))");
    db.execSQL(
        "CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY,uri TEXT,payload BLOB NOT NULL)");
  }

  static byte[] encode(JSONObject value, byte[] keys, String aad) throws Exception {
    byte[] plain = value.toString().getBytes(StandardCharsets.UTF_8);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try {
      R2Envelope.encrypt(
          new ByteArrayInputStream(plain),
          out,
          keys,
          aad,
          new JSONObject()
              .put("size", plain.length)
              .put("sha256", R2Policy.digest(plain))
              .put("name", "library-record.json")
              .put("mimeType", "application/vnd.life-atlas.library+json"));
      return out.toByteArray();
    } finally {
      Arrays.fill(plain, (byte) 0);
    }
  }

  static JSONObject decode(byte[] data, byte[] keys, String aad) throws Exception {
    if (data.length > 256 * 1024) throw new R2Exception("INVALID_LIBRARY_RECORD");
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    R2Envelope.decrypt(new ByteArrayInputStream(data), out, keys, aad);
    if (out.size() > 128 * 1024) throw new R2Exception("INVALID_LIBRARY_RECORD");
    return new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
  }

  static String token(byte[] keys, String value) throws Exception {
    javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
    mac.init(new javax.crypto.spec.SecretKeySpec(keys, "HmacSHA256"));
    return R2Policy.hex(
        mac.doFinal(("atlas-library-v1\n" + value).getBytes(StandardCharsets.UTF_8)));
  }

  static void validate(JSONObject value) throws Exception {
    if (!value.optString("id").matches("[a-f0-9]{64}")
        || !value.optString("scope").matches("[a-f0-9]{64}")
        || !Set.of("public", "private").contains(value.optString("slot"))
        || !Set.of("active", "trashed", "deleted", "conflict").contains(value.optString("state"))
        || value.optLong("clock") < 1
        || !value.optString("revision").matches("[a-f0-9-]{36}")
        || value.toString().getBytes(StandardCharsets.UTF_8).length > 128 * 1024)
      throw new R2Exception("INVALID_LIBRARY_RECORD");
    R2Policy.key(value.getString("key"));
    if (!value.optString("sha256").matches("[a-f0-9]{64}") || value.optLong("totalBytes") <= 0)
      throw new R2Exception("INVALID_LIBRARY_RECORD");
  }

  JSONObject get(String id) throws Exception {
    try (Cursor c =
        db.query("media", new String[] {"payload"}, "id=?", new String[] {id}, null, null, null)) {
      if (!c.moveToFirst()) throw new R2Exception("LIBRARY_ITEM_NOT_FOUND");
      byte[] plain = repo.store.unseal("library-local:" + id, c.getBlob(0));
      try {
        return new JSONObject(new String(plain, StandardCharsets.UTF_8));
      } finally {
        Arrays.fill(plain, (byte) 0);
      }
    }
  }

  void put(JSONObject record, boolean dirty) throws Exception {
    synchronized (WRITE_LOCK) {
      JSONObject previous = null;
      try {
        previous = get(record.getString("id"));
      } catch (R2Exception e) {
        if (!e.code.equals("LIBRARY_ITEM_NOT_FOUND")) throw e;
      }
      if (previous != null
          && (previous.getLong("clock") > record.getLong("clock")
              || (previous.getLong("clock") == record.getLong("clock")
                  && !previous.getString("revision").equals(record.getString("revision"))
                  && !(record.optBoolean("conflicted")
                      && rank(record.optString("state")) >= rank(previous.optString("state"))))))
        throw new R2Exception("CATALOG_CONFLICT");
      validate(record);
      ContentValues v = new ContentValues();
      String id = record.getString("id");
      v.put("id", id);
      for (String key : List.of("scope", "slot", "state", "revision"))
        v.put(key, record.getString(key));
      v.put("changed", record.optLong("changed"));
      v.put("clock", record.getLong("clock"));
      v.put("source", record.optString("sourceToken"));
      v.put("fp", record.optString("fingerprint"));
      v.put("dirty", dirty ? 1 : 0);
      byte[] plain = record.toString().getBytes(StandardCharsets.UTF_8);
      try {
        v.put("payload", repo.store.seal("library-local:" + id, plain));
      } finally {
        Arrays.fill(plain, (byte) 0);
      }
      db.insertWithOnConflict("media", null, v, SQLiteDatabase.CONFLICT_REPLACE);
      if (!record.optString("sourceToken").isEmpty()) {
        ContentValues alias = new ContentValues();
        alias.put("source", record.getString("sourceToken"));
        alias.put("scope", record.getString("scope"));
        alias.put("id", id);
        db.insertWithOnConflict("media_sources", null, alias, SQLiteDatabase.CONFLICT_REPLACE);
      }
    }
  }

  JSONArray page(String scope, String state, int offset, int limit) throws Exception {
    JSONArray rows = new JSONArray();
    try (Cursor c =
        db.query(
            "media",
            new String[] {"id"},
            "scope=? AND state=?",
            new String[] {scope, state},
            null,
            null,
            "changed DESC,id ASC",
            Math.max(0, offset) + "," + Math.min(100, Math.max(1, limit)))) {
      while (c.moveToNext()) rows.put(get(c.getString(0)));
    }
    return rows;
  }

  JSONArray dirty(int limit) throws Exception {
    JSONArray result = new JSONArray();
    try (Cursor c =
        db.rawQuery(
            "SELECT id FROM media WHERE dirty=1 ORDER BY changed ASC LIMIT ?",
            new String[] {String.valueOf(limit)})) {
      while (c.moveToNext()) result.put(get(c.getString(0)));
    }
    return result;
  }

  boolean knownSource(String source, String scope) throws Exception {
    try (Cursor c =
        db.rawQuery(
            "SELECT m.id FROM media m LEFT JOIN media_sources s ON s.id=m.id WHERE (m.source=? OR"
                + " s.source=?) AND m.scope=? AND m.state IN ('active','trashed','deleted') LIMIT"
                + " 1",
            new String[] {source, source, scope})) {
      return c.moveToFirst();
    }
  }

  JSONArray fingerprint(String fp, String scope) throws Exception {
    JSONArray result = new JSONArray();
    try (Cursor c =
        db.query(
            "media",
            new String[] {"id"},
            "fp=? AND scope=?",
            new String[] {fp, scope},
            null,
            null,
            null)) {
      while (c.moveToNext()) result.put(get(c.getString(0)));
    }
    return result;
  }

  synchronized boolean merge(JSONObject incoming) throws Exception {
    validate(incoming);
    JSONObject local;
    try {
      local = get(incoming.getString("id"));
    } catch (R2Exception e) {
      if (!e.code.equals("LIBRARY_ITEM_NOT_FOUND")) throw e;
      put(incoming, false);
      return true;
    }
    if (incoming.getLong("clock") < local.getLong("clock")) return false;
    if (incoming.getLong("clock") == local.getLong("clock")) {
      if (incoming.getString("revision").equals(local.getString("revision"))) return false;
      int a = rank(local.optString("state")), b = rank(incoming.optString("state"));
      if (a >= b) {
        local.put("conflicted", true);
        put(local, true);
        return false;
      }
      incoming.put("conflicted", true);
    }
    put(incoming, false);
    return true;
  }

  static int rank(String state) {
    return state.equals("deleted")
        ? 3
        : state.equals("trashed") ? 2 : state.equals("conflict") ? 1 : 0;
  }

  void synced(String id, String revision) {
    ContentValues value = new ContentValues();
    value.put("dirty", 0);
    db.update("media", value, "id=? AND revision=?", new String[] {id, revision});
  }

  JSONObject counts(String scope) throws Exception {
    JSONObject out = new JSONObject();
    try (Cursor c =
        db.rawQuery(
            "SELECT state,COUNT(*),SUM(CAST(length(payload) AS INTEGER)) FROM media WHERE scope=?"
                + " GROUP BY state",
            new String[] {scope})) {
      while (c.moveToNext()) out.put(c.getString(0), c.getLong(1));
    }
    return out;
  }

  void importPut(String id, String uri, JSONObject record) throws Exception {
    ContentValues value = new ContentValues();
    value.put("id", id);
    value.put("uri", uri);
    byte[] plain = record.toString().getBytes(StandardCharsets.UTF_8);
    try {
      value.put("payload", repo.store.seal("takeout:" + id, plain));
    } finally {
      Arrays.fill(plain, (byte) 0);
    }
    db.insertWithOnConflict("imports", null, value, SQLiteDatabase.CONFLICT_REPLACE);
  }

  JSONObject importGet(String id) throws Exception {
    try (Cursor c =
        db.query(
            "imports", new String[] {"payload"}, "id=?", new String[] {id}, null, null, null)) {
      if (!c.moveToFirst()) return null;
      byte[] plain = repo.store.unseal("takeout:" + id, c.getBlob(0));
      try {
        return new JSONObject(new String(plain, StandardCharsets.UTF_8));
      } finally {
        Arrays.fill(plain, (byte) 0);
      }
    }
  }

  int importedEntries(String id) {
    try (Cursor c =
        db.rawQuery(
            "SELECT COUNT(*) FROM imports WHERE id LIKE ?", new String[] {"entry:" + id + ":%"})) {
      c.moveToFirst();
      return c.getInt(0);
    }
  }

  JSONObject importSummary() throws Exception {
    JSONObject out = new JSONObject();
    try (Cursor c = db.rawQuery("SELECT COUNT(*) FROM imports WHERE id LIKE 'uri:%'", null)) {
      c.moveToFirst();
      out.put("files", c.getLong(0));
    }
    try (Cursor c =
        db.rawQuery(
            "SELECT COUNT(*) FROM imports s LEFT JOIN imports p ON p.id='path:'||substr(s.id,9)"
                + " WHERE s.id LIKE 'sidecar:%' AND p.id IS NULL",
            null)) {
      c.moveToFirst();
      out.put("unmatched", c.getLong(0));
    }
    return out;
  }

  JSONArray importRows(int offset) throws Exception {
    JSONArray out = new JSONArray();
    try (Cursor c =
        db.rawQuery(
            "SELECT id FROM imports ORDER BY id LIMIT 100 OFFSET ?",
            new String[] {String.valueOf(offset)})) {
      while (c.moveToNext()) out.put(importGet(c.getString(0)));
    }
    return out;
  }

  @Override
  public void close() {
    db.close();
  }
}
