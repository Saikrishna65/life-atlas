package com.lifeatlas.app.r2;

import android.app.ActivityManager;
import android.content.Context;
import android.os.*;
import org.json.JSONObject;

/**
 * Shared gates for optional background AI, never for opening local photos or reading saved results.
 */
final class GalleryAiBudget {
  static String reason(Context context) {
    PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
    if (power != null && power.isPowerSaveMode()) return "battery-saver";
    if (Build.VERSION.SDK_INT >= 29
        && power != null
        && power.getCurrentThermalStatus() >= PowerManager.THERMAL_STATUS_MODERATE) return "heat";
    BatteryManager battery = (BatteryManager) context.getSystemService(Context.BATTERY_SERVICE);
    if (battery != null) {
      int level = battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
      if (lowBattery(level, battery.isCharging())) return "battery";
    }
    ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
    if (manager != null) {
      ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
      manager.getMemoryInfo(memory);
      if (memory.lowMemory) return "memory";
    }
    return "";
  }

  static boolean lowBattery(int level, boolean charging) {
    return !charging && level >= 0 && level <= 20;
  }

  static int decodeEdge(JSONObject settings) {
    if (settings.optBoolean("ocr") || settings.optBoolean("people")) return 1600;
    return settings.optBoolean("visual") ? 768 : 512;
  }
}
