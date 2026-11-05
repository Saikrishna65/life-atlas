package com.lifeatlas.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.widget.RemoteViews;

public class TripAppWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_OPEN_TRIP_VAULT = "com.lifeatlas.app.ACTION_OPEN_TRIP_VAULT";

    private static final String PREFS_NAME = "life_atlas_trip_widget";
    private static final String KEY_TRIP_ID = "widget_trip_id";
    private static final String KEY_TITLE = "widget_trip_title";
    private static final String KEY_STATUS = "widget_trip_status";
    private static final String KEY_STATUS_LABEL = "widget_trip_status_label";
    private static final String KEY_SUBTITLE = "widget_trip_subtitle";
    private static final String KEY_METRIC1_LABEL = "widget_trip_metric1_label";
    private static final String KEY_METRIC1_VAL = "widget_trip_metric1_val";
    private static final String KEY_METRIC2_LABEL = "widget_trip_metric2_label";
    private static final String KEY_METRIC2_VAL = "widget_trip_metric2_val";
    private static final String KEY_NOTE = "widget_trip_note";
    private static final String KEY_TARGET_ROUTE = "widget_trip_target_route";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String tripId = prefs.getString(KEY_TRIP_ID, "trip-active-gps-test");
        String title = prefs.getString(KEY_TITLE, "Himalayan Ridge Expedition");
        String status = prefs.getString(KEY_STATUS, "ACTIVE");
        String statusLabel = prefs.getString(KEY_STATUS_LABEL, "ON THE ROAD");
        String subtitle = prefs.getString(KEY_SUBTITLE, "Leg 3: Devprayag to Chopta Meadows");
        String m1Label = prefs.getString(KEY_METRIC1_LABEL, "DISTANCE");
        String m1Val = prefs.getString(KEY_METRIC1_VAL, "436.1 km");
        String m2Label = prefs.getString(KEY_METRIC2_LABEL, "ALTITUDE");
        String m2Val = prefs.getString(KEY_METRIC2_VAL, "2,680 m");
        String note = prefs.getString(KEY_NOTE, "📍 Next: Chopta Base Camp (2,680m)");
        String route = prefs.getString(KEY_TARGET_ROUTE, "/secret/vault/trip-active-gps-test/tracking");

        for (int widgetId : appWidgetIds) {
            updateWidgetView(context, appWidgetManager, widgetId, tripId, title, status, statusLabel, subtitle, m1Label, m1Val, m2Label, m2Val, note, route);
        }
    }

    public static void updateAllWidgets(
        Context context,
        String tripId,
        String title,
        String status,
        String statusLabel,
        String subtitle,
        String metric1Label,
        String metric1Value,
        String metric2Label,
        String metric2Value,
        String note,
        String targetRoute
    ) {
        if (context == null) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        if (tripId != null) editor.putString(KEY_TRIP_ID, tripId);
        if (title != null && !title.isEmpty()) editor.putString(KEY_TITLE, title);
        if (status != null && !status.isEmpty()) editor.putString(KEY_STATUS, status);
        if (statusLabel != null && !statusLabel.isEmpty()) editor.putString(KEY_STATUS_LABEL, statusLabel);
        if (subtitle != null) editor.putString(KEY_SUBTITLE, subtitle);
        if (metric1Label != null) editor.putString(KEY_METRIC1_LABEL, metric1Label);
        if (metric1Value != null) editor.putString(KEY_METRIC1_VAL, metric1Value);
        if (metric2Label != null) editor.putString(KEY_METRIC2_LABEL, metric2Label);
        if (metric2Value != null) editor.putString(KEY_METRIC2_VAL, metric2Value);
        if (note != null) editor.putString(KEY_NOTE, note);
        if (targetRoute != null && !targetRoute.isEmpty()) editor.putString(KEY_TARGET_ROUTE, targetRoute);

        editor.apply();

        String activeTripId = prefs.getString(KEY_TRIP_ID, "trip-active-gps-test");
        String activeTitle = prefs.getString(KEY_TITLE, "Atlas Trip Vault");
        String activeStatus = prefs.getString(KEY_STATUS, "ACTIVE");
        String activeStatusLabel = prefs.getString(KEY_STATUS_LABEL, "ON THE ROAD");
        String activeSubtitle = prefs.getString(KEY_SUBTITLE, "");
        String m1Label = prefs.getString(KEY_METRIC1_LABEL, "DISTANCE");
        String m1Val = prefs.getString(KEY_METRIC1_VAL, "0.0 km");
        String m2Label = prefs.getString(KEY_METRIC2_LABEL, "ALTITUDE");
        String m2Val = prefs.getString(KEY_METRIC2_VAL, "--");
        String activeNote = prefs.getString(KEY_NOTE, "");
        String activeRoute = prefs.getString(KEY_TARGET_ROUTE, "/secret/vault");

        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, TripAppWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

            for (int widgetId : appWidgetIds) {
                updateWidgetView(context, appWidgetManager, widgetId, activeTripId, activeTitle, activeStatus, activeStatusLabel, activeSubtitle, m1Label, m1Val, m2Label, m2Val, activeNote, activeRoute);
            }
        } catch (Exception ignored) {
        }
    }

    public static void updateLiveTracking(
        Context context,
        String tripId,
        String legTitle,
        String distanceStr,
        String altStr,
        String speedStr
    ) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        if (tripId != null && !tripId.isEmpty()) {
            editor.putString(KEY_TRIP_ID, tripId);
            editor.putString(KEY_TARGET_ROUTE, "/secret/vault/" + tripId + "/tracking");
        }
        editor.putString(KEY_STATUS, "ACTIVE");
        editor.putString(KEY_STATUS_LABEL, "ON THE ROAD");
        if (legTitle != null && !legTitle.isEmpty()) {
            editor.putString(KEY_SUBTITLE, legTitle);
        }
        if (distanceStr != null) {
            editor.putString(KEY_METRIC1_LABEL, "DISTANCE");
            editor.putString(KEY_METRIC1_VAL, distanceStr);
        }
        if (altStr != null && !altStr.equals("--")) {
            editor.putString(KEY_METRIC2_LABEL, "ALTITUDE");
            editor.putString(KEY_METRIC2_VAL, altStr);
        } else if (speedStr != null && !speedStr.equals("--")) {
            editor.putString(KEY_METRIC2_LABEL, "SPEED");
            editor.putString(KEY_METRIC2_VAL, speedStr);
        }
        editor.apply();

        updateAllWidgets(context, null, null, null, null, null, null, null, null, null, null, null);
    }

    private static void updateWidgetView(
        Context context,
        AppWidgetManager appWidgetManager,
        int widgetId,
        String tripId,
        String title,
        String status,
        String statusLabel,
        String subtitle,
        String metric1Label,
        String metric1Value,
        String metric2Label,
        String metric2Value,
        String note,
        String targetRoute
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_trip_vault);

        // 1. Dynamic Luxury Gradient Background with Rounded Corners & Glow Border
        Bitmap bgBitmap = createTripBackgroundBitmap(500, 240, status);
        if (bgBitmap != null) {
            views.setImageViewBitmap(R.id.widget_trip_bg_image, bgBitmap);
        }

        // 2. Populate text details
        views.setTextViewText(R.id.widget_trip_title, title != null ? title : "Atlas Trip Vault");
        views.setTextViewText(R.id.widget_trip_badge, statusLabel != null ? statusLabel : "READY");
        views.setTextViewText(R.id.widget_trip_subtitle, subtitle != null ? subtitle : "");
        views.setTextViewText(R.id.widget_trip_metric1_label, metric1Label != null ? metric1Label : "DISTANCE");
        views.setTextViewText(R.id.widget_trip_metric1_val, metric1Value != null ? metric1Value : "--");
        views.setTextViewText(R.id.widget_trip_metric2_label, metric2Label != null ? metric2Label : "ALTITUDE");
        views.setTextViewText(R.id.widget_trip_metric2_val, metric2Value != null ? metric2Value : "--");
        views.setTextViewText(R.id.widget_trip_note, (note != null && !note.isEmpty()) ? note : "Life Atlas Expedition");

        // 3. Status Tag & Action Button Styling
        if ("ACTIVE".equalsIgnoreCase(status) || "ON THE ROAD".equalsIgnoreCase(statusLabel)) {
            views.setTextViewText(R.id.widget_trip_tag, "🧭 ACTIVE EXPEDITION");
            views.setTextViewText(R.id.widget_trip_btn_action, "Live Map →");
        } else if ("PLANNING".equalsIgnoreCase(status) || "UPCOMING".equalsIgnoreCase(statusLabel) || (statusLabel != null && statusLabel.contains("START"))) {
            views.setTextViewText(R.id.widget_trip_tag, "🧭 UPCOMING TREK");
            views.setTextViewText(R.id.widget_trip_btn_action, "View Trip →");
        } else {
            views.setTextViewText(R.id.widget_trip_tag, "🧭 ATLAS TRIP VAULT");
            views.setTextViewText(R.id.widget_trip_btn_action, "Explore →");
        }

        // 4. Tap Whole Widget or Primary Action -> Open Target Route (e.g. /secret/vault/[tripId]/tracking or /secret/vault/[tripId])
        String safeRoute = (targetRoute != null && !targetRoute.isEmpty()) ? targetRoute : "/secret/vault";
        Intent openTargetIntent = new Intent(context, MainActivity.class);
        openTargetIntent.setAction(ACTION_OPEN_TRIP_VAULT);
        openTargetIntent.putExtra("target_route", safeRoute);
        openTargetIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openTargetPending = PendingIntent.getActivity(
            context,
            301,
            openTargetIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_trip_container, openTargetPending);
        views.setOnClickPendingIntent(R.id.widget_trip_bg_image, openTargetPending);
        views.setOnClickPendingIntent(R.id.widget_trip_btn_action, openTargetPending);

        // 5. Tap 'Open Vault' button -> Open Main Trip Vault List (/secret/vault)
        Intent openVaultIntent = new Intent(context, MainActivity.class);
        openVaultIntent.setAction(ACTION_OPEN_TRIP_VAULT);
        openVaultIntent.putExtra("target_route", "/secret/vault");
        openVaultIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openVaultPending = PendingIntent.getActivity(
            context,
            302,
            openVaultIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_trip_btn_open, openVaultPending);

        try {
            appWidgetManager.updateAppWidget(widgetId, views);
        } catch (Exception ignored) {
        }
    }

    private static Bitmap createTripBackgroundBitmap(int width, int height, String status) {
        try {
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            RectF rect = new RectF(1.5f, 1.5f, width - 1.5f, height - 1.5f);
            float radius = 38f;

            int topColor;
            int bottomColor;
            int strokeColor;

            if ("ACTIVE".equalsIgnoreCase(status) || "ON THE ROAD".equalsIgnoreCase(status)) {
                // Deep Forest / Obsidian with Vibrant Emerald Glow
                topColor = 0xFF081C15;
                bottomColor = 0xFF030906;
                strokeColor = 0x5534D399; // Emerald glow
            } else if ("PLANNING".equalsIgnoreCase(status) || "UPCOMING".equalsIgnoreCase(status)) {
                // Twilight Alpine Sapphire with Cyan Glow
                topColor = 0xFF0B172A;
                bottomColor = 0xFF050B14;
                strokeColor = 0x5038BDF8; // Sky blue glow
            } else if ("COMPLETED".equalsIgnoreCase(status)) {
                // Deep Royal Indigo with Lavender Glow
                topColor = 0xFF140E26;
                bottomColor = 0xFF070512;
                strokeColor = 0x45A78BFA;
            } else {
                // Midnight Slate
                topColor = 0xFF0F172A;
                bottomColor = 0xFF060910;
                strokeColor = 0x3064748B;
            }

            // Fill background gradient
            Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            bgPaint.setShader(new LinearGradient(
                0, 0, width, height,
                topColor,
                bottomColor,
                Shader.TileMode.CLAMP
            ));
            canvas.drawRoundRect(rect, radius, radius, bgPaint);

            // Subtle Glowing Border
            Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            strokePaint.setStyle(Paint.Style.STROKE);
            strokePaint.setStrokeWidth(2.5f);
            strokePaint.setColor(strokeColor);
            canvas.drawRoundRect(rect, radius, radius, strokePaint);

            return bitmap;
        } catch (Throwable ignored) {
            return null;
        }
    }
}

