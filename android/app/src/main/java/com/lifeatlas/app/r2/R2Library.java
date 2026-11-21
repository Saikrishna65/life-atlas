package com.lifeatlas.app.r2;

import android.content.Context;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

final class R2Library {
  static String prefix(byte[] keys) {
    return "encrypted/catalog/library/" + R2Crypto.keyId(keys) + "/";
  }

  static String recordKey(byte[] keys, JSONObject r) throws Exception {
    return prefix(keys)
        + r.getString("id")
        + "/"
        + r.getLong("clock")
        + "-"
        + r.getString("revision")
        + ".atlas";
  }

  static JSONObject safe(JSONObject r) throws Exception {
    JSONObject out = new JSONObject();
    for (String key :
        List.of(
            "id",
            "slot",
            "scope",
            "state",
            "name",
            "mimeType",
            "size",
            "totalBytes",
            "changed",
            "verifiedAt",
            "capturedAt",
            "trashAt",
            "expiresAt",
            "cleanupPending",
            "conflicted",
            "album",
            "takeout",
            "previewError",
            "hasThumbnail",
            "hasClip")) if (r.has(key)) out.put(key, r.get(key));
    out.put("kind", r.optString("mimeType").startsWith("video/") ? "video" : "photo");
    return out;
  }

  static JSONObject fromJob(R2Repository repo, JSONObject job) throws Exception {
    R2Credentials creds = repo.store.credentials(job.getString("slot"));
    String scope = R2Duplicates.scope(creds);
    String plain = job.optString("contentSha256", job.getString("sha256"));
    byte[] keys = repo.keyset();
    try {
      String fp = R2LibraryStore.token(keys, plain),
          id =
              R2Policy.digest(
                  (scope + "\n" + job.getString("slot") + "\n" + fp)
                      .getBytes(StandardCharsets.UTF_8));
      JSONObject r =
          new JSONObject()
              .put("metadataVersion", 1)
              .put("id", id)
              .put("scope", scope)
              .put("slot", job.getString("slot"))
              .put("fingerprint", fp)
              .put("state", "active")
              .put("clock", 1)
              .put("revision", UUID.randomUUID())
              .put("changed", System.currentTimeMillis())
              .put("verifiedAt", System.currentTimeMillis())
              .put("key", job.getString("key"))
              .put("name", job.getString("name"))
              .put("mimeType", job.getString("mimeType"))
              .put("size", job.optLong("size"))
              .put("totalBytes", job.getLong("totalBytes"))
              .put("sha256", job.getString("sha256"))
              .put("keyId", job.optString("keyId"))
              .put("contentSha256", plain)
              .put("direction", "upload")
              .put("status", "complete")
              .put("verified", true)
              .put("storageScope", scope);
      if (!job.optString("galleryId").isEmpty())
        r.put(
            "sourceToken",
            R2LibraryStore.token(
                keys, job.getString("galleryId") + "|" + job.optString("sourceStamp")));
      for (String k :
          List.of(
              "thumbnailKey",
              "thumbnailSha256",
              "clipKey",
              "clipSha256",
              "hasThumbnail",
              "hasClip",
              "album",
              "capturedAt",
              "takeout",
              "sourceStamp",
              "galleryId")) if (job.has(k)) r.put(k, job.get(k));
      r.put("hasThumbnail", !r.optString("thumbnailKey").isEmpty());
      return r;
    } finally {
      Arrays.fill(keys, (byte) 0);
    }
  }

  static void sync(R2Repository repo, R2LibraryStore store, JSONObject record) throws Exception {
    if (!repo.store.snapshot().optBoolean("recoveryVerified"))
      throw new R2Exception("RECOVERY_REQUIRED");
    byte[] keys = repo.keyset();
    try {
      sync(new R2Client(repo.store.credentials("private")), keys, record);
      store.synced(record.getString("id"), record.getString("revision"));
    } finally {
      Arrays.fill(keys, (byte) 0);
    }
  }

