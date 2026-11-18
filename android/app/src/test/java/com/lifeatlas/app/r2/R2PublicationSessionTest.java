package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.util.*;
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
    R2PublicationSession session = new R2PublicationSession();
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
  public void rotatingCredentialsInvalidatesBatchWithoutAuthorizingAnotherBucket()
      throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    R2PublicationSession session = new R2PublicationSession();
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
        "PUBLICATION_SESSION_REQUIRED", () -> session.selection(token, rotated, "public", "photo"));
    R2Credentials other =
        new R2Credentials(input.put("revision", c.revision).put("bucket", "another-bucket"));
    rejects(
        "PUBLICATION_SESSION_REQUIRED", () -> session.selection(token, other, "public", "photo"));
  }

  @Test
  public void onlyExplicitEndReplacementOrCredentialChangeRevokesTheReviewedBatch()
      throws Exception {
    R2Credentials c = R2CatalogTest.credentials();
    R2PublicationSession session = new R2PublicationSession();
    String token = session.begin(c, "trip", Set.of("photo"), Set.of("video"));
    // No clock, activity, screen-lock or background condition participates in this approval.
    session.transfer(token, c, job("video"), "trip");
    session.selection(token, c, "public", "photo");
    String replacement = session.begin(c, "another-trip", Set.of("other-photo"), Set.of());
    rejects("PUBLICATION_SESSION_REQUIRED", () -> session.selection(token, c, "public", "photo"));
    session.selection(replacement, c, "public", "other-photo");
    session.end(replacement);
    rejects(
        "PUBLICATION_SESSION_REQUIRED",
        () -> session.selection(replacement, c, "public", "other-photo"));
  }
}
