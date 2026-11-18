package com.lifeatlas.app.r2;

import java.util.*;
import java.util.function.LongSupplier;

/** In-memory consent for one reviewed public trip batch, never a general storage unlock. */
final class R2PublicationSession {
  private final LongSupplier clock;
  private String token = "", scope = "", collection = "";
  private long created, touched, backgroundedAt = -1;
  private final Set<String> selections = new HashSet<>(), transfers = new HashSet<>();

  R2PublicationSession(LongSupplier clock) {
    this.clock = clock;
  }

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
    created = touched = clock.getAsLong();
    return token;
  }

  private void require(String supplied, R2Credentials c) throws Exception {
    long now = clock.getAsLong();
    if (backgroundedAt >= 0
        || token.isEmpty()
        || !token.equals(supplied)
        || !scope.equals(scope(c))
        || now - created >= 2 * 60 * 60 * 1000L
        || now - touched >= 30 * 60 * 1000L) throw new R2Exception("PUBLICATION_SESSION_EXPIRED");
  }

  synchronized void selection(String supplied, R2Credentials c, String slot, String id)
      throws Exception {
    require(supplied, c);
    if (!"public".equals(slot) || !selections.contains(id))
      throw new R2Exception("PUBLICATION_SCOPE_MISMATCH");
    touched = clock.getAsLong();
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
    touched = clock.getAsLong();
  }

  /** No new trip operation is authorized while the Activity is stopped. */
  synchronized void background(boolean locked) {
    if (locked) {
      clear();
      return;
    }
    if (backgroundedAt < 0) backgroundedAt = clock.getAsLong();
  }

  /** A brief unlocked interruption may retain only this enumerated public batch. */
  synchronized void foreground(boolean locked) {
    if (locked || (backgroundedAt >= 0 && clock.getAsLong() - backgroundedAt >= 60_000L)) clear();
    backgroundedAt = -1;
  }

  synchronized void end(String supplied) {
    if (token.equals(supplied)) clear();
  }

  synchronized void clear() {
    token = scope = collection = "";
    backgroundedAt = -1;
    selections.clear();
    transfers.clear();
  }
}
