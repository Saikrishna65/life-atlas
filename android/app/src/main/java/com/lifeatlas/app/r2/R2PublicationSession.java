package com.lifeatlas.app.r2;

import java.util.*;

/**
 * No timer or Activity lifecycle expiry. This grant is limited to one reviewed public trip batch.
 */
final class R2PublicationSession {
  private String token = "", scope = "", collection = "";
  private final Set<String> selections = new HashSet<>(), transfers = new HashSet<>();

  private String scope(R2Credentials c) {
    return c.endpoint + "/" + c.bucket + "/" + c.revision;
  }

  synchronized String begin(R2Credentials c, String trip, Set<String> files, Set<String> jobs)
      throws Exception {
    if (trip == null
        || trip.trim().isEmpty()
        || trip.length() > 140
        || files.size() + jobs.size() > 500) throw new R2Exception("INVALID_SELECTION");
    clear();
    token = UUID.randomUUID().toString();
    scope = scope(c);
    collection = trip;
    selections.addAll(files);
    transfers.addAll(jobs);
    return token;
  }

  private void require(String supplied, R2Credentials c) throws Exception {
    if (token.isEmpty() || !token.equals(supplied) || !scope.equals(scope(c)))
      throw new R2Exception("PUBLICATION_SESSION_REQUIRED");
  }

  synchronized void selection(String supplied, R2Credentials c, String slot, String id)
      throws Exception {
    require(supplied, c);
    if (!"public".equals(slot) || !selections.contains(id))
      throw new R2Exception("PUBLICATION_SCOPE_MISMATCH");
  }

  synchronized void addTransfer(String supplied, R2Credentials c, String selection, String id)
      throws Exception {
    selection(supplied, c, "public", selection);
    transfers.add(id);
  }

  synchronized void transfer(String supplied, R2Credentials c, org.json.JSONObject job, String trip)
      throws Exception {
    require(supplied, c);
    if (!transfers.contains(job.getString("id"))
        || !"public".equals(job.optString("slot"))
        || !"upload".equals(job.optString("direction"))
        || !c.revision.equals(job.optString("revision"))
        || (trip != null && !collection.equals(trip)))
      throw new R2Exception("PUBLICATION_SCOPE_MISMATCH");
  }

  synchronized void end(String supplied) {
    if (token.equals(supplied)) clear();
  }

  synchronized void clear() {
    token = scope = collection = "";
    selections.clear();
    transfers.clear();
  }
}
