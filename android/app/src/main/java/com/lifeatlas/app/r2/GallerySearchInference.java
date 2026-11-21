package com.lifeatlas.app.r2;

import android.app.ActivityManager;
import android.content.*;
import android.os.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

final class GallerySearchInference {
  private static Context warmContext;
  private static ServiceConnection warmConnection;
  private static final Handler IDLE = new Handler(Looper.getMainLooper());
  private static final Runnable RELEASE = GallerySearchInference::releaseWarm;

  static synchronized void releaseWarm() {
    IDLE.removeCallbacks(RELEASE);
    if (warmConnection != null) {
      try {
        warmContext.unbindService(warmConnection);
      } catch (IllegalArgumentException ignored) {
      }
      warmConnection = null;
      warmContext = null;
    }
  }

  private static synchronized void retain(Context context, ServiceConnection connection) {
    releaseWarm();
    warmContext = context;
    warmConnection = connection;
    IDLE.postDelayed(RELEASE, 20000);
  }

  static float[] query(
      Context context,
      R2SecureStore secure,
      String query,
      java.util.function.BooleanSupplier cancelled)
      throws Exception {
    String cacheKey =
        GallerySearchStore.token(
            GalleryClip.REVISION + ":" + query.trim().toLowerCase(Locale.ROOT));
    try (GallerySearchStore db = new GallerySearchStore(secure)) {
      JSONArray cached = db.choice("query-vectors").optJSONArray(cacheKey);
      if (cached != null && cached.length() == 512) {
        float[] vector = new float[512];
        for (int i = 0; i < 512; i++) vector[i] = (float) cached.getDouble(i);
        return GalleryClip.normalize(vector);
      }
    }
    ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
    ((ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(memory);
    if (memory.lowMemory || memory.availMem < 256L * 1024 * 1024)
      throw new R2Exception("SEARCH_VISUAL_UNAVAILABLE");
    CountDownLatch done = new CountDownLatch(1);
    float[][] result = {null};
    Messenger receiver =
        new Messenger(
            new Handler(Looper.getMainLooper()) {
              @Override
              public void handleMessage(Message message) {
                result[0] = message.getData().getFloatArray("vector");
                done.countDown();
              }
            });
    ServiceConnection connection =
        new ServiceConnection() {
          public void onServiceConnected(ComponentName name, IBinder binder) {
            try {
              Message message = Message.obtain();
              Bundle data = new Bundle();
              data.putString("query", query);
              message.setData(data);
              message.replyTo = receiver;
              new Messenger(binder).send(message);
            } catch (RemoteException failure) {
              done.countDown();
            }
          }

          public void onServiceDisconnected(ComponentName name) {
            done.countDown();
          }

          public void onBindingDied(ComponentName name) {
            done.countDown();
          }

          public void onNullBinding(ComponentName name) {
            done.countDown();
          }
        };
    final Context app = context.getApplicationContext();
    boolean bound = false, success = false;
    try {
      bound =
          app.bindService(
              new Intent(context, GallerySearchService.class),
              connection,
              Context.BIND_AUTO_CREATE);
      if (!bound) throw new R2Exception("SEARCH_VISUAL_UNAVAILABLE");
      long end = android.os.SystemClock.elapsedRealtime() + 30000;
      while (!done.await(150, TimeUnit.MILLISECONDS)) {
        if (cancelled.getAsBoolean()) throw new R2Exception("SEARCH_CANCELLED");
        if (android.os.SystemClock.elapsedRealtime() > end)
          throw new R2Exception("SEARCH_VISUAL_UNAVAILABLE");
      }
      if (result[0] == null) throw new R2Exception("SEARCH_VISUAL_UNAVAILABLE");
      float[] vector = GalleryClip.normalize(result[0]);
      try (GallerySearchStore db = new GallerySearchStore(secure)) {
        JSONObject values = db.choice("query-vectors");
        if (values.length() >= 32 && !values.has(cacheKey)) values.remove(values.keys().next());
        JSONArray saved = new JSONArray();
        for (float value : vector) saved.put((double) value);
        values.put(cacheKey, saved);
        db.choice("query-vectors", values);
      }
      success = true;
      return vector;
    } finally {
      if (bound) {
        if (success && !cancelled.getAsBoolean()) retain(app, connection);
        else app.unbindService(connection);
      }
    }
  }
}
