package com.lifeatlas.app.r2;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** Content deduplication against this installation's encrypted, verified upload history. */
final class R2Duplicates {
  interface Control {
    void check() throws Exception;
  }

  static String scope(R2Credentials credentials) {
    return R2Policy.digest(
        (credentials.endpoint + "\n" + credentials.bucket).getBytes(StandardCharsets.UTF_8));
  }

  static boolean matches(JSONObject current, JSONObject previous, R2Credentials credentials) {
    String slot = current.optString("slot");
    if (current.optString("id").equals(previous.optString("id"))
        || !slot.equals(previous.optString("slot"))
        || !current.optString("mimeType").equals(previous.optString("mimeType"))
        || !"upload".equals(previous.optString("direction"))
        || !"complete".equals(previous.optString("status"))
        || !previous.optBoolean("verified")
        || current.optBoolean("stripMetadata") != previous.optBoolean("stripMetadata"))
      return false;
    // Older public transfers already recorded their verified content hash. Never guess
    // the bucket of a legacy record after credentials have changed.
    if (previous.has("storageScope")) {
      if (!scope(credentials).equals(previous.optString("storageScope"))) return false;
    } else if (!credentials.revision.equals(previous.optString("revision"))) return false;
    String hash =
        current.optString(
            "contentSha256", slot.equals("public") ? current.optString("sha256") : "");
    String prior =
        previous.optString(
            "contentSha256", slot.equals("public") ? previous.optString("sha256") : "");
    return hash.matches("[a-f0-9]{64}")
        && hash.equals(prior)
        && previous.optString("sha256").matches("[a-f0-9]{64}")
        && previous.optLong("totalBytes", -1) > 0
        && (!slot.equals("private")
            || (!current.optString("keyId").isEmpty()
                && current.optString("keyId").equals(previous.optString("keyId"))));
  }

  /** No PUT/DELETE, no new object key, and no alias binding until the existing bytes verify. */
  static boolean reuse(
      R2Repository repository,
      JSONObject job,
      R2Credentials credentials,
      R2Transport client,
      Control control)
      throws Exception {
    if (!job.optString("direction").equals("upload")
        || job.has("uploadId")
        || job.optLong("uploadedBytes") > 0) return false;
    JSONArray jobs = repository.jobs();
    JSONArray indexed = R2Library.duplicateCandidates(repository, job, credentials);
    for (int i = 0; i < indexed.length(); i++) jobs.put(indexed.getJSONObject(i));
    List<JSONObject> candidates = new ArrayList<>();
    for (int i = 0; i < jobs.length(); i++)
      if (matches(job, jobs.getJSONObject(i), credentials)) candidates.add(jobs.getJSONObject(i));
    candidates.sort(
        Comparator.<JSONObject>comparingInt(
                value ->
                    job.optString("tripCollection").equals(value.optString("tripCollection"))
                        ? 0
                        : 1)
            .thenComparingLong(value -> value.optLong("createdAt")));
    for (JSONObject existing : candidates) {
      control.check();
      String key = R2Policy.key(existing.getString("key"));
      JSONObject head;
      try {
        head = client.head(key);
      } catch (R2Exception error) {
        if (error.code.equals("OBJECT_NOT_FOUND")) continue;
        throw error;
      }
      long size = existing.getLong("totalBytes");
      if (head.optLong("size", -1) != size
          || !existing.getString("sha256").equals(head.optString("sha256"))) continue;
      repository.transition(job.getString("id"), "verifying");
      repository.update(
          job.getString("id"),
          value ->
              value
                  .put("duplicateCheck", true)
                  .put("verifiedBytes", 0)
                  .put("verificationTotalBytes", size));
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      long received = 0, last = 0;
      try (R2Client.Response response =
          client.request(
              "GET",
              key,
              Collections.emptyMap(),
              Map.of("Cache-Control", "no-cache, no-store", "Accept-Encoding", "identity"),
              null,
              null)) {
        byte[] buffer = new byte[65536];
        int count;
        while ((count = response.input.read(buffer)) != -1) {
          control.check();
          digest.update(buffer, 0, count);
          received += count;
          if (received > size) throw new R2Exception("INTEGRITY_FAILED");
          long now = System.currentTimeMillis();
          if (now - last >= 1000 || received == size) {
            last = now;
            final long checked = received;
            repository.update(job.getString("id"), value -> value.put("verifiedBytes", checked));
          }
        }
      }
      if (received != size || !existing.getString("sha256").equals(R2Policy.hex(digest.digest())))
        throw new R2Exception("INTEGRITY_FAILED");
      control.check();
      repository.checkCredentialRevision(job);
      repository.update(
          job.getString("id"),
          value -> {
            if (Set.of("paused", "cancelled", "cancelling").contains(value.optString("status")))
              throw new R2Exception("TRANSFER_INTERRUPTED");
            for (String field :
                new String[] {"key", "sha256", "totalBytes", "keyId", "thumbnailKey"}) {
              value.remove(field);
              if (existing.has(field)) value.put(field, existing.get(field));
            }
            value
                .put(
                    "mediaId",
                    job.optString("tripCollection").equals(existing.optString("tripCollection"))
                        ? existing.optString("mediaId", existing.getString("id"))
                        : job.getString("id"))
                .put("reused", true)
                .put("verified", true)
                .put("status", "complete")
                .put("storageScope", scope(credentials))
                .put("uploadedBytes", 0)
                .put("speed", 0)
                .put("eta", 0)
                .put(
                    "publicUrl",
                    job.getString("slot").equals("public") && !credentials.base.isEmpty()
                        ? credentials.base + "/" + R2Policy.path(key)
                        : "");
            value.remove("thumbnailUrl");
            if (value.has("thumbnailKey")
                && !credentials.base.isEmpty()
                && job.getString("slot").equals("public"))
              value.put(
                  "thumbnailUrl",
                  credentials.base + "/" + R2Policy.path(value.getString("thumbnailKey")));
            value.remove("duplicateCheck");
            value.remove("error");
          });
      return true;
    }
    return false;
  }
}
