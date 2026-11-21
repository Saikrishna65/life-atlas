package com.lifeatlas.app.r2;

import android.content.*;
import android.os.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

final class GallerySubjectInference {
  private static final AtomicBoolean BUSY = new AtomicBoolean();

  static JSONObject extract(Context context, JSONObject input) throws Exception {
    if (!input.optBoolean("consent")) throw new R2Exception("EXTRACTION_CONSENT_REQUIRED");
    if (!BUSY.compareAndSet(false, true)) throw new R2Exception("EXTRACTION_BUSY");
    android.app.ActivityManager.MemoryInfo memory = new android.app.ActivityManager.MemoryInfo();
    ((android.app.ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE))
        .getMemoryInfo(memory);
    if (memory.lowMemory || memory.availMem < 128L * 1024 * 1024) {
      BUSY.set(false);
      throw new R2Exception("SUBJECT_MODEL_UNAVAILABLE");
    }
    Context app = context.getApplicationContext();
    CountDownLatch done = new CountDownLatch(1);
    String[] result = {null}, error = {"SUBJECT_MODEL_UNAVAILABLE"};
    Messenger receiver =
        new Messenger(
            new Handler(Looper.getMainLooper()) {
              @Override
              public void handleMessage(Message message) {
                if (message.sendingUid != android.os.Process.myUid()) return;
                result[0] = message.getData().getString("result");
                error[0] = message.getData().getString("error", "SUBJECT_MODEL_UNAVAILABLE");
                done.countDown();
              }
            });
    ServiceConnection connection =
        new ServiceConnection() {
          public void onServiceConnected(ComponentName name, IBinder binder) {
            try {
              Message message = Message.obtain();
              Bundle data = new Bundle();
              data.putString("input", input.toString());
              message.setData(data);
              message.replyTo = receiver;
              new Messenger(binder).send(message);
            } catch (RemoteException failure) {
              done.countDown();
            }
          }

          public void onServiceDisconnected(ComponentName name) {
            error[0] = "SUBJECT_WORKER_STOPPED";
            done.countDown();
          }

          public void onBindingDied(ComponentName name) {
            error[0] = "SUBJECT_WORKER_STOPPED";
            done.countDown();
          }

          public void onNullBinding(ComponentName name) {
            done.countDown();
          }
        };
    boolean bound = false;
    try {
      bound =
          app.bindService(
              new Intent(app, GalleryExtractionService.class),
              connection,
              Context.BIND_AUTO_CREATE);
      if (!bound || !done.await(40, TimeUnit.SECONDS) || result[0] == null)
        throw new R2Exception(error[0]);
      JSONObject value = new JSONObject(result[0]);
      if (!value.getString("token").matches("[0-9a-fA-F-]{36}")
          || value.getInt("width") < 1
          || value.getInt("height") < 1) throw new R2Exception("SUBJECT_MODEL_UNAVAILABLE");
      return value;
    } finally {
      if (bound) {
        try {
          app.unbindService(connection);
        } catch (IllegalArgumentException ignored) {
        }
      }
      BUSY.set(false);
    }
  }
}
