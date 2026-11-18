package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import androidx.work.*;
import java.util.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2QueueStateTest {
  private WorkInfo work(String id, WorkInfo.State state, int attempts, long next, int stop) {
    return new WorkInfo(
        UUID.randomUUID(),
        state,
        Set.of("atlas-r2", "atlas-r2-" + id),
        Data.EMPTY,
        Data.EMPTY,
        attempts,
        0,
        Constraints.NONE,
        0,
        null,
        next,
        stop);
  }

  @Test
  public void runningAndRetryingWorkAreNeverFlaggedForRecovery() throws Exception {
    JSONObject job =
        R2CatalogTest.job("video")
            .put("status", "uploading")
            .put("tripSelectionId", "a")
            .put("tripCollection", "trip");
    for (WorkInfo.State state :
        List.of(WorkInfo.State.RUNNING, WorkInfo.State.ENQUEUED, WorkInfo.State.BLOCKED))
      assertFalse(
          R2QueueState.describe(
                  job, List.of(work("video", state, 0, 100, WorkInfo.STOP_REASON_NOT_STOPPED)), 0)
              .getBoolean("canRecover"));
    JSONObject retry =
        R2QueueState.describe(
            job,
            List.of(work("video", WorkInfo.State.ENQUEUED, 2, 500, WorkInfo.STOP_REASON_QUOTA)),
            100);
    assertTrue(retry.getBoolean("retryScheduled"));
    assertEquals(500, retry.getLong("nextAttemptAt"));
    assertEquals("QUOTA", retry.getString("androidWait"));
    assertTrue(R2QueueState.describe(job, List.of(), 0).getBoolean("canRecover"));
  }

  @Test
  public void repairRequeuesOnlyPreviouslyApprovedMissingPublicJobs() throws Exception {
    R2Repository repository = R2TripQueueTest.repository();
    R2Credentials c = R2CatalogTest.credentials();
    repository.store.edit(
        state ->
            state.put(
                "public",
                new JSONObject()
                    .put("accountId", c.account)
                    .put("bucket", c.bucket)
                    .put("accessKeyId", c.access)
                    .put("secretAccessKey", c.secret)
                    .put("publicBaseUrl", c.base)
                    .put("revision", c.revision)));
    for (String id :
        List.of("orphan", "active", "paused", "complete", "private", "unapproved", "auth-failed")) {
      JSONObject job =
          R2CatalogTest.job(id)
              .put("status", "uploading")
              .put("tripSelectionId", id)
              .put("tripCollection", "trip")
              .put("revision", c.revision);
      if (id.equals("paused") || id.equals("complete")) job.put("status", id);
      if (id.equals("private")) job.put("slot", "private");
      if (id.equals("unapproved")) job.remove("tripSelectionId");
      if (id.equals("auth-failed"))
        job.put("status", "failed").put("error", "AUTHENTICATION_FAILED");
      repository.job(job);
    }
    Map<String, List<WorkInfo>> work =
        R2QueueState.index(
            List.of(
                work("active", WorkInfo.State.RUNNING, 0, 0, WorkInfo.STOP_REASON_NOT_STOPPED)));
    JSONArray restored = R2QueueState.repair(repository, work);
    assertEquals(1, restored.length());
    assertEquals("orphan", restored.getString(0));
    assertEquals("queued", repository.job("orphan").getString("status"));
    assertEquals("paused", repository.job("paused").getString("status"));
    assertEquals("complete", repository.job("complete").getString("status"));
    assertEquals("uploading", repository.job("active").getString("status"));
  }

  static class ForegroundServiceStartNotAllowedException extends RuntimeException {
    ForegroundServiceStartNotAllowedException() {
      super("must never render this internal detail");
    }
  }

  @Test
  public void platformAndFileErrorsHaveSafeSpecificCodesWithoutRawDetails() {
    assertEquals(
        "BACKGROUND_UPLOAD_RESTRICTED",
        R2Policy.safeError(
            new java.util.concurrent.ExecutionException(
                new ForegroundServiceStartNotAllowedException())));
    assertEquals(
        "STORAGE_PERMISSION_DENIED", R2Policy.safeError(new SecurityException("private path")));
    assertEquals(
        "SOURCE_UNAVAILABLE",
        R2Policy.safeError(new java.io.FileNotFoundException("private path")));
  }
}
