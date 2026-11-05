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
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

public class FinanceAppWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_OPEN_FINANCE = "com.lifeatlas.app.ACTION_OPEN_FINANCE_VAULT";
    public static final String ACTION_REVIEW_FINANCE = "com.lifeatlas.app.ACTION_REVIEW_FINANCE";

    private static final String PREFS_NAME = "life_atlas_finance_widget";
    private static final String KEY_BALANCE = "widget_finance_balance";
    private static final String KEY_ACCOUNT = "widget_finance_account";
    private static final String KEY_SUBTEXT = "widget_finance_subtext";
    private static final String KEY_PENDING_COUNT = "widget_finance_pending_count";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String balance = prefs.getString(KEY_BALANCE, "₹0.00");
        String account = prefs.getString(KEY_ACCOUNT, "Total Net Worth");
        String subtext = prefs.getString(KEY_SUBTEXT, "Private Local Ledger");
        int pendingCount = prefs.getInt(KEY_PENDING_COUNT, 0);

        // Also check if bank notification tracker has queued items
        try {
            int bankPending = BankNotificationStore.pending(context).length();
            if (bankPending > pendingCount) {
                pendingCount = bankPending;
            }
        } catch (Exception ignored) {
        }

        for (int widgetId : appWidgetIds) {
            updateWidgetView(context, appWidgetManager, widgetId, balance, account, subtext, pendingCount);
        }
    }

    public static void updateAllWidgets(Context context, String balance, String account, String subtext, Integer pendingCount) {
        if (context == null) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        if (balance != null && !balance.isEmpty()) {
            editor.putString(KEY_BALANCE, balance);
        }
        if (account != null && !account.isEmpty()) {
            editor.putString(KEY_ACCOUNT, account);
        }
        if (subtext != null && !subtext.isEmpty()) {
            editor.putString(KEY_SUBTEXT, subtext);
        }
        if (pendingCount != null) {
            editor.putInt(KEY_PENDING_COUNT, Math.max(0, pendingCount));
        }
        editor.apply();

        String activeBalance = prefs.getString(KEY_BALANCE, "₹0.00");
        String activeAccount = prefs.getString(KEY_ACCOUNT, "Total Net Worth");
        String activeSubtext = prefs.getString(KEY_SUBTEXT, "Private Local Ledger");
        int activePending = prefs.getInt(KEY_PENDING_COUNT, 0);

        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, FinanceAppWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

            for (int widgetId : appWidgetIds) {
                updateWidgetView(context, appWidgetManager, widgetId, activeBalance, activeAccount, activeSubtext, activePending);
            }
        } catch (Exception ignored) {
        }
    }

    private static void updateWidgetView(
        Context context,
        AppWidgetManager appWidgetManager,
        int widgetId,
        String balance,
        String account,
        String subtext,
        int pendingCount
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_finance_vault);

        // 1. Dynamic Luxury Gradient Background with Rounded Corners & Subtle Border
        Bitmap bgBitmap = createFinanceBackgroundBitmap(500, 240);
        if (bgBitmap != null) {
            views.setImageViewBitmap(R.id.widget_finance_bg_image, bgBitmap);
        }

        // 2. Populate Balance and Details
        views.setTextViewText(R.id.widget_finance_balance, balance != null ? balance : "₹0.00");
        views.setTextViewText(R.id.widget_finance_account, account != null ? account : "Total Net Worth");
        views.setTextViewText(R.id.widget_finance_subtext, subtext != null ? subtext : "Private Local Ledger");

        // 3. Status Badge and Review Action
        if (pendingCount > 0) {
            views.setTextViewText(R.id.widget_finance_badge, pendingCount + (pendingCount == 1 ? " to review" : " to review"));
            views.setViewVisibility(R.id.widget_finance_btn_review, View.VISIBLE);
            views.setTextViewText(R.id.widget_finance_btn_review, "Review (" + pendingCount + ")");
        } else {
            views.setTextViewText(R.id.widget_finance_badge, "Up to date");
            views.setViewVisibility(R.id.widget_finance_btn_review, View.GONE);
        }

        // 4. Tap Whole Widget or 'Open Vault' -> Open Atlas Finance
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction(ACTION_OPEN_FINANCE);
        openAppIntent.putExtra("target_route", "/secret/finance");
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
            context,
            201,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_finance_container, openAppPending);
        views.setOnClickPendingIntent(R.id.widget_finance_bg_image, openAppPending);
        views.setOnClickPendingIntent(R.id.widget_finance_btn_open, openAppPending);

        // 5. Tap 'Review' button -> Open Review Screen
        Intent reviewIntent = new Intent(context, MainActivity.class);
        reviewIntent.setAction(ACTION_REVIEW_FINANCE);
        reviewIntent.putExtra("target_route", "/secret/finance?review=1");
        reviewIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent reviewPending = PendingIntent.getActivity(
            context,
            202,
            reviewIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_finance_btn_review, reviewPending);

        try {
            appWidgetManager.updateAppWidget(widgetId, views);
        } catch (Exception ignored) {
        }
    }

    private static Bitmap createFinanceBackgroundBitmap(int width, int height) {
        try {
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            RectF rect = new RectF(1.5f, 1.5f, width - 1.5f, height - 1.5f);
            float radius = 38f;

            // Deep Emerald / Obsidian Gradient
            Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            bgPaint.setShader(new LinearGradient(
                0, 0, width, height,
                0xFF0C1914, // Deep forest emerald top
                0xFF050C09, // Obsidian dark emerald bottom
                Shader.TileMode.CLAMP
            ));
            canvas.drawRoundRect(rect, radius, radius, bgPaint);

            // Subtle Glowing Emerald Border
            Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            strokePaint.setStyle(Paint.Style.STROKE);
            strokePaint.setStrokeWidth(2.5f);
            strokePaint.setColor(0x4034D399); // Soft translucent emerald
            canvas.drawRoundRect(rect, radius, radius, strokePaint);

            return bitmap;
        } catch (Throwable ignored) {
            return null;
        }
    }
}

