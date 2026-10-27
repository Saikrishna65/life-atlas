package com.lifeatlas.app;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * Life Atlas: Native Android Notification Listener for Kotak Transactions
 * 
 * Intercepts notifications from supported packages:
 * - Kotak 811 App (com.msf.kbank.mobile, com.kotak.mbanking)
 * - SMS Messaging Apps displaying bank alerts (Google Messages, Samsung Messages, AOSP, etc.)
 * - Truecaller (com.truecaller)
 * 
 * Invariants:
 * - Operates ONLY when user explicitly enables tracking in Life Atlas settings.
 * - Rejects OTPs, login alerts, promotional messages, and balance inquiries.
 * - Stores structured events in a durable native pending queue on disk.
 * - Broadcasts real-time events to KotakNotificationTrackerPlugin if active.
 * - Zero network uploads; 100% on-device isolation.
 */
public class KotakNotificationListenerService extends NotificationListenerService {
    private static final String TAG = "KotakNotifListener";
    public static final String PREFS_NAME = "lifeatlas_kotak_tracking";
    public static final String KEY_TRACKING_ENABLED = "tracking_enabled";
    public static final String KEY_LAST_EVENT_TIME = "last_event_time";
    public static final String KEY_LAST_TRANSACTION_TIME = "last_transaction_time";
    public static final String KEY_LAST_ERROR = "last_error";
    public static final String KEY_EVENTS_RECEIVED_COUNT = "events_received_count";
    public static final String KEY_DUPLICATES_IGNORED_COUNT = "duplicates_ignored_count";
    public static final String KEY_PENDING_QUEUE = "pending_notifications_json";

    // Known target package names - strictly official Kotak 811 banking apps only
    private static final Set<String> SUPPORTED_PACKAGES = new HashSet<>();
    static {
        // Kotak 811 official apps
        SUPPORTED_PACKAGES.add("com.msf.kbank.mobile");
        SUPPORTED_PACKAGES.add("com.kotak.mbanking");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isEnabled = prefs.getBoolean(KEY_TRACKING_ENABLED, false);
        if (!isEnabled) {
            // User has disabled tracking in Life Atlas
            return;
        }

        String packageName = sbn.getPackageName();
        if (packageName == null || !SUPPORTED_PACKAGES.contains(packageName)) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) return;

        Bundle extras = notification.extras;
        CharSequence titleSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleSeq != null ? titleSeq.toString() : "";
        String text = bigTextSeq != null && bigTextSeq.length() > 0 ? bigTextSeq.toString() : (textSeq != null ? textSeq.toString() : "");

        if (text.trim().isEmpty() && title.trim().isEmpty()) {
            return;
        }

        // Check if the notification content is relevant to Kotak Bank
        boolean isKotakApp = packageName.equals("com.msf.kbank.mobile") || packageName.equals("com.kotak.mbanking");
        boolean isKotakContent = isKotakRelated(title, text);

        if (!isKotakApp && !isKotakContent) {
            return;
        }

        // Filter out OTPs, login alerts, balance-only queries, and promotional messages
        if (shouldRejectNotification(title, text)) {
            Log.d(TAG, "Rejected non-transaction notification (OTP/promo/login)");
            return;
        }

