package com.lifeatlas.app.wakeword

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Lightweight broadcast receiver invoked for periodic 15-minute snapshots during
 * baseline overnight endurance tests. Operates without holding continuous wake locks.
 */
class OvernightSnapshotReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        OvernightTestManager.takePeriodicSnapshotIfNeeded(
            context = context,
            isMicActuallyCapturing = false
        )
    }
}
