package com.lifeatlas.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private boolean pageLoaded = false;
    private String pendingShareUrl = null;

    private final Runnable slowNetworkWatchdog = new Runnable() {
        @Override
        public void run() {
            if (!pageLoaded && getBridge() != null && getBridge().getWebView() != null) {
                String errorUrl = getBridge().getErrorUrl();
                if (errorUrl != null) {
                    getBridge().getWebView().loadUrl(errorUrl);
                }
            }
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleSendIntent(getIntent());

        // Append custom User-Agent so backend middleware strictly routes native app to private atlas
        if (getBridge() != null && getBridge().getWebView() != null) {
            String defaultUA = getBridge().getWebView().getSettings().getUserAgentString();
            if (defaultUA != null && !defaultUA.contains("LifeAtlasApp")) {
                getBridge().getWebView().getSettings().setUserAgentString(defaultUA + " LifeAtlasApp/1.0");
            }
        }

        // Enable true edge-to-edge layout so content draws behind system bars
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Make system bars completely transparent for seamless edge-to-edge display
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
            getWindow().setStatusBarContrastEnforced(false);
        }

        WindowInsetsControllerCompat windowInsetsController =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (windowInsetsController != null) {
            windowInsetsController.show(WindowInsetsCompat.Type.navigationBars());
            windowInsetsController.setAppearanceLightStatusBars(false);
            windowInsetsController.setAppearanceLightNavigationBars(false);
        }

        // Fast-fail watchdog for crawling / ultra-slow 2G networks
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageStarted(WebView webView) {
                    pageLoaded = false;
                    timeoutHandler.removeCallbacks(slowNetworkWatchdog);
                    timeoutHandler.postDelayed(slowNetworkWatchdog, 4500);

                    if (pendingShareUrl != null && webView != null) {
                        try {
                            final String safeUrl = pendingShareUrl.replace("'", "\\'");
                            webView.evaluateJavascript(
                                "try {" +
                                "  window.sessionStorage.removeItem('life_atlas_secret_unlocked');" +
                                "  window.localStorage.removeItem('life_atlas_secret_unlocked');" +
                                "  window.localStorage.setItem('pending_youtube_share_url', '" + safeUrl + "');" +
                                "} catch (e) {}",
                                null
                            );
                        } catch (Exception ignored) {
                        }
                    }
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    pageLoaded = true;
                    timeoutHandler.removeCallbacks(slowNetworkWatchdog);
                    dispatchPendingShareUrl();
                }

                @Override
                public void onReceivedError(WebView webView) {
                    timeoutHandler.removeCallbacks(slowNetworkWatchdog);
                }
            });
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSendIntent(intent);
    }

    private void handleSendIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null && "text/plain".equals(type)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null && (sharedText.contains("youtube.com") || sharedText.contains("youtu.be"))) {
                pendingShareUrl = extractYouTubeUrl(sharedText);
                dispatchPendingShareUrl();
            }
        }
    }

    private String extractYouTubeUrl(String text) {
        if (text == null) return null;
        try {
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
                "https?://(?:www\\.)?(?:youtube\\.com/(?:watch\\?v=[a-zA-Z0-9_-]+|shorts/[a-zA-Z0-9_-]+|embed/[a-zA-Z0-9_-]+)|youtu\\.be/[a-zA-Z0-9_-]+)[^\\s]*"
            );
            java.util.regex.Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                return matcher.group(0);
            }
        } catch (Exception ignored) {
        }
        return text.trim();
    }

    private void dispatchPendingShareUrl() {
        if (pendingShareUrl != null && pageLoaded && getBridge() != null && getBridge().getWebView() != null) {
            try {
                final String safeUrl = pendingShareUrl.replace("'", "\\'");
                String script =
                    "try {" +
                    "  window.sessionStorage.removeItem('life_atlas_secret_unlocked');" +
                    "  window.localStorage.removeItem('life_atlas_secret_unlocked');" +
                    "  window.localStorage.setItem('pending_youtube_share_url', '" + safeUrl + "');" +
                    "  window.dispatchEvent(new Event('vault-locked'));" +
                    "  if (!window.location.pathname.startsWith('/secret/music')) {" +
                    "    window.location.href = '/secret/music?youtube_url=' + encodeURIComponent('" + safeUrl + "');" +
                    "  } else {" +
                    "    window.dispatchEvent(new CustomEvent('lifeatlas_youtube_share', { detail: { url: '" + safeUrl + "', requireAuth: true } }));" +
                    "  }" +
                    "} catch (e) { console.error('Share dispatch error', e); }";
                getBridge().getWebView().evaluateJavascript(script, null);
                pendingShareUrl = null;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "try {" +
                "  window.sessionStorage.removeItem('life_atlas_secret_unlocked');" +
                "  window.dispatchEvent(new Event('vault-locked'));" +
                "} catch (e) {}",
                null
            );
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "try {" +
                "  window.dispatchEvent(new Event('app-resumed'));" +
                "} catch (e) {}",
                null
            );
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        timeoutHandler.removeCallbacks(slowNetworkWatchdog);
    }
}
