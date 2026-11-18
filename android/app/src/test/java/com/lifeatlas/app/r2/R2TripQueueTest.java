package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.io.File;
import java.util.*;
import javax.crypto.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2TripQueueTest {
  static R2Repository repository() throws Exception {
    File root = java.nio.file.Files.createTempDirectory("trip-queue-test").toFile();
    android.content.Context context =
        new android.content.ContextWrapper(org.robolectric.RuntimeEnvironment.getApplication()) {
          @Override
          public File getNoBackupFilesDir() {
            return root;
          }
        };
    KeyGenerator generator = KeyGenerator.getInstance("AES");
    generator.init(256);
    SecretKey key = generator.generateKey();
    R2Repository repository = new R2Repository(new R2SecureStore(context, () -> key));
    repository.store.edit(
        state -> {
          JSONObject selections = new JSONObject();
          for (String id : List.of("a", "b", "c"))
            selections.put(
                id,
                new JSONObject()
                    .put("uri", "content://synthetic/" + id)
                    .put("name", id + ".mp4")
                    .put("mimeType", "video/mp4")
                    .put("size", 110000000L)
                    .put("persistent", true));
          state.put("selections", selections);
        });
    return repository;
  }

  private Set<String> files() {
    return new LinkedHashSet<>(List.of("a", "b", "c"));
  }

  @Test
  public void everyApprovedFileHasADurableNativeJobBeforeTheFirstFileFinishes() throws Exception {
    R2Repository repository = repository();
    JSONObject queue =
        R2TripQueue.prepare(
            repository, R2CatalogTest.credentials(), "trip", files(), Set.of(), new JSONObject());
    assertEquals(3, queue.getJSONArray("enqueue").length());
    assertEquals(3, repository.jobs().length());
    for (String selection : files()) {
      JSONObject job = repository.job(queue.getJSONObject("transferIds").getString(selection));
      assertEquals("public", job.getString("slot"));
      assertEquals("queued", job.getString("status"));
      assertEquals("content://synthetic/" + selection, job.getString("source"));
      assertEquals(110000000L, job.getLong("totalBytes"));
      assertFalse(job.getBoolean("stripMetadata"));
    }
  }

  @Test
  public void lostWebViewResponseRecoversTheSameJobsAndSkipsVerifiedCompletedUploads()
      throws Exception {
    R2Repository repository = repository();
    R2Credentials credentials = R2CatalogTest.credentials();
    JSONObject first =
        R2TripQueue.prepare(repository, credentials, "trip", files(), Set.of(), new JSONObject());
    String done = first.getJSONObject("transferIds").getString("a");
    repository.update(done, job -> job.put("status", "complete").put("verified", true));
    R2Repository reopened = new R2Repository(repository.store);
    JSONObject next =
        R2TripQueue.prepare(reopened, credentials, "trip", files(), Set.of(), new JSONObject());
    assertEquals(
        first.getJSONObject("transferIds").toString(),
        next.getJSONObject("transferIds").toString());
    assertEquals(3, reopened.jobs().length());
    assertEquals(2, next.getJSONArray("enqueue").length());
    for (int i = 0; i < next.getJSONArray("enqueue").length(); i++)
      assertNotEquals(done, next.getJSONArray("enqueue").getString(i));
  }

  @Test
  public void legacySavedTransferIdsAreRetainedAndPausedTransfersCanResume() throws Exception {
    R2Repository repository = repository();
    R2Credentials credentials = R2CatalogTest.credentials();
    JSONObject legacy =
        R2CatalogTest.job("legacy")
            .put("source", "content://synthetic/a")
            .put("revision", credentials.revision)
            .put("status", "paused");
    repository.job(legacy);
    JSONObject result =
        R2TripQueue.prepare(
            repository,
            credentials,
            "trip",
            Set.of("a"),
            Set.of("legacy"),
            new JSONObject().put("a", "legacy"));
    assertEquals("legacy", result.getJSONObject("transferIds").getString("a"));
    assertEquals(1, repository.jobs().length());
    assertEquals("queued", repository.job("legacy").getString("status"));
  }

  @Test
  public void privateUnreviewedOrDifferentSourceTransfersCannotBeBoundToPublicBatch()
      throws Exception {
    for (String violation : List.of("private", "unreviewed", "source")) {
      R2Repository repository = repository();
      R2Credentials credentials = R2CatalogTest.credentials();
      JSONObject legacy =
          R2CatalogTest.job("legacy")
              .put(
                  "source",
                  violation.equals("source") ? "content://other/file" : "content://synthetic/a")
              .put("revision", credentials.revision);
      if (violation.equals("private")) legacy.put("slot", "private");
      repository.job(legacy);
      try {
        R2TripQueue.prepare(
            repository,
            credentials,
            "trip",
            Set.of("a"),
            violation.equals("unreviewed") ? Set.of() : Set.of("legacy"),
            new JSONObject().put("a", "legacy"));
        fail();
      } catch (R2Exception expected) {
        assertEquals("PUBLICATION_SCOPE_MISMATCH", expected.code);
      }
      assertEquals(1, repository.jobs().length());
      assertFalse(repository.job("legacy").has("tripSelectionId"));
    }
  }

  @Test
  public void invalidSelectionsDoNotLeaveAPartiallyPreparedBatch() throws Exception {
    R2Repository repository = repository();
    try {
      R2TripQueue.prepare(
          repository,
          R2CatalogTest.credentials(),
          "trip",
          new LinkedHashSet<>(List.of("a", "missing")),
          Set.of(),
          new JSONObject());
      fail();
    } catch (R2Exception expected) {
      assertEquals("SELECTION_NOT_FOUND", expected.code);
    }
    assertEquals(0, repository.jobs().length());
  }
}
