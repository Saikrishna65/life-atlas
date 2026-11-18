package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import android.content.Context;
import androidx.work.*;
import androidx.work.testing.*;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

/** Exercises the real native WorkManager graph with synthetic workers, never live R2 requests. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@org.robolectric.annotation.SQLiteMode(org.robolectric.annotation.SQLiteMode.Mode.LEGACY)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2NativeQueueTest {
  @Test
  public void completeBatchIsPersistedAndRunsSeriallyWithoutAnyWebView() throws Exception {
    Context context = RuntimeEnvironment.getApplication();
    List<String> completed = new CopyOnWriteArrayList<>();
    initialize(context, completed);
    try {
      R2TransferWorker.enqueueBatch(context, new JSONArray(List.of("one", "two", "three")));
      WorkManager manager = WorkManager.getInstance(context);
      List<WorkInfo> persisted = manager.getWorkInfosForUniqueWork("atlas-r2-queue").get();
      assertEquals(3, persisted.size());
      TestDriver driver = WorkManagerTestInitHelper.getTestDriver(context);
      assertNotNull(driver);
      for (String id : List.of("one", "two", "three")) {
        WorkInfo info =
            persisted.stream()
                .filter(work -> work.getTags().contains("atlas-r2-" + id))
                .findFirst()
                .get();
        if (!manager.getWorkInfoById(info.getId()).get().getState().isFinished())
          driver.setAllConstraintsMet(info.getId());
      }
      assertEquals(List.of("one", "two", "three"), completed);
      for (WorkInfo info : manager.getWorkInfosForUniqueWork("atlas-r2-queue").get())
        assertEquals(WorkInfo.State.SUCCEEDED, info.getState());
    } finally {
      WorkManagerTestInitHelper.closeWorkDatabase();
    }
  }

  private void initialize(Context context, List<String> completed) {
    Configuration config =
        new Configuration.Builder()
            .setExecutor(new SynchronousExecutor())
            .setTaskExecutor(new SynchronousExecutor())
            .setWorkerFactory(
                new WorkerFactory() {
                  @Override
                  public ListenableWorker createWorker(
                      Context app, String name, WorkerParameters params) {
                    return new Worker(app, params) {
                      @Override
                      public Result doWork() {
                        completed.add(getInputData().getString("id"));
                        return Result.success();
                      }
                    };
                  }
                })
            .build();
    WorkManagerTestInitHelper.initializeTestWorkManager(context, config);
  }

  @Test
  public void approvedNativeQueueCanBeRestoredAfterSchedulerCancellationWithoutNewFileIds()
      throws Exception {
    Context context = RuntimeEnvironment.getApplication();
    List<String> completed = new CopyOnWriteArrayList<>();
    initialize(context, completed);
    try {
      R2Repository repository = R2TripQueueTest.repository();
      R2Credentials c = R2CatalogTest.credentials();
      repository.store.edit(
          state ->
              state.put(
                  "public",
                  new org.json.JSONObject()
                      .put("accountId", c.account)
                      .put("bucket", c.bucket)
                      .put("accessKeyId", c.access)
                      .put("secretAccessKey", c.secret)
                      .put("publicBaseUrl", c.base)
                      .put("revision", c.revision)));
      org.json.JSONObject batch =
          R2TripQueue.prepare(
              repository,
              c,
              "trip",
              new LinkedHashSet<>(List.of("a", "b")),
              Set.of(),
              new org.json.JSONObject());
      JSONArray original = batch.getJSONArray("enqueue");
      R2TransferWorker.enqueueBatch(context, original);
      WorkManager manager = WorkManager.getInstance(context);
      manager.cancelAllWorkByTag("atlas-r2").getResult().get();
      JSONArray recovered =
          R2QueueState.repair(
              repository, R2QueueState.index(manager.getWorkInfosByTag("atlas-r2").get()));
      assertEquals(original.toString(), recovered.toString());
      assertEquals(2, repository.jobs().length());
      R2TransferWorker.enqueueBatch(context, recovered);
      TestDriver driver = WorkManagerTestInitHelper.getTestDriver(context);
      assertNotNull(driver);
      for (int i = 0; i < original.length(); i++) {
        String id = original.getString(i);
        for (WorkInfo work : manager.getWorkInfosByTag("atlas-r2-" + id).get())
          if (!work.getState().isFinished()) driver.setAllConstraintsMet(work.getId());
      }
      assertEquals(List.of(original.getString(0), original.getString(1)), completed);
    } finally {
      WorkManagerTestInitHelper.closeWorkDatabase();
    }
  }
}
