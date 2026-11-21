package com.lifeatlas.app.r2;

import android.app.ActivityManager;
import android.content.*;
import android.os.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

final class GallerySearchInference {
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
    boolean bound = false;
    try {
      bound =
          context.bindService(
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
        if (values.length() >= 8) values = new JSONObject();
        JSONArray saved = new JSONArray();
        for (float value : vector) saved.put((double) value);
        values.put(cacheKey, saved);
        db.choice("query-vectors", values);
      }
      return vector;
    } finally {
      if (bound) context.unbindService(connection);
    }
  }
}
