package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2PublicationSessionTest {
  interface Check {
    void run() throws Exception;
  }

  private void rejects(String code, Check check) throws Exception {
    try {
      check.run();
      fail("Expected " + code);
    } catch (R2Exception error) {
      assertEquals(code, error.code);
    }
  }

  private JSONObject job(String id) throws Exception {
    return R2CatalogTest.job(id).put("revision", "test");
  }

  @Test
  public void oneConsentCoversOnlyReviewedFilesAndTheirNewOrSavedTransfers() throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    R2PublicationSession session = new R2PublicationSession(() -> 0L);
    String token = session.begin(c, "my-trip", Set.of("photo-a", "video-b"), Set.of("saved"));
    session.selection(token, c, "public", "photo-a");
    session.addTransfer(token, c, "photo-a", "uploaded-a");
    session.transfer(token, c, job("uploaded-a"), "my-trip");
    session.transfer(token, c, job("saved"), "my-trip");
    session.selection(token, c, "public", "video-b");
    rejects("PUBLICATION_SCOPE_MISMATCH", () -> session.selection(token, c, "private", "photo-a"));
    rejects(
        "PUBLICATION_SCOPE_MISMATCH", () -> session.selection(token, c, "public", "unreviewed"));
    rejects(
        "PUBLICATION_SCOPE_MISMATCH",
        () -> session.transfer(token, c, job("unreviewed"), "my-trip"));
    rejects(
        "PUBLICATION_SCOPE_MISMATCH", () -> session.transfer(token, c, job("saved"), "other-trip"));
    rejects(
        "PUBLICATION_SCOPE_MISMATCH",
        () -> session.transfer(token, c, job("saved").put("slot", "private"), "my-trip"));
    rejects(
        "PUBLICATION_SCOPE_MISMATCH",
        () -> session.transfer(token, c, job("saved").put("direction", "download"), "my-trip"));
    rejects(
        "PUBLICATION_SCOPE_MISMATCH",
        () -> session.transfer(token, c, job("saved").put("revision", "rotated"), "my-trip"));
  }

  @Test
  public void expiredBackgroundedEndedAndReplacedSessionsCannotAuthorizeAnotherFile()
      throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    AtomicLong now = new AtomicLong();
    R2PublicationSession session = new R2PublicationSession(now::get);
    String token = session.begin(c, "trip", Set.of("photo"), Set.of());
    now.set(30 * 60 * 1000L);
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(token, c, "public", "photo"));
    String fresh = session.begin(c, "trip", Set.of("photo"), Set.of());
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(token, c, "public", "photo"));
    session.clear();
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(fresh, c, "public", "photo"));
    String ended = session.begin(c, "trip", Set.of("photo"), Set.of());
    session.end(ended);
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(ended, c, "public", "photo"));
  }

  @Test
  public void activeBatchStillHasAnAbsoluteExpiry() throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    AtomicLong now = new AtomicLong();
    R2PublicationSession session = new R2PublicationSession(now::get);
    String token = session.begin(c, "trip", Set.of("photo"), Set.of());
    for (int minute = 10; minute < 120; minute += 10) {
      now.set(minute * 60 * 1000L);
      session.selection(token, c, "public", "photo");
    }
    now.set(120 * 60 * 1000L);
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(token, c, "public", "photo"));
  }

  @Test
  public void rotatingCredentialsInvalidatesBatchWithoutAuthorizingAnotherBucket()
      throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    R2PublicationSession session = new R2PublicationSession(() -> 0L);
    String token = session.begin(c, "trip", Set.of("photo"), Set.of());
    JSONObject input =
        new JSONObject()
            .put("accountId", c.account)
            .put("endpoint", c.endpoint)
            .put("bucket", c.bucket)
            .put("accessKeyId", c.access)
            .put("secretAccessKey", c.secret)
            .put("publicBaseUrl", c.base)
            .put("revision", "rotated");
    R2Credentials rotated = new R2Credentials(input);
    rejects(
        "PUBLICATION_SESSION_EXPIRED", () -> session.selection(token, rotated, "public", "photo"));
    R2Credentials other =
        new R2Credentials(input.put("revision", c.revision).put("bucket", "another-bucket"));
    rejects(
        "PUBLICATION_SESSION_EXPIRED", () -> session.selection(token, other, "public", "photo"));
  }

  @Test
  public void activeTransferChecksKeepLongForegroundUploadsApprovedWithoutRemovingTheAbsoluteLimit()
      throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    AtomicLong now = new AtomicLong();
    R2PublicationSession session = new R2PublicationSession(now::get);
    String token = session.begin(c, "trip", Set.of("next-photo"), Set.of("large-video"));
    for (int minute = 10; minute < 120; minute += 10) {
      now.set(minute * 60 * 1000L);
      session.transfer(token, c, job("large-video"), null);
    }
    session.selection(token, c, "public", "next-photo");
    now.set(120 * 60 * 1000L);
    rejects(
        "PUBLICATION_SESSION_EXPIRED", () -> session.transfer(token, c, job("large-video"), null));
  }

  @Test
  public void briefUnlockedInterruptionsSuspendOperationsAndCanResumeTheSameGrant()
      throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    AtomicLong now = new AtomicLong();
    R2PublicationSession session = new R2PublicationSession(now::get);
    String token = session.begin(c, "trip", Set.of("photo"), Set.of());
    session.background(false);
    now.set(20_000L);
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(token, c, "public", "photo"));
    now.set(59_999L);
    session.foreground(false);
    session.selection(token, c, "public", "photo");
    session.background(false);
    now.addAndGet(60_000L);
    session.foreground(false);
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(token, c, "public", "photo"));
  }

  @Test
  public void deviceLockAndScreenOffRevokeEvenDuringTheBriefInterruptionWindow() throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    AtomicLong now = new AtomicLong();
    R2PublicationSession session = new R2PublicationSession(now::get);
    String token = session.begin(c, "trip", Set.of("photo"), Set.of());
    session.background(true);
    now.set(1000L);
    session.foreground(false);
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(token, c, "public", "photo"));
    String fresh = session.begin(c, "trip", Set.of("photo"), Set.of());
    session.background(false);
    session.foreground(true);
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.selection(fresh, c, "public", "photo"));
  }

  @Test
  public void unrelatedTransferPollingCannotRefreshIdleApproval() throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    AtomicLong now = new AtomicLong();
    R2PublicationSession session = new R2PublicationSession(now::get);
    String token = session.begin(c, "trip", Set.of(), Set.of("reviewed"));
    now.set(20 * 60 * 1000L);
    rejects(
        "PUBLICATION_SCOPE_MISMATCH", () -> session.transfer(token, c, job("unreviewed"), null));
    now.set(30 * 60 * 1000L);
    rejects("PUBLICATION_SESSION_EXPIRED", () -> session.transfer(token, c, job("reviewed"), null));
  }
}
