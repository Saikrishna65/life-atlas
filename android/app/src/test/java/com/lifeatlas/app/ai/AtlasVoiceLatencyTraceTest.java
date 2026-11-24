package com.lifeatlas.app.ai;

import static org.junit.Assert.*;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, manifest = Config.NONE)
public class AtlasVoiceLatencyTraceTest {
  @Test
  public void callbackTimelineUsesOneMonotonicClockAndNeverClaimsAcousticTiming() throws Exception {
    AtlasVoiceLatencyTrace trace = new AtlasVoiceLatencyTrace(1000);
    trace.mark("recognitionComplete", 1000, "recognizerCallback");
    trace.mark("firstSpeakableSentence", 1350, "sentenceGate");
    trace.mark("firstSpeakableSentence", 1400, "sentenceGate");
    trace.mark("ttsPlaybackStart", 1400, "ttsCallback");
    trace.mark("ttsComplete", 1700, "ttsCallback");
    org.json.JSONObject result = trace.snapshot();
    assertFalse(result.getBoolean("acousticLatencyMeasured"));
    assertEquals("android.elapsedRealtime", result.getString("clock"));
    assertEquals(4, result.getJSONArray("events").length());
    assertEquals(
        350, result.getJSONArray("events").getJSONObject(1).getDouble("sinceRecognitionMs"), 0);
    assertFalse(result.toString().contains("prompt"));
  }
}
