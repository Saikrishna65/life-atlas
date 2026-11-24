package com.lifeatlas.app.ai;

import java.util.*;
import org.json.*;

/**
 * Timing only. No transcript, prompt or response content. Callback time is not acoustic playback.
 */
public final class AtlasVoiceLatencyTrace {
  private final double origin;
  private final List<JSONObject> events = new ArrayList<>();

  public AtlasVoiceLatencyTrace(double recognitionComplete) {
    origin = recognitionComplete;
    if (origin > 0) mark("recognitionComplete", origin, "recognizerCallback");
  }

  public synchronized void mark(String name, double elapsedMs, String measurement) {
    if (!Double.isFinite(elapsedMs) || elapsedMs < origin || events.size() >= 64) return;
    if (name.startsWith("first") || name.equals("recognitionComplete"))
      for (JSONObject event : events) if (name.equals(event.optString("stage"))) return;
    try {
      events.add(
          new JSONObject()
              .put("stage", name)
              .put("elapsedRealtimeMs", elapsedMs)
              .put("sinceRecognitionMs", elapsedMs - origin)
              .put("measurement", measurement));
    } catch (JSONException ignored) {
    }
  }

  public synchronized JSONObject snapshot() {
    try {
      return new JSONObject()
          .put("clock", "android.elapsedRealtime")
          .put("acousticLatencyMeasured", false)
          .put("events", new JSONArray(events));
    } catch (JSONException e) {
      return new JSONObject();
    }
  }
}
