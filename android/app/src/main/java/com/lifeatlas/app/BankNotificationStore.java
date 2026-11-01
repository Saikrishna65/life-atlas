package com.lifeatlas.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Set;

/** Private, durable queue. Never remove events until the web ledger acknowledges them. */
final class BankNotificationStore {
    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("bank_notification_tracker", Context.MODE_PRIVATE);
    }
    static boolean enabled(Context context) { return prefs(context).getBoolean("enabled", false); }
    static synchronized void setEnabled(Context context, boolean enabled) {
        if (!prefs(context).edit().putBoolean("enabled", enabled).commit()) throw new IllegalStateException("Could not save tracking preference");
    }
    static synchronized JSONArray pending(Context context) {
        try { return new JSONArray(prefs(context).getString("queue", "[]")); }
        catch (Exception e) { throw new IllegalStateException("Could not read bank alert queue", e); }
    }
    static synchronized boolean enqueue(Context context, JSONObject event) {
        JSONArray queue = pending(context);
        for (int i = 0; i < queue.length(); i++) {
            if (queue.optJSONObject(i).optString("id").equals(event.optString("id"))) return false;
        }
        if (queue.length() >= 1000) { error(context, "Bank alert queue is full. Open Finance to import pending alerts."); return false; }
        queue.put(event);
        boolean saved = prefs(context).edit().putString("queue", queue.toString())
            .putString("lastEventTime", event.optString("postTimeIso"))
            .putInt("eventsReceivedCount", prefs(context).getInt("eventsReceivedCount", 0) + 1).commit();
        if (!saved) throw new IllegalStateException("Could not save bank alert");
        return true;
    }
    static synchronized int acknowledge(Context context, Set<String> ids) {
        JSONArray queue = pending(context), remaining = new JSONArray();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject item = queue.optJSONObject(i);
            if (!ids.contains(item.optString("id"))) remaining.put(item);
        }
        if (!prefs(context).edit().putString("queue", remaining.toString()).commit()) throw new IllegalStateException("Could not acknowledge bank alerts");
        for (String id : ids) FinanceReviewNotifications.cancel(context, id);
        KotakNotificationTrackerPlugin.signalNotification();
        return remaining.length();
    }
    static synchronized void error(Context context, String message) { prefs(context).edit().putString("lastError", message).commit(); }
    static String string(Context context, String key) { return prefs(context).getString(key, null); }
    static int count(Context context, String key) { return prefs(context).getInt(key, 0); }
    static synchronized int increment(Context context, String key) {
        int value = count(context, key) + 1;
        if (!prefs(context).edit().putInt(key, value).commit()) throw new IllegalStateException("Could not save tracking status");
        return value;
    }
    static synchronized void processed(Context context, String timestamp) { prefs(context).edit().putString("lastTransactionTime", timestamp).commit(); }
    static synchronized void clear(Context context) {
        boolean enabled = enabled(context);
        if (!prefs(context).edit().clear().putBoolean("enabled", enabled).commit()) throw new IllegalStateException("Could not clear tracking data");
    }
}
