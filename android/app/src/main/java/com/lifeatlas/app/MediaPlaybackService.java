package com.lifeatlas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Base64;
import android.util.LruCache;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground MediaPlaybackService that keeps Music Vault audio alive when the app
 * is minimized, in Recent Apps, or when the device screen is locked, and publishes
 * a fixed Lock-Screen & Notification-Shade MediaSession controller.
 */
public class MediaPlaybackService extends Service {

    public static final String CHANNEL_ID = "atlas_music_playback_channel";
    public static final int NOTIFICATION_ID = 8411;

    public static final String ACTION_UPDATE = "com.lifeatlas.app.media.UPDATE";
    public static final String ACTION_PLAY = "com.lifeatlas.app.media.PLAY";
    public static final String ACTION_PAUSE = "com.lifeatlas.app.media.PAUSE";
    public static final String ACTION_TOGGLE = "com.lifeatlas.app.media.TOGGLE";
    public static final String ACTION_NEXT = "com.lifeatlas.app.media.NEXT";
    public static final String ACTION_PREV = "com.lifeatlas.app.media.PREV";
    public static final String ACTION_STOP = "com.lifeatlas.app.media.STOP";
    public static final String ACTION_NOTIFICATION_DELETED = "com.lifeatlas.app.media.NOTIFICATION_DELETED";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_ARTWORK_URL = "artworkUrl";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_DURATION_MS = "durationMs";
    public static final String EXTRA_PLAYBACK_RATE = "playbackRate";

    private static volatile boolean sessionActive = false;

    public static boolean shouldKeepWebViewAwake() {
        return sessionActive;
    }

    public static void setSessionActive(boolean active) {
        sessionActive = active;
    }

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();
    private final LruCache<String, Bitmap> artworkCache = new LruCache<>(12);

    private NotificationManager notificationManager;
    private MediaSession mediaSession;
    private AudioManager audioManager;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    private String currentTitle = "Atlas Music Vault";
    private String currentArtist = "Life Atlas";
    private String currentAlbum = "Music Vault";
    private String currentArtworkUrl = "";
    private Bitmap currentArtworkBitmap = null;
    private Bitmap fallbackArtworkBitmap = null;
    private boolean isPlaying = false;
    private long positionMs = 0L;
    private long durationMs = 0L;
    private float playbackRate = 1.0f;
    private boolean isForeground = false;
    private boolean noisyReceiverRegistered = false;

