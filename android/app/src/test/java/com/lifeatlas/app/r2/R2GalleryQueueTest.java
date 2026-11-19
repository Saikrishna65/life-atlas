package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@GraphicsMode(GraphicsMode.Mode.LEGACY)
public class R2GalleryQueueTest {
  @Test
  public void entirePrivateBatchIsDurableAndDoesNotCreatePublications() throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    repo.store.edit(state -> state.put("recoveryVerified", true));
    JSONObject result =
        R2GalleryQueue.prepare(
            repo,
            R2CatalogTest.credentials(),
            "private",
            new JSONArray().put("a").put("b").put("a"));
    assertEquals(2, result.getJSONObject("transferIds").length());
    assertEquals(2, result.getJSONArray("enqueue").length());
    assertEquals(2, repo.jobs().length());
    for (int i = 0; i < repo.jobs().length(); i++) {
      JSONObject job = repo.jobs().getJSONObject(i);
      assertEquals("private", job.getString("slot"));
      assertTrue(job.getString("key").startsWith("encrypted/videos/"));
      assertEquals("queued", job.getString("status"));
      assertTrue(job.getBoolean("galleryApproved"));
      assertTrue(R2QueueState.eligible(job));
      assertFalse(job.has("tripCollection"));
    }
    assertFalse(repo.store.snapshot().has("publications"));
  }

  @Test
  public void retriesKeepExistingPendingJobButCompletedCopiesAreRecheckedByTheWorker()
      throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    repo.store.edit(state -> state.put("recoveryVerified", true));
    JSONArray ids = new JSONArray().put("a");
    String first =
        R2GalleryQueue.prepare(repo, R2CatalogTest.credentials(), "private", ids)
            .getJSONObject("transferIds")
            .getString("a");
    repo.update(first, j -> j.put("status", "failed"));
    assertEquals(
        first,
        R2GalleryQueue.prepare(repo, R2CatalogTest.credentials(), "private", ids)
            .getJSONObject("transferIds")
            .getString("a"));
    repo.update(first, j -> j.put("status", "complete").put("verified", true));
    String second =
        R2GalleryQueue.prepare(repo, R2CatalogTest.credentials(), "private", ids)
            .getJSONObject("transferIds")
            .getString("a");
    assertNotEquals(first, second);
    assertEquals("queued", repo.job(second).getString("status"));
  }

  @Test
  public void privateRecoveryAndInvalidSelectionsFailBeforeAnyJobsAreCommitted() throws Exception {
    R2Repository repo = R2TripQueueTest.repository();
    try {
      R2GalleryQueue.prepare(
          repo, R2CatalogTest.credentials(), "private", new JSONArray().put("a"));
      fail();
    } catch (R2Exception e) {
      assertEquals("RECOVERY_REQUIRED", e.code);
    }
    assertEquals(0, repo.jobs().length());
    try {
      R2GalleryQueue.prepare(
          repo, R2CatalogTest.credentials(), "public", new JSONArray().put("a").put("missing"));
      fail();
    } catch (R2Exception e) {
      assertEquals("SELECTION_NOT_FOUND", e.code);
    }
    assertEquals(0, repo.jobs().length());
  }

  @Test
  public void unapprovedPrivateJobsCannotBeRecoveredWithoutReview() throws Exception {
    JSONObject job =
        new JSONObject()
            .put("slot", "private")
            .put("direction", "upload")
            .put("status", "queued")
            .put("gallerySelectionId", "a");
    assertFalse(R2QueueState.eligible(job));
    job.put("galleryApproved", true);
    assertTrue(R2QueueState.eligible(job));
    job.put("status", "paused");
    assertFalse(R2QueueState.eligible(job));
    job.put("status", "cancelled");
    assertFalse(R2QueueState.eligible(job));
  }
}
