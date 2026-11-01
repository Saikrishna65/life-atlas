package com.lifeatlas.app;

import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "KotakNotificationTracker")
public class KotakNotificationTrackerPlugin extends Plugin {
    private static WeakReference<KotakNotificationTrackerPlugin> active = new WeakReference<>(null);
    @Override public void load() { active = new WeakReference<>(this); }
    @Override protected void handleOnDestroy() { if (active.get() == this) active.clear(); }
    static void signalNotification() {
        new Handler(Looper.getMainLooper()).post(() -> {
            KotakNotificationTrackerPlugin plugin = active.get();
            if (plugin != null) plugin.notifyListeners("notificationReceived", new JSObject());
        });
    }
    private boolean granted() { return NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName()); }
    @PluginMethod public void isNotificationAccessGranted(PluginCall call) { call.resolve(new JSObject().put("granted", granted())); }
    @PluginMethod public void requestNotificationAccess(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject().put("opened", true));
        } catch (Exception e) { call.reject("Could not open Android notification access settings", e); }
    }
    @PluginMethod public void getTrackingStatus(PluginCall call) {
        try {
            JSObject status = new JSObject().put("enabled", BankNotificationStore.enabled(getContext())).put("permissionGranted", granted())
                .put("pendingCount", BankNotificationStore.pending(getContext()).length());
            for (String key : new String[]{"lastEventTime", "lastTransactionTime", "lastError"}) status.put(key, BankNotificationStore.string(getContext(), key) == null ? org.json.JSONObject.NULL : BankNotificationStore.string(getContext(), key));
            for (String key : new String[]{"eventsReceivedCount", "duplicatesIgnoredCount"}) status.put(key, BankNotificationStore.count(getContext(), key));
            call.resolve(status);
        } catch (Exception e) { call.reject("Could not read tracking status", e); }
    }
    @PluginMethod public void setTrackingEnabled(PluginCall call) {
        try {
            boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            BankNotificationStore.setEnabled(getContext(), enabled);
            if (enabled && granted() && Build.VERSION.SDK_INT >= 24) NotificationListenerService.requestRebind(new ComponentName(getContext(), BankNotificationListener.class));
            call.resolve(new JSObject().put("enabled", enabled));
        } catch (Exception e) { call.reject("Could not change tracking preference", e); }
    }
    @PluginMethod public void getPendingNotifications(PluginCall call) {
        try {
            JSArray items = new JSArray(BankNotificationStore.pending(getContext()).toString());
            call.resolve(new JSObject().put("notifications", items).put("count", items.length()));
        } catch (Exception e) { call.reject("Could not read bank alerts", e); }
    }
    @PluginMethod public void acknowledgeNotifications(PluginCall call) {
        try {
            JSArray ids = call.getArray("ids", new JSArray());
            Set<String> selected = new HashSet<>();
            for (int i = 0; i < ids.length(); i++) selected.add(ids.getString(i));
            int remaining = BankNotificationStore.acknowledge(getContext(), selected);
            call.resolve(new JSObject().put("success", true).put("remainingCount", remaining));
        } catch (Exception e) { call.reject("Could not acknowledge bank alerts", e); }
    }
    @PluginMethod public void recordTransactionProcessed(PluginCall call) {
        BankNotificationStore.processed(getContext(), call.getString("timestamp"));
        call.resolve(new JSObject().put("success", true));
    }
    @PluginMethod public void recordDuplicateIgnored(PluginCall call) {
        try { call.resolve(new JSObject().put("success", true).put("count", BankNotificationStore.increment(getContext(), "duplicatesIgnoredCount"))); }
        catch (Exception e) { call.reject("Could not update tracking status", e); }
    }
    @PluginMethod public void clearTrackingData(PluginCall call) {
        try { BankNotificationStore.clear(getContext()); call.resolve(new JSObject().put("success", true)); }
        catch (Exception e) { call.reject("Could not clear bank alerts", e); }
    }
}
