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
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.widget.RemoteViews;

public class MusicAppWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WIDGET_PLAY_PAUSE = "com.lifeatlas.app.ACTION_WIDGET_PLAY_PAUSE";
    public static final String ACTION_WIDGET_NEXT = "com.lifeatlas.app.ACTION_WIDGET_NEXT";
    public static final String ACTION_WIDGET_PREV = "com.lifeatlas.app.ACTION_WIDGET_PREV";

    private static final String PREFS_NAME = "life_atlas_widget_prefs";
    private static final String KEY_TITLE = "widget_title";
    private static final String KEY_ARTIST = "widget_artist";
    private static final String KEY_IS_PLAYING = "widget_is_playing";

    private static Bitmap lastArtwork = null;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String title = prefs.getString(KEY_TITLE, "Music Sanctuary");
        String artist = prefs.getString(KEY_ARTIST, "Life Atlas Audio Vault");
        boolean isPlaying = prefs.getBoolean(KEY_IS_PLAYING, false);

        for (int widgetId : appWidgetIds) {
            updateWidgetView(context, appWidgetManager, widgetId, title, artist, lastArtwork, isPlaying);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        if (ACTION_WIDGET_PLAY_PAUSE.equals(action)) {
            MediaPlaybackPlugin.dispatchMediaAction("playPause", -1L);
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean current = prefs.getBoolean(KEY_IS_PLAYING, false);
            boolean updated = !current;
            prefs.edit().putBoolean(KEY_IS_PLAYING, updated).apply();

            String title = prefs.getString(KEY_TITLE, "Music Sanctuary");
            String artist = prefs.getString(KEY_ARTIST, "Life Atlas Audio Vault");
            updateAllWidgets(context, title, artist, lastArtwork, updated);

        } else if (ACTION_WIDGET_NEXT.equals(action)) {
            MediaPlaybackPlugin.dispatchMediaAction("next", -1L);

        } else if (ACTION_WIDGET_PREV.equals(action)) {
            MediaPlaybackPlugin.dispatchMediaAction("prev", -1L);
        }
    }

    public static void updateAllWidgets(Context context, String title, String artist, Bitmap artwork, boolean isPlaying) {
        if (context == null) return;

        if (artwork != null) {
            lastArtwork = artwork;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_TITLE, title != null && !title.isEmpty() ? title : "Music Sanctuary")
            .putString(KEY_ARTIST, artist != null && !artist.isEmpty() ? artist : "Life Atlas Audio Vault")
            .putBoolean(KEY_IS_PLAYING, isPlaying)
            .apply();

        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, MusicAppWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

            for (int widgetId : appWidgetIds) {
                updateWidgetView(context, appWidgetManager, widgetId, title, artist, lastArtwork, isPlaying);
            }
        } catch (Exception ignored) {
        }
    }

    private static void updateWidgetView(
        Context context,
        AppWidgetManager appWidgetManager,
        int widgetId,
        String title,
        String artist,
        Bitmap artwork,
        boolean isPlaying
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_music_vault);

        // Titles and artist
        String displayTitle = (title != null && !title.isEmpty()) ? title : "Music Sanctuary";
        String displayArtist = (artist != null && !artist.isEmpty()) ? artist : "Life Atlas Audio Vault";

        views.setTextViewText(R.id.widget_title, displayTitle);
        views.setTextViewText(R.id.widget_artist, displayArtist);
        views.setTextViewText(
            R.id.widget_badge,
            isPlaying ? "● PLAYING · HI-FI" : "✦ MUSIC VAULT · READY"
        );

        // Play/Pause icon
        if (isPlaying) {
            views.setImageViewResource(R.id.widget_btn_play, R.drawable.ic_media_pause);
        } else {
            views.setImageViewResource(R.id.widget_btn_play, R.drawable.ic_media_play);
        }

        // Artwork
        if (artwork != null) {
            try {
                Bitmap rounded = getRoundedCornerBitmap(artwork, 24);
                views.setImageViewBitmap(R.id.widget_artwork, rounded);
            } catch (Exception e) {
                views.setImageViewResource(R.id.widget_artwork, R.drawable.ic_stat_music);
            }
        } else {
            views.setImageViewResource(R.id.widget_artwork, R.drawable.ic_stat_music);
        }

        // Tap widget or Vault button -> open Music Vault directly
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction("com.lifeatlas.app.ACTION_OPEN_MUSIC_VAULT");
        openAppIntent.putExtra("target_route", "/secret/music");
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, openAppPending);
        views.setOnClickPendingIntent(R.id.widget_btn_vault, openAppPending);
        views.setOnClickPendingIntent(R.id.widget_turntable_frame, openAppPending);

        // Play/Pause button
        Intent playPauseIntent = new Intent(context, MusicAppWidgetProvider.class);
        playPauseIntent.setAction(ACTION_WIDGET_PLAY_PAUSE);
        PendingIntent playPausePending = PendingIntent.getBroadcast(
            context,
            1,
            playPauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_play, playPausePending);

        // Next button
        Intent nextIntent = new Intent(context, MusicAppWidgetProvider.class);
        nextIntent.setAction(ACTION_WIDGET_NEXT);
        PendingIntent nextPending = PendingIntent.getBroadcast(
            context,
            2,
            nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_next, nextPending);

        // Prev button
        Intent prevIntent = new Intent(context, MusicAppWidgetProvider.class);
        prevIntent.setAction(ACTION_WIDGET_PREV);
        PendingIntent prevPending = PendingIntent.getBroadcast(
            context,
            3,
            prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_prev, prevPending);

        appWidgetManager.updateAppWidget(widgetId, views);
    }

    private static Bitmap getRoundedCornerBitmap(Bitmap bitmap, int pixels) {
        if (bitmap == null) return null;
        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        final int color = 0xff424242;
        final Paint paint = new Paint();
        final Rect rect = new Rect(0, 0, size, size);
        final RectF rectF = new RectF(rect);
        final float roundPx = pixels;

        paint.setAntiAlias(true);
        canvas.drawARGB(0, 0, 0, 0);
        paint.setColor(color);
        canvas.drawRoundRect(rectF, roundPx, roundPx, paint);

        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        int left = (bitmap.getWidth() - size) / 2;
        int top = (bitmap.getHeight() - size) / 2;
        Rect src = new Rect(left, top, left + size, top + size);
        canvas.drawBitmap(bitmap, src, rect, paint);

        return output;
    }
}

