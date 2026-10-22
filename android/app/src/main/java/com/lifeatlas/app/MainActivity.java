package com.lifeatlas.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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
    }
}
