package com.lifeatlas.app.r2;

import android.content.Context;
import androidx.work.*;

/** Android schedules this on media changes, including when the WebView is not alive. */
public final class GalleryWatchWorker extends Worker {
  public GalleryWatchWorker(Context c, WorkerParameters p) {
    super(c, p);
  }

  public Result doWork() {
    try {
      GalleryIntelligence service = new GalleryIntelligence(getApplicationContext());
      service.refreshMediaIfChanged();
      service.watch(service.settings());
      return Result.success();
    } catch (Exception e) {
      return Result.retry();
    }
  }
}
