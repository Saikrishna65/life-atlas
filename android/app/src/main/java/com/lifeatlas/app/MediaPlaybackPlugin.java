package com.lifeatlas.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;

/**
 * Capacitor bridge plugin connecting MusicPlayerContext (WebView) with
 * Android's foreground MediaPlaybackService and Lock-Screen MediaSession.
 */
@CapacitorPlugin(
    name = "MediaPlayback",
    permissions = {
        @Permission(
            strings = { Manifest.permission.POST_NOTIFICATIONS },
            alias = "notifications"
        )
    }
)
public class MediaPlaybackPlugin extends Plugin {

    private static volatile MediaPlaybackPlugin activeInstance = null;
    private static volatile WebView activeWebView = null;
    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
    private boolean hasPromptedNotificationPermission = false;

    public static void setActiveWebView(WebView webView) {
        activeWebView = webView;
    }

    @Override
    public void load() {
        super.load();
        activeInstance = this;
        if (getBridge() != null && getBridge().getWebView() != null) {
            activeWebView = getBridge().getWebView();
        }
    }

    public static void dispatchMediaAction(final String action, final long seekPositionMs) {
        MAIN_HANDLER.post(new Runnable() {
            @Override
            public void run() {
                MediaPlaybackPlugin instance = activeInstance;
                if (instance != null) {
                    JSObject payload = new JSObject();
                    payload.put("action", action);
                    if (seekPositionMs >= 0L) {
                        payload.put("positionMs", seekPositionMs);
                    }

                    try {
                        instance.notifyListeners("mediaAction", payload, true);
                    } catch (Exception ignored) {
                    }
                }

                // Also dispatch a DOM CustomEvent directly so background/locked WebView listeners react immediately
                try {
                    WebView webView = activeWebView != null ? activeWebView : (instance != null && instance.getBridge() != null ? instance.getBridge().getWebView() : null);
                    if (webView != null) {
                        String js = "window.dispatchEvent(new CustomEvent('atlas:native-media-action', { detail: { action: '"
                            + action + "', positionMs: " + seekPositionMs + " } }));";
                        webView.evaluateJavascript(js, null);
                    }
                } catch (Exception ignored) {
                }
            }
        });
    }

    @PluginMethod
    public void updatePlayback(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.resolve();
            return;
        }

        // Immediately mark session active so AtlasWebView keeps HTMLAudioElement awake on background/lock
        MediaPlaybackService.setSessionActive(true);

        String title = call.getString("title", "Atlas Music Vault");
        String artist = call.getString("artist", "Life Atlas");
        String album = call.getString("album", "Music Vault");
        String artworkUrl = call.getString("artworkUrl", "");
        boolean isPlaying = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));
        long positionMs = getLongSafe(call, "positionMs", 0L);
        long durationMs = getLongSafe(call, "durationMs", 0L);
        float playbackRate = call.getFloat("playbackRate", 1.0f);
        String theme = call.getString("theme", null);
        if (theme != null && !theme.isEmpty()) {
            context.getSharedPreferences("life_atlas_widget_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("widget_theme", theme)
                .apply();
        }

        // On Android 13+, request POST_NOTIFICATIONS once if not yet granted so lock-screen notification can display
        if (isPlaying
            && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && !hasPromptedNotificationPermission
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            hasPromptedNotificationPermission = true;
            suppressVaultLockForPermissionDialog();
            requestPermissionForAlias("notifications", call, "onNotificationPermissionResult");
            startOrUpdateService(context, title, artist, album, artworkUrl, isPlaying, positionMs, durationMs, playbackRate);
            return;
        }

        startOrUpdateService(context, title, artist, album, artworkUrl, isPlaying, positionMs, durationMs, playbackRate);
        call.resolve();
    }

    @PermissionCallback
    private void onNotificationPermissionResult(PluginCall call) {
        releaseVaultLockSuppression();
        JSObject res = new JSObject();
        res.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(res);
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        Context context = getContext();
        MediaPlaybackService.setSessionActive(false);
        if (context != null) {
            try {
                Intent stopIntent = new Intent(context, MediaPlaybackService.class);
                stopIntent.setAction(MediaPlaybackService.ACTION_STOP);
                context.startService(stopIntent);
            } catch (Exception ignored) {
                try {
                    context.stopService(new Intent(context, MediaPlaybackService.class));
                } catch (Exception ignored2) {
                }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void setTheme(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.resolve();
            return;
        }
        String theme = call.getString("theme", "gold");
        context.getSharedPreferences("life_atlas_widget_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("widget_theme", theme)
            .apply();
        MusicAppWidgetProvider.updateAllWidgets(context, null, null, null, null);
        call.resolve();
    }

    private void startOrUpdateService(
        Context context,
        String title,
        String artist,
        String album,
        String artworkUrl,
        boolean isPlaying,
        long positionMs,
        long durationMs,
        float playbackRate
    ) {
        Intent serviceIntent = new Intent(context, MediaPlaybackService.class);
        serviceIntent.setAction(MediaPlaybackService.ACTION_UPDATE);
        serviceIntent.putExtra(MediaPlaybackService.EXTRA_TITLE, title);
        serviceIntent.putExtra(MediaPlaybackService.EXTRA_ARTIST, artist);
        serviceIntent.putExtra(MediaPlaybackService.EXTRA_ALBUM, album);
        serviceIntent.putExtra(MediaPlaybackService.EXTRA_ARTWORK_URL, artworkUrl);
        serviceIntent.putExtra(MediaPlaybackService.EXTRA_IS_PLAYING, isPlaying);
        serviceIntent.putExtra(MediaPlaybackService.EXTRA_POSITION_MS, positionMs);
        serviceIntent.putExtra(MediaPlaybackService.EXTRA_DURATION_MS, durationMs);
        serviceIntent.putExtra(MediaPlaybackService.EXTRA_PLAYBACK_RATE, playbackRate);

        try {
            if (isPlaying) {
                ContextCompat.startForegroundService(context, serviceIntent);
            } else {
                try {
                    context.startService(serviceIntent);
                } catch (IllegalStateException bgEx) {
                    ContextCompat.startForegroundService(context, serviceIntent);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private long getLongSafe(PluginCall call, String key, long fallback) {
        try {
            Double d = call.getDouble(key);
            if (d != null && !d.isNaN() && !d.isInfinite()) {
                return Math.max(0L, Math.round(d));
            }
        } catch (Exception ignored) {
        }
        try {
            Integer i = call.getInt(key);
            if (i != null) return Math.max(0L, i.longValue());
        } catch (Exception ignored) {
        }
        return fallback;
    }

    private void suppressVaultLockForPermissionDialog() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript("window.__isSystemPickerActive = true;", null);
            }
        } catch (Exception ignored) {
        }
    }

    private void releaseVaultLockSuppression() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "setTimeout(function(){ window.__isSystemPickerActive = false; }, 1000);",
                    null
                );
            }
        } catch (Exception ignored) {
        }
    }
}