    private final BroadcastReceiver becomingNoisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction()) && isPlaying) {
                MediaPlaybackPlugin.dispatchMediaAction("pause", -1L);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();
        initMediaSession();
        initLocks();
        fallbackArtworkBitmap = createFallbackVinylBitmap();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager != null) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Vault Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Ongoing playback controls and lock-screen player for Atlas Music Vault");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSession(this, "LifeAtlasMusicSession");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            @SuppressWarnings("deprecation")
            int flags = MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS;
            mediaSession.setFlags(flags);
        }

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        mediaSession.setSessionActivity(PendingIntent.getActivity(this, 100, openIntent, piFlags));

        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                MediaPlaybackPlugin.dispatchMediaAction("play", -1L);
            }

            @Override
            public void onPause() {
                MediaPlaybackPlugin.dispatchMediaAction("pause", -1L);
            }

            @Override
            public void onSkipToNext() {
                MediaPlaybackPlugin.dispatchMediaAction("next", -1L);
            }

            @Override
            public void onSkipToPrevious() {
                MediaPlaybackPlugin.dispatchMediaAction("previous", -1L);
            }

            @Override
            public void onSeekTo(long pos) {
                positionMs = Math.max(0L, pos);
                publishSessionAndNotification();
                MediaPlaybackPlugin.dispatchMediaAction("seek", positionMs);
            }

            @Override
            public void onStop() {
                MediaPlaybackPlugin.dispatchMediaAction("stop", -1L);
                stopSessionAndService();
            }
        });

        mediaSession.setActive(true);
    }

    private void initLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LifeAtlas::MediaPlaybackWakeLock");
                wakeLock.setReferenceCounted(false);
            }
        } catch (Exception ignored) {
        }

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                    : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                wifiLock = wm.createWifiLock(mode, "LifeAtlas::MediaPlaybackWifiLock");
                wifiLock.setReferenceCounted(false);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_STICKY;
        }

        String action = intent.getAction();
        if (action == null || ACTION_UPDATE.equals(action)) {
            sessionActive = true;

            String newTitle = intent.getStringExtra(EXTRA_TITLE);
            String newArtist = intent.getStringExtra(EXTRA_ARTIST);
            String newAlbum = intent.getStringExtra(EXTRA_ALBUM);
            String newArtworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL);

            if (newTitle != null && !newTitle.isEmpty()) currentTitle = newTitle;
            if (newArtist != null && !newArtist.isEmpty()) currentArtist = newArtist;
            if (newAlbum != null && !newAlbum.isEmpty()) currentAlbum = newAlbum;

            isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, isPlaying);
            positionMs = Math.max(0L, intent.getLongExtra(EXTRA_POSITION_MS, positionMs));
            durationMs = Math.max(0L, intent.getLongExtra(EXTRA_DURATION_MS, durationMs));
            playbackRate = intent.getFloatExtra(EXTRA_PLAYBACK_RATE, 1.0f);
            if (playbackRate <= 0f) playbackRate = 1.0f;

            if (newArtworkUrl != null && !newArtworkUrl.equals(currentArtworkUrl)) {
                currentArtworkUrl = newArtworkUrl;
                if (newArtworkUrl.isEmpty()) {
                    currentArtworkBitmap = null;
                } else {
                    Bitmap cached = artworkCache.get(newArtworkUrl);
                    if (cached != null) {
                        currentArtworkBitmap = cached;
                    } else {
                        currentArtworkBitmap = null;
                        loadArtworkAsync(newArtworkUrl);
                    }
                }
            }

            updateLocksAndFocus(isPlaying);
            publishSessionAndNotification();
            return START_STICKY;
        }

        switch (action) {
            case ACTION_PLAY:
                isPlaying = true;
                updateLocksAndFocus(true);
                publishSessionAndNotification();
                MediaPlaybackPlugin.dispatchMediaAction("play", -1L);
                break;
            case ACTION_PAUSE:
                isPlaying = false;
                updateLocksAndFocus(false);
                publishSessionAndNotification();
                MediaPlaybackPlugin.dispatchMediaAction("pause", -1L);
                break;
            case ACTION_TOGGLE:
                isPlaying = !isPlaying;
                updateLocksAndFocus(isPlaying);
                publishSessionAndNotification();
                MediaPlaybackPlugin.dispatchMediaAction(isPlaying ? "play" : "pause", -1L);
                break;
            case ACTION_NEXT:
                MediaPlaybackPlugin.dispatchMediaAction("next", -1L);
                break;
            case ACTION_PREV:
                MediaPlaybackPlugin.dispatchMediaAction("previous", -1L);
                break;
            case ACTION_NOTIFICATION_DELETED:
                if (isPlaying) {
                    // Song is actively playing: immediately re-pin the fixed notification!
                    publishSessionAndNotification();
                } else {
                    MediaPlaybackPlugin.dispatchMediaAction("stop", -1L);
                    stopSessionAndService();
                }
                break;
            case ACTION_STOP:
                MediaPlaybackPlugin.dispatchMediaAction("stop", -1L);
                stopSessionAndService();
                break;
            default:
                break;
        }

        return START_STICKY;
    }

    private void updateLocksAndFocus(boolean playing) {
        if (playing) {
            registerNoisyReceiver();
            try {
                if (wakeLock != null) {
                    // 30-minute safety lease renewed on every metadata/position sync
                    wakeLock.acquire(30 * 60 * 1000L);
                }
            } catch (Exception ignored) {
            }
            try {
                if (wifiLock != null && !wifiLock.isHeld()) {
                    wifiLock.acquire();
                }
            } catch (Exception ignored) {
            }
        } else {
            unregisterNoisyReceiver();
            releaseWakeAndWifiLocks();
        }
    }

    private void registerNoisyReceiver() {
        if (noisyReceiverRegistered) return;
        try {
            IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(becomingNoisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(becomingNoisyReceiver, filter);
            }
            noisyReceiverRegistered = true;
        } catch (Exception ignored) {
        }
    }

    private void unregisterNoisyReceiver() {
        if (!noisyReceiverRegistered) return;
        try {
            unregisterReceiver(becomingNoisyReceiver);
        } catch (Exception ignored) {
        }
        noisyReceiverRegistered = false;
    }

    private void releaseWakeAndWifiLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {
        }
        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception ignored) {
        }
    }

    private void publishSessionAndNotification() {
        if (mediaSession == null) return;

        Bitmap art = currentArtworkBitmap != null ? currentArtworkBitmap : fallbackArtworkBitmap;

        MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, currentAlbum)
            .putString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST, currentArtist)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, currentArtist)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION, currentAlbum)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs > 0 ? durationMs : -1L);

        if (art != null) {
            metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
            metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ART, art);
            metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON, art);
        }
        mediaSession.setMetadata(metaBuilder.build());

        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_SEEK_TO
            | PlaybackState.ACTION_STOP;

        int stateCode = isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        float speed = isPlaying ? playbackRate : 0f;

        PlaybackState playbackState = new PlaybackState.Builder()
            .setActions(actions)
            .setState(stateCode, positionMs, speed, SystemClock.elapsedRealtime())
            .build();
        mediaSession.setPlaybackState(playbackState);
        mediaSession.setActive(true);

        Notification notification = buildMediaNotification(art);

        try {
            if (isPlaying || !isForeground) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                    );
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
                isForeground = true;
            } else if (notificationManager != null) {
                notificationManager.notify(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            if (notificationManager != null) {
                notificationManager.notify(NOTIFICATION_ID, notification);
            }
        }

        try {
            MusicAppWidgetProvider.updateAllWidgets(this, currentTitle, currentArtist, art, isPlaying);
        } catch (Exception ignored) {
        }
    }

    private Notification buildMediaNotification(Bitmap art) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            @SuppressWarnings("deprecation")
            Notification.Builder legacy = new Notification.Builder(this);
            builder = legacy;
        }

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(this, 101, openIntent, piFlags);

        PendingIntent prevIntent = buildServiceActionIntent(ACTION_PREV, 201);
        PendingIntent toggleIntent = buildServiceActionIntent(isPlaying ? ACTION_PAUSE : ACTION_PLAY, 202);
        PendingIntent nextIntent = buildServiceActionIntent(ACTION_NEXT, 203);
        PendingIntent stopIntent = buildServiceActionIntent(ACTION_STOP, 204);
        PendingIntent deleteIntent = buildServiceActionIntent(ACTION_NOTIFICATION_DELETED, 205);

        Notification.Action prevAction = new Notification.Action.Builder(
            R.drawable.ic_media_prev,
            "Previous",
            prevIntent
        ).build();

        Notification.Action playPauseAction = new Notification.Action.Builder(
            isPlaying ? R.drawable.ic_media_pause : R.drawable.ic_media_play,
            isPlaying ? "Pause" : "Play",
            toggleIntent
        ).build();

        Notification.Action nextAction = new Notification.Action.Builder(
            R.drawable.ic_media_next,
            "Next",
            nextIntent
        ).build();

        builder
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText(currentAlbum)
            .setContentIntent(contentPendingIntent)
            .setDeleteIntent(deleteIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setOngoing(isPlaying)
            .setAutoCancel(false)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            .setColor(Color.parseColor("#E5B869"))
            .setColorized(true)
            .addAction(prevAction)
            .addAction(playPauseAction)
            .addAction(nextAction);

        if (!isPlaying) {
            Notification.Action closeAction = new Notification.Action.Builder(
                R.drawable.ic_media_close,
                "Close",
                stopIntent
            ).build();
            builder.addAction(closeAction);
        }

        if (art != null) {
            builder.setLargeIcon(art);
        }

        Notification.MediaStyle mediaStyle = new Notification.MediaStyle()
            .setMediaSession(mediaSession.getSessionToken())
            .setShowActionsInCompactView(0, 1, 2);

        builder.setStyle(mediaStyle);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }

        Notification notification = builder.build();
        if (isPlaying) {
            notification.flags |= Notification.FLAG_ONGOING_EVENT | Notification.FLAG_NO_CLEAR;
        }
        return notification;
    }

    private PendingIntent buildServiceActionIntent(String action, int requestCode) {
        Intent intent = new Intent(this, MediaPlaybackService.class);
        intent.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getService(this, requestCode, intent, flags);
    }

    private void loadArtworkAsync(final String urlStr) {
        artworkExecutor.execute(new Runnable() {
            @Override
            public void run() {
                Bitmap decoded = fetchAndScaleBitmap(urlStr);
                if (decoded != null) {
                    artworkCache.put(urlStr, decoded);
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            if (urlStr.equals(currentArtworkUrl) && sessionActive) {
                                currentArtworkBitmap = decoded;
                                publishSessionAndNotification();
                            }
                        }
                    });
                }
            }
        });
    }

    private Bitmap fetchAndScaleBitmap(String urlStr) {
        try {
            byte[] rawBytes;
            if (urlStr.startsWith("data:image")) {
                int comma = urlStr.indexOf(',');
                if (comma < 0) return null;
                rawBytes = Base64.decode(urlStr.substring(comma + 1), Base64.DEFAULT);
            } else if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
                HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(8000);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) LifeAtlasApp/1.0");
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    conn.disconnect();
                    return null;
                }
                try (InputStream is = conn.getInputStream();
                     ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = is.read(buf)) != -1) {
                        baos.write(buf, 0, n);
                        if (baos.size() > 4 * 1024 * 1024) break;
                    }
                    rawBytes = baos.toByteArray();
                } finally {
                    conn.disconnect();
                }
            } else {
                return null;
            }

            if (rawBytes == null || rawBytes.length == 0) return null;

            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

            int maxDim = 384;
            int sample = 1;
            while ((bounds.outWidth / sample) > maxDim * 2 || (bounds.outHeight / sample) > maxDim * 2) {
                sample *= 2;
            }

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = sample;
            opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            Bitmap bmp = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.length, opts);
            if (bmp == null) return null;

            // Center-crop to 1:1 square so 16:9 thumbnails (like YouTube) have zero black bars
            int minDim = Math.min(bmp.getWidth(), bmp.getHeight());
            int x = (bmp.getWidth() - minDim) / 2;
            int y = (bmp.getHeight() - minDim) / 2;
            Bitmap square = Bitmap.createBitmap(bmp, x, y, minDim, minDim);
            if (square != bmp) bmp.recycle();

            int targetDim = 512;
            Bitmap scaled = Bitmap.createScaledBitmap(square, targetDim, targetDim, true);
            if (scaled != square) square.recycle();
            return scaled;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Bitmap createFallbackVinylBitmap() {
        int size = 512;
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);

        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setShader(new LinearGradient(
            0, 0, size, size,
            Color.parseColor("#141822"),
            Color.parseColor("#090B0F"),
            Shader.TileMode.CLAMP
        ));
        canvas.drawRect(0, 0, size, size, bgPaint);

        Paint discPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        discPaint.setColor(Color.parseColor("#1C202B"));
        canvas.drawCircle(size / 2f, size / 2f, 210f, discPaint);

        Paint groovePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        groovePaint.setStyle(Paint.Style.STROKE);
        groovePaint.setStrokeWidth(3f);
        groovePaint.setColor(Color.parseColor("#2A3040"));
        canvas.drawCircle(size / 2f, size / 2f, 180f, groovePaint);
        canvas.drawCircle(size / 2f, size / 2f, 150f, groovePaint);
        canvas.drawCircle(size / 2f, size / 2f, 120f, groovePaint);

        Paint labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        labelPaint.setColor(Color.parseColor("#E5B869"));
        canvas.drawCircle(size / 2f, size / 2f, 75f, labelPaint);

        Paint spindlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        spindlePaint.setColor(Color.parseColor("#090B0F"));
        canvas.drawCircle(size / 2f, size / 2f, 18f, spindlePaint);

        return bmp;
    }

    private void stopSessionAndService() {
        sessionActive = false;
        isPlaying = false;
        unregisterNoisyReceiver();
        releaseWakeAndWifiLocks();

        if (mediaSession != null) {
            try {
                PlaybackState stopped = new PlaybackState.Builder()
                    .setState(PlaybackState.STATE_STOPPED, 0L, 0f, SystemClock.elapsedRealtime())
                    .build();
                mediaSession.setPlaybackState(stopped);
                mediaSession.setActive(false);
            } catch (Exception ignored) {
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                @SuppressWarnings("deprecation")
                boolean remove = true;
                stopForeground(remove);
            }
        } catch (Exception ignored) {
        }
        isForeground = false;

        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }

        try {
            MusicAppWidgetProvider.updateAllWidgets(this, currentTitle, currentArtist, null, false);
        } catch (Exception ignored) {
        }

        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // User explicitly swiped the app away from Recent Apps -> stop playback cleanly
        MediaPlaybackPlugin.dispatchMediaAction("stop", -1L);
        stopSessionAndService();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        sessionActive = false;
        unregisterNoisyReceiver();
        releaseWakeAndWifiLocks();
        artworkExecutor.shutdownNow();
        if (mediaSession != null) {
            try {
                mediaSession.setActive(false);
                mediaSession.release();
            } catch (Exception ignored) {
            }
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

