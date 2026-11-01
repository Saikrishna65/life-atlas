package com.lifeatlas.app;

import android.app.Notification;
import android.app.Person;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class BankNotificationListener extends NotificationListenerService {
    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || !BankNotificationStore.enabled(this)
            || !BankAlertFilter.GOOGLE_MESSAGES.equals(sbn.getPackageName())) return;
        Notification notification = sbn.getNotification();
        if (notification == null || (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        Bundle extras = notification.extras;
        if (extras == null) return;
        try {
            String title = value(extras.getCharSequence(Notification.EXTRA_TITLE));
            Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
            if (messages != null && messages.length > 0) {
                for (Parcelable parcel : messages) {
                    if (!(parcel instanceof Bundle)) continue;
                    Bundle message = (Bundle) parcel;
                    String sender = value(message.getCharSequence("sender"));
                    if (Build.VERSION.SDK_INT >= 28) {
                        Person person = message.getParcelable("sender_person");
                        if (person != null) sender = value(person.getName());
                    }
                    capture(sbn, sender.isEmpty() ? title : sender, value(message.getCharSequence("text")), message.getLong("time", sbn.getPostTime()));
                }
            } else {
                String text = value(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
                if (text.isEmpty()) text = value(extras.getCharSequence(Notification.EXTRA_TEXT));
                capture(sbn, title, text, sbn.getPostTime());
            }
        } catch (Exception e) {
            BankNotificationStore.error(this, "Could not capture a bank alert. Check notification previews and reopen Finance.");
        }
    }
    private void capture(StatusBarNotification sbn, String sender, String text, long timestamp) throws Exception {
        if (!BankAlertFilter.accepts(sbn.getPackageName(), sender, text)) return;
        // Content identity avoids re-enqueuing unchanged Google Messages notification updates.
        byte[] hash = MessageDigest.getInstance("SHA-256").digest((sender + "\n" + text + "\n" + timestamp).getBytes(StandardCharsets.UTF_8));
        StringBuilder id = new StringBuilder("gmsg_");
        for (byte b : hash) id.append(String.format(Locale.US, "%02x", b & 255));
        SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        iso.setTimeZone(TimeZone.getTimeZone("UTC"));
        JSONObject event = new JSONObject().put("id", id.toString()).put("packageName", sbn.getPackageName())
            .put("sender", sender).put("title", sender).put("text", text).put("postTime", timestamp)
            .put("postTimeIso", iso.format(new Date(timestamp))).put("notificationKey", sbn.getKey());
        if (BankNotificationStore.enqueue(this, event)) {
            FinanceReviewNotifications.show(this, event);
            KotakNotificationTrackerPlugin.signalNotification();
        }
    }
    private static String value(CharSequence text) { return text == null ? "" : text.toString(); }
}