        try {
            long postTime = sbn.getPostTime();
            SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
            String postTimeIso = isoFormat.format(new Date(postTime > 0 ? postTime : System.currentTimeMillis()));

            String eventId = "notif_" + System.currentTimeMillis() + "_" + Math.abs(sbn.getKey().hashCode() % 10000);

            JSONObject eventObj = new JSONObject();
            eventObj.put("id", eventId);
            eventObj.put("packageName", packageName);
            eventObj.put("sender", title);
            eventObj.put("title", title);
            eventObj.put("text", text);
            eventObj.put("postTime", postTime > 0 ? postTime : System.currentTimeMillis());
            eventObj.put("postTimeIso", postTimeIso);
            eventObj.put("notificationKey", sbn.getKey());

            // 1. Enqueue into durable native persistent queue
            enqueueNotification(prefs, eventObj);

            // 2. Update tracking statistics
            int currentCount = prefs.getInt(KEY_EVENTS_RECEIVED_COUNT, 0);
            prefs.edit()
                .putString(KEY_LAST_EVENT_TIME, postTimeIso)
                .putInt(KEY_EVENTS_RECEIVED_COUNT, currentCount + 1)
                .apply();

            Log.i(TAG, "Queued Kotak transaction notification: " + eventId);

            // 3. Dispatch live event to active plugin listener if webview is currently running
            KotakNotificationTrackerPlugin.dispatchLiveEvent(eventObj);

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
            prefs.edit().putString(KEY_LAST_ERROR, "Processing error: " + e.getMessage()).apply();
        }
    }

    /**
     * Checks if sender or narration contains Kotak banking keywords
     */
    private boolean isKotakRelated(String title, String text) {
        String combined = (title + " " + text).toUpperCase(Locale.ROOT);
        return combined.contains("KOTAK") || combined.contains("KOTAKB") || combined.contains("811");
    }

    /**
     * Rejects OTPs, login notices, promotional banners, balance inquiries, and failed alerts
     */
    private boolean shouldRejectNotification(String title, String text) {
        String combined = (title + " " + text).toLowerCase(Locale.ROOT);

        // 1. OTP / Verification codes
        if (combined.contains("otp") || combined.contains("verification code") ||
            combined.contains("secret code") || combined.contains("do not share") ||
            combined.contains("is your one time password")) {
            return true;
        }

        // 2. Login alerts
        if (combined.contains("logged in to") || combined.contains("login to") ||
            combined.contains("net banking login") || combined.contains("new login") ||
            combined.contains("mobile banking registration")) {
            return true;
        }

        // 3. Promotional campaigns
        if (combined.contains("pre-approved") || combined.contains("apply for loan") ||
            combined.contains("instant loan") || combined.contains("cashback offer") ||
            combined.contains("discount of") || combined.contains("zero paperwork") ||
            combined.contains("win exciting") || combined.contains("festive offer")) {
            return true;
        }

        // 4. Failed transactions (do not record failed attempts as ledger transactions)
        if (combined.contains("declined") || combined.contains("failed due to") ||
            combined.contains("could not be processed") || combined.contains("transaction unsuccessful")) {
            return true;
        }

        // 5. Balance inquiry only (no debited/credited amount)
        boolean hasAmountAction = combined.contains("debited") || combined.contains("credited") ||
                                  combined.contains("sent rs") || combined.contains("received rs") ||
                                  combined.contains("spent rs") || combined.contains("paid rs") ||
                                  combined.contains("refund of rs") || combined.contains("withdrawn");

        if (!hasAmountAction && combined.contains("avl bal") && !combined.contains("debited") && !combined.contains("credited")) {
            return true;
        }

        return false;
    }

    /**
     * Safely stores notification in the durable JSON queue in SharedPreferences
     */
    private synchronized void enqueueNotification(SharedPreferences prefs, JSONObject eventObj) {
        try {
            String existingQueueStr = prefs.getString(KEY_PENDING_QUEUE, "[]");
            JSONArray queue = new JSONArray(existingQueueStr);

            // Avoid adding identical notificationKey within queue
            String newKey = eventObj.optString("notificationKey", "");
            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.getJSONObject(i);
                if (!newKey.isEmpty() && newKey.equals(item.optString("notificationKey", ""))) {
                    Log.d(TAG, "Notification with key already in queue, skipping enqueue");
                    return;
                }
            }

            queue.put(eventObj);

            // Cap queue at 100 items to avoid SharedPreferences overflow
            while (queue.length() > 100) {
                queue.remove(0);
            }

            prefs.edit().putString(KEY_PENDING_QUEUE, queue.toString()).apply();
        } catch (JSONException e) {
            Log.e(TAG, "Failed to persist queued notification", e);
        }
    }
}