  static void sync(R2Transport client, byte[] keys, JSONObject record) throws Exception {
    R2LibraryStore.validate(record);
    JSONObject payload = new JSONObject(record.toString());
    for (String local : List.of("sourceToken", "galleryId", "sourceStamp", "conflicted"))
      payload.remove(local);
    String key = recordKey(keys, record);
    byte[] bytes = R2LibraryStore.encode(payload, keys, key);
    String sha = R2Policy.digest(bytes);
    // A retry can encounter the same immutable revision. Verify its authenticated contents.
    try {
      JSONObject head = client.head(key);
      try (R2Client.Response response =
          client.request("GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
        JSONObject existing = R2LibraryStore.decode(response.read(256 * 1024), keys, key);
        if (!existing.toString().equals(payload.toString()))
          throw new R2Exception("CATALOG_CONFLICT");
        return;
      }
    } catch (R2Exception e) {
      if (!e.code.equals("OBJECT_NOT_FOUND")) throw e;
    }
    try (R2Client.Response response =
        client.request(
            "PUT",
            key,
            Collections.emptyMap(),
            Map.of(
                "if-none-match",
                "*",
                "content-type",
                "application/octet-stream",
                "cache-control",
                "private, no-store",
                "x-amz-meta-sha256",
                sha),
            R2Client.bytes(bytes),
            null)) {}
    try (R2Client.Response response =
        client.request("GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
      byte[] verified = response.read(256 * 1024);
      if (!R2Policy.digest(verified).equals(sha)) throw new R2Exception("INTEGRITY_FAILED");
      R2LibraryStore.decode(verified, keys, key);
    }
  }

  static void commit(Context context, R2Repository repo, JSONObject job) throws Exception {
    // Public trip publishing must not depend on private credentials or private-index networking.
    if (!job.getString("slot").equals("private")) return;
    if (!repo.store.snapshot().optBoolean("recoveryVerified")) {
      if (job.getString("slot").equals("private")) throw new R2Exception("RECOVERY_REQUIRED");
      return;
    }
    try {
      repo.store.credentials("private");
    } catch (R2Exception e) {
      if (job.optString("slot").equals("public")) return;
      throw e;
    }
    JSONObject record = fromJob(repo, job);
    try (R2LibraryStore store = new R2LibraryStore(repo)) {
      try {
        JSONObject old = store.get(record.getString("id"));
        if (!old.getString("state").equals("active")) {
          if (old.optBoolean("cleanupPending")) throw new R2Exception("LIBRARY_DELETE_PENDING");
          if (old.getString("state").equals("trashed") || job.optBoolean("autoBackup"))
            throw new R2Exception("LIBRARY_ITEM_IN_TRASH");
          record.put("clock", old.getLong("clock") + 1).put("parent", old.getString("revision"));
          store.put(record, true);
          sync(repo, store, record);
          return;
        }
        old.put("sourceToken", record.optString("sourceToken"));
        store.put(old, true);
        sync(repo, store, old);
        return;
      } catch (R2Exception e) {
        if (!e.code.equals("LIBRARY_ITEM_NOT_FOUND")) throw e;
      }
      store.put(record, true);
      sync(repo, store, record);
      if (job.optBoolean("videoPreviews") && job.getString("mimeType").startsWith("video/"))
        R2VideoPreviewWorker.enqueue(context, record.getString("id"), job.getString("source"));
    }
  }

  static JSONArray duplicateCandidates(R2Repository repo, JSONObject job, R2Credentials creds)
      throws Exception {
    JSONArray out = new JSONArray();
    try {
      byte[] keys = repo.keyset();
      String fp;
      try {
        fp = R2LibraryStore.token(keys, job.optString("contentSha256", job.optString("sha256")));
      } finally {
        Arrays.fill(keys, (byte) 0);
      }
      try (R2LibraryStore store = new R2LibraryStore(repo)) {
        JSONArray found = store.fingerprint(fp, R2Duplicates.scope(creds));
        for (int i = 0; i < found.length(); i++) {
          JSONObject record = found.getJSONObject(i);
          if (record.optBoolean("cleanupPending")) throw new R2Exception("LIBRARY_DELETE_PENDING");
          if (record.optString("state").equals("trashed")
              || (!record.optString("state").equals("active") && job.optBoolean("autoBackup")))
            throw new R2Exception("LIBRARY_ITEM_IN_TRASH");
          if (record.optString("state").equals("active")) out.put(record);
        }
      }
    } catch (R2Exception e) {
      if (!Set.of("RECOVERY_REQUIRED", "NOT_CONFIGURED").contains(e.code)) throw e;
    }
    return out;
  }

  static JSONObject revise(JSONObject record, String state) throws Exception {
    JSONObject next = new JSONObject(record.toString());
    next.put("clock", record.getLong("clock") + 1)
        .put("parent", record.getString("revision"))
        .put("revision", UUID.randomUUID())
        .put("changed", System.currentTimeMillis())
        .put("state", state);
    return next;
  }

  static void trash(R2Repository repo, String id, int days) throws Exception {
    try (R2LibraryStore store = new R2LibraryStore(repo)) {
      JSONObject r = store.get(id);
      if (!r.getString("slot").equals("private")) throw new R2Exception("USE_CREATOR_STUDIO");
      checkScope(repo, r);
      if (!r.getString("state").equals("active")) throw new R2Exception("LIBRARY_ITEM_IN_TRASH");
      r =
          revise(r, "trashed")
              .put("trashAt", System.currentTimeMillis())
              .put(
                  "expiresAt",
                  System.currentTimeMillis() + Math.max(7, Math.min(90, days)) * 86400000L);
      store.put(r, true);
      sync(repo, store, r);
    }
  }

  static void restoreTrash(R2Repository repo, String id) throws Exception {
    try (R2LibraryStore store = new R2LibraryStore(repo)) {
      JSONObject r = store.get(id);
      if (!r.getString("state").equals("trashed")) throw new R2Exception("LIBRARY_ITEM_NOT_FOUND");
      R2Credentials creds = checkScope(repo, r);
      JSONObject head = new R2Client(creds).head(r.getString("key"));
      if (head.optLong("size") != r.getLong("totalBytes")
          || !head.optString("sha256").equals(r.getString("sha256")))
        throw new R2Exception("INTEGRITY_FAILED");
      r = revise(r, "active");
      r.remove("trashAt");
      r.remove("expiresAt");
      store.put(r, true);
      sync(repo, store, r);
    }
  }

  static R2Credentials checkScope(R2Repository repo, JSONObject r) throws Exception {
    R2Credentials creds = repo.store.credentials(r.getString("slot"));
    if (!R2Duplicates.scope(creds).equals(r.getString("scope")))
      throw new R2Exception("CREDENTIALS_CHANGED");
    return creds;
  }

  interface RecordSync {
    void write(JSONObject record) throws Exception;
  }

  static void purge(R2Repository repo, String id) throws Exception {
    try (R2LibraryStore store = new R2LibraryStore(repo)) {
      R2Client client = new R2Client(checkScope(repo, store.get(id)));
      purge(store, id, client, record -> sync(repo, store, record));
    }
  }

  static void purge(R2LibraryStore store, String id, R2Transport client, RecordSync index)
      throws Exception {
    JSONObject r = store.get(id);
    if (!Set.of("trashed", "deleted").contains(r.getString("state"))
        || !r.getString("slot").equals("private"))
      throw new R2Exception("LIBRARY_DELETE_NOT_ALLOWED");
    r = revise(r, "deleted").put("cleanupPending", true);
    store.put(r, true);
    index.write(r); // Tombstone must be durable BEFORE deleting the media.
    for (String field : List.of("key", "thumbnailKey", "clipKey")) {
      String key = r.optString(field);
      if (key.isEmpty()) continue;
      try {
        JSONObject head = client.head(key);
        String expected =
            r.optString(
                field.equals("key")
                    ? "sha256"
                    : field.equals("thumbnailKey") ? "thumbnailSha256" : "clipSha256");
        if (!expected.equals(head.optString("sha256"))) throw new R2Exception("INTEGRITY_FAILED");
        client.delete(key);
      } catch (R2Exception e) {
        if (!e.code.equals("OBJECT_NOT_FOUND")) throw e;
      }
    }
    r = revise(r, "deleted").put("cleanupPending", false);
    store.put(r, true);
    index.write(r);
  }
}
