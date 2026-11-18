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
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.LEGACY)
public class R2NativeQueueTest {
  @Test
  public void completeBatchIsPersistedAndRunsSeriallyWithoutAnyWebView() throws Exception {
    Context context = RuntimeEnvironment.getApplication();
    List<String> completed = new CopyOnWriteArrayList<>();
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
}
