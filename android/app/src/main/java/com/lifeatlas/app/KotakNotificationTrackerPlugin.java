package com.lifeatlas.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

/**
 * Life Atlas: Capacitor Bridge Plugin for Kotak Notification Tracking
 * 
 * Exposes methods to:
 * - Check and request Android Notification Access settings.
 * - Toggle automatic transaction tracking preference.
 * - Fetch durable pending notifications queue received while webview was closed.
 * - Acknowledge and purge processed notifications.
 * - Receive real-time notification events when webview is active.
 */
@CapacitorPlugin(name = "KotakNotificationTracker")
public class KotakNotificationTrackerPlugin extends Plugin {
    private static KotakNotificationTrackerPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void dispatchLiveEvent(JSONObject eventObj) {
        if (instance != null) {
            try {
                JSObject jsEvent = JSObject.fromJSONObject(eventObj);
                instance.notifyListeners("notificationReceived", jsEvent);
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(KotakNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
    }

    private boolean checkNotificationPermission() {
        try {
            Context ctx = getContext();
            Set<String> enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(ctx);
            if (enabledPackages.contains(ctx.getPackageName())) {
                return true;
            }

            // Fallback check on Settings.Secure
            String flat = Settings.Secure.getString(ctx.getContentResolver(), "enabled_notification_listeners");
            if (flat != null && !flat.isEmpty()) {
                ComponentName cn = new ComponentName(ctx, KotakNotificationListenerService.class);
                return flat.contains(cn.flattenToString()) || flat.contains(ctx.getPackageName());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }

    @PluginMethod
    public void isNotificationAccessGranted(PluginCall call) {
        boolean granted = checkNotificationPermission();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationAccess(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open Notification Listener Settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getTrackingStatus(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        boolean enabled = prefs.getBoolean(KotakNotificationListenerService.KEY_TRACKING_ENABLED, false);
        boolean permissionGranted = checkNotificationPermission();
        String lastEventTime = prefs.getString(KotakNotificationListenerService.KEY_LAST_EVENT_TIME, null);
        String lastTxnTime = prefs.getString(KotakNotificationListenerService.KEY_LAST_TRANSACTION_TIME, null);
        String lastError = prefs.getString(KotakNotificationListenerService.KEY_LAST_ERROR, null);
        int eventsCount = prefs.getInt(KotakNotificationListenerService.KEY_EVENTS_RECEIVED_COUNT, 0);
        int duplicatesCount = prefs.getInt(KotakNotificationListenerService.KEY_DUPLICATES_IGNORED_COUNT, 0);

        int pendingCount = 0;
        try {
            String queueStr = prefs.getString(KotakNotificationListenerService.KEY_PENDING_QUEUE, "[]");
            JSONArray queue = new JSONArray(queueStr);
            pendingCount = queue.length();
        } catch (Exception ignored) {}

        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        ret.put("permissionGranted", permissionGranted);
        ret.put("lastEventTime", lastEventTime);
        ret.put("lastTransactionTime", lastTxnTime);
        ret.put("lastError", lastError);
        ret.put("eventsReceivedCount", eventsCount);
        ret.put("duplicatesIgnoredCount", duplicatesCount);
        ret.put("pendingCount", pendingCount);
        call.resolve(ret);
    }

    @PluginMethod
    public void setTrackingEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("Missing 'enabled' parameter");
            return;
        }

        getPrefs().edit()
            .putBoolean(KotakNotificationListenerService.KEY_TRACKING_ENABLED, enabled)
            .apply();

        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void getPendingNotifications(PluginCall call) {
        try {
            String queueStr = getPrefs().getString(KotakNotificationListenerService.KEY_PENDING_QUEUE, "[]");
            JSONArray queue = new JSONArray(queueStr);
            JSArray jsArray = new JSArray();

            for (int i = 0; i < queue.length(); i++) {
                jsArray.put(JSObject.fromJSONObject(queue.getJSONObject(i)));
            }

            JSObject ret = new JSObject();
            ret.put("notifications", jsArray);
            ret.put("count", jsArray.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read pending queue: " + e.getMessage());
        }
    }

    @PluginMethod
    public void acknowledgeNotifications(PluginCall call) {
        JSArray idsArray = call.getArray("ids");
        if (idsArray == null) {
            call.reject("Missing 'ids' parameter");
            return;
        }

        try {
            Set<String> ackIds = new HashSet<>();
            for (int i = 0; i < idsArray.length(); i++) {
                ackIds.add(idsArray.getString(i));
            }

            SharedPreferences prefs = getPrefs();
            String queueStr = prefs.getString(KotakNotificationListenerService.KEY_PENDING_QUEUE, "[]");
            JSONArray queue = new JSONArray(queueStr);
            JSONArray updatedQueue = new JSONArray();

            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.getJSONObject(i);
                String id = item.optString("id", "");
                if (!ackIds.contains(id)) {
                    updatedQueue.put(item);
                }
            }

            prefs.edit().putString(KotakNotificationListenerService.KEY_PENDING_QUEUE, updatedQueue.toString()).apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("remainingCount", updatedQueue.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to acknowledge notifications: " + e.getMessage());
        }
    }

    @PluginMethod
    public void recordTransactionProcessed(PluginCall call) {
        String isoDate = call.getString("timestamp");
        if (isoDate == null) {
            isoDate = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(new java.util.Date());
        }

        getPrefs().edit()
            .putString(KotakNotificationListenerService.KEY_LAST_TRANSACTION_TIME, isoDate)
            .apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void recordDuplicateIgnored(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        int current = prefs.getInt(KotakNotificationListenerService.KEY_DUPLICATES_IGNORED_COUNT, 0);
        prefs.edit().putInt(KotakNotificationListenerService.KEY_DUPLICATES_IGNORED_COUNT, current + 1).apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("count", current + 1);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearTrackingData(PluginCall call) {
        getPrefs().edit()
            .remove(KotakNotificationListenerService.KEY_PENDING_QUEUE)
            .remove(KotakNotificationListenerService.KEY_LAST_EVENT_TIME)
            .remove(KotakNotificationListenerService.KEY_LAST_TRANSACTION_TIME)
            .remove(KotakNotificationListenerService.KEY_LAST_ERROR)
            .putInt(KotakNotificationListenerService.KEY_EVENTS_RECEIVED_COUNT, 0)
            .putInt(KotakNotificationListenerService.KEY_DUPLICATES_IGNORED_COUNT, 0)
            .apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}

