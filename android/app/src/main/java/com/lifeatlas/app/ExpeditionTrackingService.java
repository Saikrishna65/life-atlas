package com.lifeatlas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.util.Locale;
import java.util.ArrayDeque;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

public class ExpeditionTrackingService extends Service implements LocationListener {
    public static final String ACTION_START = "com.lifeatlas.app.ACTION_START_EXPEDITION";
    public static final String ACTION_STOP = "com.lifeatlas.app.ACTION_STOP_EXPEDITION";
    public static final String ACTION_UPDATE_STATS = "com.lifeatlas.app.ACTION_UPDATE_EXPEDITION_STATS";
    public static final String ACTION_LOCATION_UPDATE = "com.lifeatlas.app.ACTION_EXPEDITION_LOCATION";

    public static final String EXTRA_TRIP_ID = "tripId";
    public static final String EXTRA_LEG_TITLE = "legTitle";
    public static final String EXTRA_DISTANCE_KM = "distanceKm";

    private static final String CHANNEL_ID = "atlas_expedition_channel";
    private static final int NOTIFICATION_ID = 2048;

    private static boolean isServiceRunning = false;
    private static final ArrayDeque<JSObject> pendingPoints=new ArrayDeque<>();
    private static String bufferedTrip="";
    public static synchronized JSArray pending(String tripId,double after){
        JSArray result=new JSArray();if(!bufferedTrip.equals(tripId))return result;
        for(JSObject point:pendingPoints)if(point.optDouble("timestamp")>after){result.put(point);if(result.length()>=100)break;}return result;
    }
    private static synchronized void buffer(String tripId,Location location){
        if(!tripId.equals(bufferedTrip)){pendingPoints.clear();bufferedTrip=tripId;}
        JSObject point=new JSObject();point.put("latitude",location.getLatitude());point.put("longitude",location.getLongitude());point.put("accuracy",location.getAccuracy());point.put("timestamp",location.getTime());
        point.put("speed",location.hasSpeed()?location.getSpeed():org.json.JSONObject.NULL);
        point.put("altitude",location.hasAltitude()?location.getAltitude():org.json.JSONObject.NULL);
        point.put("altitudeAccuracy",Build.VERSION.SDK_INT>=26&&location.hasVerticalAccuracy()?location.getVerticalAccuracyMeters():org.json.JSONObject.NULL);
        pendingPoints.addLast(point);while(pendingPoints.size()>20000)pendingPoints.removeFirst();
    }
    private LocationManager locationManager;
    private ExpeditionFixFilter filter = new ExpeditionFixFilter("TREK");
    private double totalDistanceMeters = 0.0;
    private String currentLegTitle = "Expedition";
    private String currentTripId = "";

    public static boolean isRunning() {
        return isServiceRunning;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE_STATS.equals(action)) {
            if (intent.hasExtra(EXTRA_DISTANCE_KM)) {
                double km = intent.getDoubleExtra(EXTRA_DISTANCE_KM, 0.0);
                totalDistanceMeters = km * 1000.0;
                updateNotification();
                try {
                    String distanceStr = String.format(Locale.US, "%.1f km", km);
                    TripAppWidgetProvider.updateLiveTracking(this, currentTripId, currentLegTitle, distanceStr, null, null);
                } catch (Exception ignored) {
                }
            }
            return START_STICKY;
        }

        // Re-anchor every explicit start/resume/leg change; never join a pause.
        if (!ACTION_START.equals(action)) return START_NOT_STICKY;
        filter = new ExpeditionFixFilter(intent.getStringExtra("category"));
        totalDistanceMeters = Math.max(0, intent.getDoubleExtra(EXTRA_DISTANCE_KM, 0.0)) * 1000;
        if(locationManager!=null)locationManager.removeUpdates(this);
        if (intent.hasExtra(EXTRA_TRIP_ID)) {
            currentTripId = intent.getStringExtra(EXTRA_TRIP_ID);
        }
        if (intent.hasExtra(EXTRA_LEG_TITLE)) {
            currentLegTitle = intent.getStringExtra(EXTRA_LEG_TITLE);
        }

        startForeground(NOTIFICATION_ID, buildNotification());
        isServiceRunning = true;
        startLocationUpdates();

        // Update home screen widget on expedition start
        try {
            TripAppWidgetProvider.updateLiveTracking(
                this,
                currentTripId,
                currentLegTitle,
                String.format(Locale.US, "%.1f km", totalDistanceMeters / 1000.0),
                "--",
                "--"
            );
        } catch (Exception ignored) {
        }

        return START_STICKY;
    }

    private void startLocationUpdates() {
        if (locationManager == null) return;
        boolean hasFine = ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!hasFine) return;

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000L, 4.0f, this);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000L, 6.0f, this);
            }
        } catch (SecurityException ignored) {
        }
    }

    private void stopTracking() {
        isServiceRunning = false;
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (Exception ignored) {
            }
        }
        stopForeground(true);
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;

        Double vertical = Build.VERSION.SDK_INT >= 26 && location.hasVerticalAccuracy() ? (double)location.getVerticalAccuracyMeters() : null;
        ExpeditionFixFilter.Result result=filter.accept(new ExpeditionFixFilter.Fix(
            location.getLatitude(),location.getLongitude(),location.hasAccuracy()?location.getAccuracy():Double.POSITIVE_INFINITY,
            location.getTime(),location.hasSpeed()?(double)location.getSpeed():null,location.hasAltitude()?location.getAltitude():null,vertical));
        if(result==null)return;
        buffer(currentTripId,location);
        totalDistanceMeters+=result.distanceMeters;
        updateNotification();

        // Broadcast to WebView / app
        Intent broadcast = new Intent(ACTION_LOCATION_UPDATE);
        broadcast.putExtra("lat", location.getLatitude());
        broadcast.putExtra("lng", location.getLongitude());
        broadcast.putExtra("alt", result.altitude==null?Double.NaN:result.altitude);
        broadcast.putExtra("speed", result.speedKmh / 3.6);
        broadcast.putExtra("acc", location.hasAccuracy() ? location.getAccuracy() : 10.0f);
        broadcast.putExtra("time", location.getTime());
        broadcast.putExtra("distKm", totalDistanceMeters / 1000.0);
        broadcast.putExtra(EXTRA_TRIP_ID, currentTripId);
        broadcast.setPackage(getPackageName());
        sendBroadcast(broadcast);

        // Also update Atlas Trips Home Screen Widget in real time
        try {
            double km = totalDistanceMeters / 1000.0;
            String distanceStr = String.format(Locale.US, "%.1f km", km);
            String altStr = result.altitude!=null ? String.format(Locale.US, "%,d m", Math.round(result.altitude)) : "--";
            String speedStr = String.format(Locale.US, "%.1f km/h", result.speedKmh);
            TripAppWidgetProvider.updateLiveTracking(this, currentTripId, currentLegTitle, distanceStr, altStr, speedStr);
        } catch (Exception ignored) {
        }
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && isServiceRunning) {
            nm.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        double km = totalDistanceMeters / 1000.0;
        String distanceStr = String.format(Locale.US, "%.2f km", km);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(currentLegTitle + " • " + distanceStr)
                .setContentText("Atlas Expedition active • Satellite GPS recording")
                .setContentIntent(pi)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Expedition GPS Tracker",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background route and distance recording for active expeditions");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override
    public void onProviderEnabled(String provider) {}
    @Override
    public void onProviderDisabled(String provider) {}

    @Override
    public void onDestroy() {
        stopTracking();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
