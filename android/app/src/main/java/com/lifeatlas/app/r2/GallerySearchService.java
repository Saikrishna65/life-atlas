package com.lifeatlas.app.r2;

import android.app.Service;
import android.content.Intent;
import android.os.*;
import java.util.concurrent.*;

/** A native runtime failure must never terminate the activity, vault or ongoing uploads. */
public final class GallerySearchService extends Service {
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final Messenger inbox =
      new Messenger(
          new Handler(Looper.getMainLooper()) {
            @Override
            public void handleMessage(Message message) {
              if (message.sendingUid != android.os.Process.myUid() || message.replyTo == null)
                return;
              final Messenger reply = message.replyTo;
              final String query = message.getData().getString("query", "");
              if (query.isBlank() || query.length() > 200) return;
              executor.execute(
                  () -> {
                    Bundle data = new Bundle();
                    try (GalleryClip model = new GalleryClip(getApplicationContext())) {
                      data.putFloatArray("vector", model.query(query));
                    } catch (Throwable failure) {
                      data.putString("error", "SEARCH_VISUAL_UNAVAILABLE");
                    }
                    Message response = Message.obtain();
                    response.setData(data);
                    try {
                      reply.send(response);
                    } catch (RemoteException ignored) {
                    }
                    stopSelf();
                  });
            }
          });

  @Override
  public IBinder onBind(Intent intent) {
    return inbox.getBinder();
  }

  @Override
  public void onDestroy() {
    executor.shutdownNow();
    super.onDestroy();
    // This process contains only this service. Terminate a timed-out native kernel as well;
    // never leave a detached inference thread consuming battery after the caller cancels.
    String process = Build.VERSION.SDK_INT >= 28 ? android.app.Application.getProcessName() : "";
    if (process == null) process = "";
    if (process.endsWith(":gallery_search"))
      android.os.Process.killProcess(android.os.Process.myPid());
  }
}
