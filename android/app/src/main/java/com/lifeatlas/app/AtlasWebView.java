package com.lifeatlas.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import com.getcapacitor.CapacitorWebView;

/**
 * Custom CapacitorWebView that prevents Chromium from suspending HTML5 <audio>
 * playback when the Activity window moves to the background or the device screen
 * is locked while an active Music Vault session is running.
 */
public class AtlasWebView extends CapacitorWebView {

    public AtlasWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        if (visibility != View.VISIBLE && MediaPlaybackService.shouldKeepWebViewAwake()) {
            super.onWindowVisibilityChanged(View.VISIBLE);
            return;
        }
        super.onWindowVisibilityChanged(visibility);
    }

    @Override
    public void dispatchWindowVisibilityChanged(int visibility) {
        if (visibility != View.VISIBLE && MediaPlaybackService.shouldKeepWebViewAwake()) {
            super.dispatchWindowVisibilityChanged(View.VISIBLE);
            return;
        }
        super.dispatchWindowVisibilityChanged(visibility);
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        if (visibility != View.VISIBLE && MediaPlaybackService.shouldKeepWebViewAwake()) {
            super.onVisibilityChanged(changedView, View.VISIBLE);
            return;
        }
        super.onVisibilityChanged(changedView, visibility);
    }

    @Override
    public void onPause() {
        if (MediaPlaybackService.shouldKeepWebViewAwake()) {
            return;
        }
        super.onPause();
    }
}

