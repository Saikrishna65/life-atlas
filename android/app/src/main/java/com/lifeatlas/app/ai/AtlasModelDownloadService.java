package com.lifeatlas.app.ai;

import android.app.*;
import android.content.*;
import android.os.*;
import androidx.core.app.NotificationCompat;

/** Foreground only during explicit downloads. No microphone and no idle wake lock. */
public class AtlasModelDownloadService extends Service {
  private final Handler handler = new Handler(Looper.getMainLooper());
  private long started;
  private final Runnable monitor =
      new Runnable() {
        public void run() {
          if (!AtlasModelStore.get(AtlasModelDownloadService.this).active()
              && SystemClock.elapsedRealtime() - started > 3000) {
            stopForeground(true);
            stopSelf();
            return;
          }
          handler.postDelayed(this, 1000);
        }
      };

  @Override
  public int onStartCommand(Intent intent, int flags, int id) {
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26)
      nm.createNotificationChannel(
          new NotificationChannel(
              "atlas-models", "AI model downloads", NotificationManager.IMPORTANCE_LOW));
    Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent pending =
        PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    startForeground(
        8401,
        new NotificationCompat.Builder(this, "atlas-models")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("Transferring an Atlas AI model")
            .setContentText("Open Intelligence Lab to pause or check progress")
            .setContentIntent(pending)
            .setOngoing(true)
            .build());
    started = SystemClock.elapsedRealtime();
    handler.removeCallbacks(monitor);
    handler.postDelayed(monitor, 1000);
    return START_NOT_STICKY;
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(monitor);
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent i) {
    return null;
  }
}
