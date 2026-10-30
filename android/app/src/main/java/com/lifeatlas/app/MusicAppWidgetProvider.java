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
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;

public class MusicAppWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WIDGET_PLAY_PAUSE = "com.lifeatlas.app.ACTION_WIDGET_PLAY_PAUSE";
    public static final String ACTION_WIDGET_NEXT = "com.lifeatlas.app.ACTION_WIDGET_NEXT";
    public static final String ACTION_WIDGET_PREV = "com.lifeatlas.app.ACTION_WIDGET_PREV";

    private static final String PREFS_NAME = "life_atlas_widget_prefs";
    private static final String KEY_TITLE = "widget_title";
    private static final String KEY_ARTIST = "widget_artist";
    private static final String KEY_IS_PLAYING = "widget_is_playing";
    private static final String KEY_THEME = "widget_theme";

    private static Bitmap lastArtwork = null;

    private static class WidgetTheme {
        final int bgTop;
        final int bgBottom;
        final int strokeColor;
        final int accentColor;
        final int buttonBg;
        final int playIconColor;

        WidgetTheme(int bgTop, int bgBottom, int strokeColor, int accentColor, int buttonBg, int playIconColor) {
            this.bgTop = bgTop;
            this.bgBottom = bgBottom;
            this.strokeColor = strokeColor;
            this.accentColor = accentColor;
            this.buttonBg = buttonBg;
            this.playIconColor = playIconColor;
        }
    }

    private static WidgetTheme getThemeConfig(String themeId) {
        if ("emerald".equalsIgnoreCase(themeId)) {
            return new WidgetTheme(
                0xFF102018, // bgTop
                0xFF070E0B, // bgBottom
                0x501ED760, // strokeColor
                0xFF1ED760, // accentColor (Spotify Emerald)
                0xFF152A1F, // buttonBg
                0xFF050F09  // playIconColor (dark contrast)
            );
        } else if ("cyan".equalsIgnoreCase(themeId)) {
            return new WidgetTheme(
                0xFF0F2238, // bgTop
                0xFF060D17, // bgBottom
                0x5038BDF8, // strokeColor
                0xFF38BDF8, // accentColor (Electric Arctic Cyan)
                0xFF132B47, // buttonBg
                0xFF040E1A  // playIconColor
            );
        } else if ("alabaster".equalsIgnoreCase(themeId)) {
            return new WidgetTheme(
                0xFF26263B, // bgTop
                0xFF161624, // bgBottom
                0x50F43F5E, // strokeColor
                0xFFF43F5E, // accentColor (Crimson Coral)
                0xFF32324C, // buttonBg
                0xFFFFFFFF  // playIconColor
            );
        } else {
            // "gold" default (Champagne Gold & Midnight Slate)
            return new WidgetTheme(
                0xFF171D28, // bgTop
                0xFF0A0D14, // bgBottom
                0x50E5B869, // strokeColor
                0xFFE5B869, // accentColor (Champagne Gold)
                0xFF202738, // buttonBg
                0xFF0B0E14  // playIconColor
            );
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String title = prefs.getString(KEY_TITLE, "Music Sanctuary");
        String artist = prefs.getString(KEY_ARTIST, "Life Atlas Audio Vault");
        boolean isPlaying = prefs.getBoolean(KEY_IS_PLAYING, false);
        String themeId = prefs.getString(KEY_THEME, "gold");

        for (int widgetId : appWidgetIds) {
            updateWidgetView(context, appWidgetManager, widgetId, title, artist, lastArtwork, isPlaying, themeId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        if (ACTION_WIDGET_PLAY_PAUSE.equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean current = prefs.getBoolean(KEY_IS_PLAYING, false);
            boolean updated = !current;
            prefs.edit().putBoolean(KEY_IS_PLAYING, updated).apply();

            Intent svcIntent = new Intent(context, MediaPlaybackService.class);
            svcIntent.setAction(MediaPlaybackService.ACTION_TOGGLE);
            startServiceSafe(context, svcIntent);

            MediaPlaybackPlugin.dispatchMediaAction("toggle", -1L);

            String title = prefs.getString(KEY_TITLE, "Music Sanctuary");
            String artist = prefs.getString(KEY_ARTIST, "Life Atlas Audio Vault");
            String themeId = prefs.getString(KEY_THEME, "gold");
            updateAllWidgets(context, title, artist, lastArtwork, updated);

        } else if (ACTION_WIDGET_NEXT.equals(action)) {
            Intent svcIntent = new Intent(context, MediaPlaybackService.class);
            svcIntent.setAction(MediaPlaybackService.ACTION_NEXT);
            startServiceSafe(context, svcIntent);

            MediaPlaybackPlugin.dispatchMediaAction("next", -1L);

        } else if (ACTION_WIDGET_PREV.equals(action)) {
            Intent svcIntent = new Intent(context, MediaPlaybackService.class);
            svcIntent.setAction(MediaPlaybackService.ACTION_PREV);
            startServiceSafe(context, svcIntent);

            MediaPlaybackPlugin.dispatchMediaAction("previous", -1L);
        }
    }

    private static void startServiceSafe(Context context, Intent intent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            try {
                context.startService(intent);
            } catch (Exception ignored) {
            }
        }
    }

    public static void updateAllWidgets(Context context, String title, String artist, Bitmap artwork, Boolean isPlaying) {
        if (context == null) return;

        if (artwork != null) {
            lastArtwork = artwork;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        if (title != null && !title.isEmpty()) {
            editor.putString(KEY_TITLE, title);
        }
        if (artist != null && !artist.isEmpty()) {
            editor.putString(KEY_ARTIST, artist);
        }
        if (isPlaying != null) {
            editor.putBoolean(KEY_IS_PLAYING, isPlaying);
        }
        editor.apply();

        String activeTitle = prefs.getString(KEY_TITLE, "Music Sanctuary");
        String activeArtist = prefs.getString(KEY_ARTIST, "Life Atlas Audio Vault");
        boolean activePlaying = prefs.getBoolean(KEY_IS_PLAYING, false);
        String themeId = prefs.getString(KEY_THEME, "gold");

        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, MusicAppWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

            for (int widgetId : appWidgetIds) {
                updateWidgetView(context, appWidgetManager, widgetId, activeTitle, activeArtist, lastArtwork, activePlaying, themeId);
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
        boolean isPlaying,
        String themeId
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_music_vault);
        WidgetTheme theme = getThemeConfig(themeId);

        // 1. Dynamic Theme Background
        Bitmap bgBitmap = createThemeBackgroundBitmap(theme, 400, 160);
        if (bgBitmap != null) {
            views.setImageViewBitmap(R.id.widget_bg_image, bgBitmap);
        }

        // 2. Artwork with Sonic Ring Glow
        Bitmap artworkBitmap = createArtworkWithSonicRing(context, artwork, isPlaying, theme.accentColor, 200);
        if (artworkBitmap != null) {
            views.setImageViewBitmap(R.id.widget_artwork, artworkBitmap);
        } else {
            views.setImageViewResource(R.id.widget_artwork, R.drawable.ic_stat_music);
        }

        // 3. Dynamic Animated-style Equalizer Waveform Indicator
        if (isPlaying) {
            Bitmap visualizer = createEqualizerWaveformBitmap(120, 48, theme.accentColor);
            if (visualizer != null) {
                views.setViewVisibility(R.id.widget_visualizer, View.VISIBLE);
                views.setImageViewBitmap(R.id.widget_visualizer, visualizer);
            } else {
                views.setViewVisibility(R.id.widget_visualizer, View.GONE);
            }
        } else {
            views.setViewVisibility(R.id.widget_visualizer, View.GONE);
        }

        // 4. Prev & Next Buttons (Themed surface circle with white icons)
        Bitmap prevBmp = createCircleButtonBitmap(context, 100, theme.buttonBg, R.drawable.ic_media_prev, 0xFFFFFFFF);
        if (prevBmp != null) {
            views.setImageViewBitmap(R.id.widget_btn_prev, prevBmp);
        }
        Bitmap nextBmp = createCircleButtonBitmap(context, 100, theme.buttonBg, R.drawable.ic_media_next, 0xFFFFFFFF);
        if (nextBmp != null) {
            views.setImageViewBitmap(R.id.widget_btn_next, nextBmp);
        }

        // 5. Play / Pause Button (Themed Glowing Accent Circle)
        int playIconRes = isPlaying ? R.drawable.ic_media_pause : R.drawable.ic_media_play;
        Bitmap playBmp = createCircleButtonBitmap(context, 130, theme.accentColor, playIconRes, theme.playIconColor);
        if (playBmp != null) {
            views.setImageViewBitmap(R.id.widget_btn_play, playBmp);
        }

        // Tap widget background or artwork -> open Music Vault directly
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
        views.setOnClickPendingIntent(R.id.widget_bg_image, openAppPending);
        views.setOnClickPendingIntent(R.id.widget_artwork, openAppPending);

        // Play/Pause button action
        Intent playPauseIntent = new Intent(context, MusicAppWidgetProvider.class);
        playPauseIntent.setAction(ACTION_WIDGET_PLAY_PAUSE);
        PendingIntent playPausePending = PendingIntent.getBroadcast(
            context,
            1,
            playPauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_play, playPausePending);

        // Next button action
        Intent nextIntent = new Intent(context, MusicAppWidgetProvider.class);
        nextIntent.setAction(ACTION_WIDGET_NEXT);
        PendingIntent nextPending = PendingIntent.getBroadcast(
            context,
            2,
            nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_next, nextPending);

        // Prev button action
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

    private static Bitmap createThemeBackgroundBitmap(WidgetTheme theme, int w, int h) {
        try {
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bmp);

            RectF rect = new RectF(1.5f, 1.5f, w - 1.5f, h - 1.5f);
            float cornerRadius = 56f;

            Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            bgPaint.setShader(new LinearGradient(
                0, 0, w, h,
                theme.bgTop,
                theme.bgBottom,
                Shader.TileMode.CLAMP
            ));
            canvas.drawRoundRect(rect, cornerRadius, cornerRadius, bgPaint);

            Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            strokePaint.setStyle(Paint.Style.STROKE);
            strokePaint.setStrokeWidth(2.5f);
            strokePaint.setColor(theme.strokeColor);
            canvas.drawRoundRect(rect, cornerRadius, cornerRadius, strokePaint);

            return bmp;
        } catch (Exception e) {
            return null;
        }
    }

    private static Bitmap createArtworkWithSonicRing(Context context, Bitmap artwork, boolean isPlaying, int accentColor, int size) {
        try {
            Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);

            float padding = isPlaying ? 10f : 4f;
            RectF artworkRect = new RectF(padding, padding, size - padding, size - padding);
            float radius = 34f;

            if (isPlaying) {
                // Outer glowing sonic ring
                Paint auraPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                auraPaint.setStyle(Paint.Style.STROKE);
                auraPaint.setStrokeWidth(4f);
                auraPaint.setColor(accentColor);
                canvas.drawRoundRect(new RectF(2f, 2f, size - 2f, size - 2f), radius + 4f, radius + 4f, auraPaint);
            }

            // Draw rounded artwork
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            canvas.drawRoundRect(artworkRect, radius, radius, paint);

            paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
            if (artwork != null) {
                Rect src = new Rect(0, 0, artwork.getWidth(), artwork.getHeight());
                Rect dst = new Rect((int) artworkRect.left, (int) artworkRect.top, (int) artworkRect.right, (int) artworkRect.bottom);
                canvas.drawBitmap(artwork, src, dst, paint);
            } else {
                Drawable d = ContextCompat.getDrawable(context, R.drawable.ic_stat_music);
                if (d != null) {
                    d.setBounds((int) artworkRect.left, (int) artworkRect.top, (int) artworkRect.right, (int) artworkRect.bottom);
                    d.draw(canvas);
                }
            }

            return output;
        } catch (Exception e) {
            return artwork;
        }
    }

    private static Bitmap createEqualizerWaveformBitmap(int w, int h, int accentColor) {
        try {
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bmp);

            Paint barPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            barPaint.setColor(accentColor);
            barPaint.setStyle(Paint.Style.FILL);

            // 5 dynamic rhythm bars with varying heights
            float[] barHeights = new float[]{0.70f, 0.40f, 0.95f, 0.55f, 0.85f};
            int numBars = barHeights.length;
            float barWidth = 6.5f;
            float spacing = (w - (numBars * barWidth)) / (numBars + 1);

            for (int i = 0; i < numBars; i++) {
                float left = spacing + i * (barWidth + spacing);
                float right = left + barWidth;
                float barH = h * barHeights[i];
                float top = h - barH;
                float bottom = h;

                RectF r = new RectF(left, top, right, bottom);
                canvas.drawRoundRect(r, barWidth / 2f, barWidth / 2f, barPaint);
            }

            return bmp;
        } catch (Exception e) {
            return null;
        }
    }

    private static Bitmap createCircleButtonBitmap(Context context, int size, int bgColor, int iconRes, int iconColor) {
        try {
            Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bmp);

            Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            bgPaint.setColor(bgColor);
            canvas.drawCircle(size / 2f, size / 2f, size / 2f, bgPaint);

            Drawable icon = ContextCompat.getDrawable(context, iconRes);
            if (icon != null) {
                int iconSize = (int) (size * 0.44f);
                int left = (size - iconSize) / 2;
                int top = (size - iconSize) / 2;
                icon.setBounds(left, top, left + iconSize, top + iconSize);
                icon.setTint(iconColor);
                icon.draw(canvas);
            }

            return bmp;
        } catch (Exception e) {
            return null;
        }
    }
}
