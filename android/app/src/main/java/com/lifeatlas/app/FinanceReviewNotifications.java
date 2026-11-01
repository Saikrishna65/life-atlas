package com.lifeatlas.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;

final class FinanceReviewNotifications {
    private static final String CHANNEL = "atlas_finance_reviews";
    private static final String TAG = "atlas-finance-review";
    static boolean allowed(Context context) {
        return (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            && NotificationManagerCompat.from(context).areNotificationsEnabled();
    }
    static void show(Context context, JSONObject event) {
        if (!allowed(context)) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Finance approvals", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Review captured bank transactions before recording them");
            manager.createNotificationChannel(channel);
        }
        String id = event.optString("id");
        Intent intent = new Intent(context, MainActivity.class)
            .setAction("com.lifeatlas.app.ACTION_REVIEW_FINANCE")
            .putExtra("target_route", "/secret/finance?review=1")
            .putExtra("finance_event_id", id)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_finance)
            .setContentTitle("Bank transaction needs your approval")
            .setContentText("Tap to check the suggested category and approve in Atlas Finance.")
            .setContentIntent(pending).setAutoCancel(true).setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .addAction(0, "Review transaction", pending);
        NotificationManagerCompat.from(context).notify(TAG, id.hashCode(), builder.build());
    }
    static void cancel(Context context, String id) { NotificationManagerCompat.from(context).cancel(TAG, id.hashCode()); }
    static void restorePending(Context context) {
        JSONArray events = BankNotificationStore.pending(context);
        for (int i = 0; i < events.length(); i++) show(context, events.optJSONObject(i));
    }
}
