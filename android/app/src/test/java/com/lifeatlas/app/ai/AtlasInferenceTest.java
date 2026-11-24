package com.lifeatlas.app.ai;

import static org.junit.Assert.*;

import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, manifest = Config.NONE)
public class AtlasInferenceTest {
  @Test
  public void resumedDownloadsRejectUnexpectedHostsAndRanges() throws Exception {
    org.junit.Assert.assertTrue(
        AtlasDownloadRules.approved(new java.net.URL("https://huggingface.co/test")));
    for (String url :
        new String[] {
          "http://huggingface.co/test",
          "https://huggingface.co.attacker.invalid/x",
          "https://user@huggingface.co/x",
          "https://huggingface.co:8443/x"
        }) org.junit.Assert.assertFalse(AtlasDownloadRules.approved(new java.net.URL(url)));
    org.junit.Assert.assertTrue(AtlasDownloadRules.resumedRange("bytes 100-199/200", 100, 200));
    for (String range :
        new String[] {"bytes 0-199/200", "bytes 100-999/200", "bytes 100-199/201", "garbage"})
      org.junit.Assert.assertFalse(AtlasDownloadRules.resumedRange(range, 100, 200));
    org.junit.Assert.assertFalse(AtlasDownloadRules.resumedRange(null, 0, 200));
  }

  @Test
  public void configLimitsAreNativeAndRejectUnsupportedGpu() throws Exception {
    AtlasInferenceRuntime.validate(new JSONObject());
    String[] invalid = {
      "{\"threads\":0}",
      "{\"context\":16384}",
      "{\"maxTokens\":2048}",
      "{\"gpuLayers\":1}",
      "{\"topP\":0}",
      "{\"batch\":0}"
    };
    for (String json : invalid) {
      try {
        AtlasInferenceRuntime.validate(new JSONObject(json));
        fail(json);
      } catch (IllegalArgumentException expected) {
      }
    }
  }

  @Test
  public void speechWaitsForSentenceAndNeverSpeaksReasoning() {
    AtlasSpeechGate gate = new AtlasSpeechGate();
    assertTrue(gate.append("<thi", false).isEmpty());
    assertTrue(gate.append("nk>private reasoning", false).isEmpty());
    assertEquals(
        java.util.Collections.singletonList("Hello there."),
        gate.append("</think>Hello there. ", false));
    assertEquals(
        java.util.Collections.singletonList("How are you?"), gate.append("How are you?", true));
  }

  @Test
  public void speechRejectsJsonAndUnverifiedExecutionClaims() {
    assertTrue(new AtlasSpeechGate().append("{\"reply\":\"Sent\"}", true).isEmpty());
    assertTrue(new AtlasSpeechGate().append("I've deleted your photos. ", false).isEmpty());
  }
}
