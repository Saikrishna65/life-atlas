package com.lifeatlas.app;

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
            // CRITICAL: Do NOT hide navigation bars and do NOT use BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE!
            // When navigation bars are hidden, Android requires TWO swipes: first to reveal system bars,
            // second to navigate back. By keeping navigation bars unhidden (and transparent), Android's
            // edge gesture navigation triggers on the VERY FIRST single swipe!
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
                    // If network is crawling and hasn't loaded in 4.5 seconds, auto-load offline sanctuary
                    timeoutHandler.postDelayed(slowNetworkWatchdog, 4500);
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    pageLoaded = true;
                    timeoutHandler.removeCallbacks(slowNetworkWatchdog);
                }

                @Override
                public void onReceivedError(WebView webView) {
                    timeoutHandler.removeCallbacks(slowNetworkWatchdog);
                }
            });
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        timeoutHandler.removeCallbacks(slowNetworkWatchdog);
    }
}
