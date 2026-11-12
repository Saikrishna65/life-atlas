package com.lifeatlas.app.r2;

import android.content.Context;
import java.io.File;
import java.util.*;
import org.json.*;

public final class R2Repository {
  final R2SecureStore store;

  public R2Repository(Context context) {
    store = new R2SecureStore(context);
  }

  public JSONObject job(String id) throws Exception {
    JSONObject jobs = store.snapshot().optJSONObject("transfers");
    JSONObject job = jobs == null ? null : jobs.optJSONObject(id);
    if (job == null) throw new R2Exception("TRANSFER_NOT_FOUND");
    return job;
  }

  public void job(JSONObject value) throws Exception {
    store.edit(
        state -> {
          JSONObject jobs = state.optJSONObject("transfers");
          if (jobs == null) {
            jobs = new JSONObject();
            state.put("transfers", jobs);
          }
          jobs.put(value.getString("id"), value);
        });
  }

  public void update(String id, R2SecureStore.Edit edit) throws Exception {
    store.edit(
        state -> {
          JSONObject value = state.getJSONObject("transfers").getJSONObject(id);
          edit.apply(value);
          value.put("updatedAt", System.currentTimeMillis());
        });
  }

  public void transition(String id, String next) throws Exception {
    update(
        id,
        value -> {
          if (Set.of("cancelled", "cancelling", "paused").contains(value.optString("status")))
            throw new R2Exception("TRANSFER_INTERRUPTED");
          value.put("status", next);
        });
  }

  public void cleanupCancelled(String id) throws Exception {
    JSONObject job = job(id);
    if (!job.optString("direction").equals("download")) {
      R2Client client = new R2Client(store.credentials(job.getString("slot")));
      String uploadId = job.optString("uploadId");
      if (!uploadId.isEmpty())
        try {
          client.abort(job.getString("key"), uploadId);
        } catch (R2Exception e) {
          if (!e.code.equals("OBJECT_NOT_FOUND")) throw e;
        }
      try {
        JSONObject head = client.head(job.getString("key"));
        if (!job.optString("sha256").isEmpty()
            && head.optString("sha256").equals(job.getString("sha256")))
          client.delete(job.getString("key"));
        else throw new R2Exception("OBJECT_KEY_CONFLICT");
      } catch (R2Exception e) {
        if (!e.code.equals("OBJECT_NOT_FOUND")) throw e;
      }
    }
    update(
        id,
        value -> {
          value.put("status", "cancelled");
          value.remove("uploadId");
          value.remove("error");
        });
    staging(id).delete();
  }

  public JSONArray jobs() throws Exception {
    JSONObject jobs = store.snapshot().optJSONObject("transfers");
    JSONArray values = new JSONArray();
    if (jobs != null) {
      Iterator<String> keys = jobs.keys();
      while (keys.hasNext()) values.put(jobs.getJSONObject(keys.next()));
    }
    return values;
  }

  public boolean unfinished(String slot) throws Exception {
    JSONArray jobs = jobs();
    for (int i = 0; i < jobs.length(); i++) {
      JSONObject job = jobs.getJSONObject(i);
      if (slot.equals(job.getString("slot"))
          && !Set.of("complete", "cancelled").contains(job.optString("status"))) return true;
    }
    return false;
  }

  public byte[] keyset() throws Exception {
    String key = store.snapshot().optString("keyset");
    if (key.isEmpty()) throw new R2Exception("RECOVERY_REQUIRED");
    return Base64.getDecoder().decode(key);
  }

  public File staging(String id) {
    if (!id.matches("[a-f0-9-]{36}")) throw new IllegalArgumentException("INVALID_TRANSFER_ID");
    return new File(store.directory(), id + ".stage");
  }

  public Map<String, String> metadata(JSONObject job) throws Exception {
    Map<String, String> headers = new LinkedHashMap<>();
    boolean encrypted = job.getString("slot").equals("private");
    headers.put(
        "Content-Type",
        encrypted
            ? "application/octet-stream"
            : job.optString("mimeType", "application/octet-stream"));
    headers.put("x-amz-meta-sha256", job.getString("sha256"));
    headers.put(
        "Cache-Control", encrypted ? "private, no-store" : "public, max-age=31536000, immutable");
    if (encrypted) {
      headers.put("x-amz-meta-encryption", "tink-aes256-gcm-hkdf-1mb-v1");
      headers.put("x-amz-meta-key-id", job.getString("keyId"));
    } else {
      headers.put(
          "x-amz-meta-name",
          Base64.getEncoder()
              .encodeToString(
                  job.getString("name").getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }
    return headers;
  }

  public JSONObject safeJob(JSONObject job) throws Exception {
    JSONObject out = new JSONObject();
    for (String key :
        new String[] {
          "id",
          "slot",
          "key",
          "name",
          "mimeType",
          "size",
          "totalBytes",
          "uploadedBytes",
          "status",
          "error",
          "createdAt",
          "updatedAt",
          "speed",
          "eta",
          "publicUrl",
          "thumbnailUrl",
          "verified",
          "direction"
        }) if (job.has(key)) out.put(key, job.get(key));
    return out;
  }

  public void checkCredentialRevision(JSONObject job) throws Exception {
    R2Credentials current = store.credentials(job.getString("slot"));
    if (!current.revision.equals(job.getString("revision")))
      throw new R2Exception("CREDENTIALS_CHANGED");
  }
}
