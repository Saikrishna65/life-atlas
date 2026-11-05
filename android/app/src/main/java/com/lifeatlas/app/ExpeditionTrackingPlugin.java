package com.lifeatlas.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExpeditionTracking")
public class ExpeditionTrackingPlugin extends Plugin {

    @PluginMethod
    public void startTracking(PluginCall call) {
        String tripId = call.getString("tripId", "");
        String legTitle = call.getString("legTitle", "Expedition");

        try {
            Intent serviceIntent = new Intent(getContext(), ExpeditionTrackingService.class);
            serviceIntent.setAction(ExpeditionTrackingService.ACTION_START);
            serviceIntent.putExtra(ExpeditionTrackingService.EXTRA_TRIP_ID, tripId);
            serviceIntent.putExtra(ExpeditionTrackingService.EXTRA_LEG_TITLE, legTitle);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            call.resolve(new JSObject().put("tracking", true));
        } catch (Exception e) {
            call.reject("Could not start expedition background service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), ExpeditionTrackingService.class);
            serviceIntent.setAction(ExpeditionTrackingService.ACTION_STOP);
            getContext().startService(serviceIntent);

            call.resolve(new JSObject().put("tracking", false));
        } catch (Exception e) {
            call.reject("Could not stop expedition service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateStats(PluginCall call) {
        double distanceKm = call.getDouble("distanceKm", 0.0);
        try {
            Intent serviceIntent = new Intent(getContext(), ExpeditionTrackingService.class);
            serviceIntent.setAction(ExpeditionTrackingService.ACTION_UPDATE_STATS);
            serviceIntent.putExtra(ExpeditionTrackingService.EXTRA_DISTANCE_KM, distanceKm);
            getContext().startService(serviceIntent);
            call.resolve(new JSObject().put("updated", true));
        } catch (Exception e) {
            call.reject("Could not update expedition stats: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isTracking(PluginCall call) {
        call.resolve(new JSObject().put("tracking", ExpeditionTrackingService.isRunning()));
    }

    @PluginMethod
    public void updateTripWidget(PluginCall call) {
        try {
            String tripId = call.getString("tripId", "");
            String title = call.getString("title", "Atlas Trip Vault");
            String status = call.getString("status", "ACTIVE");
            String statusLabel = call.getString("statusLabel", "ON THE ROAD");
            String subtitle = call.getString("subtitle", "");
            String metric1Label = call.getString("metric1Label", "DISTANCE");
            String metric1Value = call.getString("metric1Value", "0.0 km");
            String metric2Label = call.getString("metric2Label", "ALTITUDE");
            String metric2Value = call.getString("metric2Value", "--");
            String note = call.getString("note", "");
            String targetRoute = call.getString("targetRoute", "/secret/vault");

            TripAppWidgetProvider.updateAllWidgets(
                getContext(),
                tripId,
                title,
                status,
                statusLabel,
                subtitle,
                metric1Label,
                metric1Value,
                metric2Label,
                metric2Value,
                note,
                targetRoute
            );
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject("Could not update Trip Vault widget: " + e.getMessage(), e);
        }
    }
}
