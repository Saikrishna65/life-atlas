package com.lifeatlas.app.r2;

import android.app.Service;
import android.content.Intent;
import android.os.*;
import java.util.concurrent.*;
import org.json.JSONObject;

/** On-demand subject inference: native model faults cannot terminate Atlas or its uploads. */
public final class GalleryExtractionService extends Service {
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final Messenger inbox =
      new Messenger(
          new Handler(Looper.getMainLooper()) {
            @Override
            public void handleMessage(Message message) {
              if (message.sendingUid != android.os.Process.myUid() || message.replyTo == null)
                return;
              final Messenger reply = message.replyTo;
              final String input = message.getData().getString("input", "");
              if (input.length() > 2048) return;
              executor.execute(
                  () -> {
                    Bundle data = new Bundle();
                    try {
                      data.putString(
                          "result",
                          GalleryExtraction.sticker(getApplicationContext(), new JSONObject(input))
                              .toString());
                    } catch (Throwable failure) {
                      data.putString(
                          "error",
                          failure instanceof R2Exception
                              ? ((R2Exception) failure).code
                              : "SUBJECT_MODEL_UNAVAILABLE");
                    }
                    Message response = Message.obtain();
                    response.setData(data);
                    try {
                      reply.send(response);
                    } catch (RemoteException ignored) {
                    }
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
    // Never kill the activity process. Unbinding releases a hung native kernel too.
    String name = Build.VERSION.SDK_INT >= 28 ? android.app.Application.getProcessName() : "";
    if (name != null && name.endsWith(":gallery_extraction"))
      android.os.Process.killProcess(android.os.Process.myPid());
  }
}
