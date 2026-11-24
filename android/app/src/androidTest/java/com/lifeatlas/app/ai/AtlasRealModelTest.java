package com.lifeatlas.app.ai;

import static org.junit.Assert.*;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;

/**
 * Opt-in real inference test. Supply -e modelPath; an absent file is never replaced by mock output.
 */
@RunWith(AndroidJUnit4.class)
public class AtlasRealModelTest {
  @Test
  public void actualModelStreamsResetsCancelsAndUnloads() throws Exception {
    String path = InstrumentationRegistry.getArguments().getString("modelPath");
    Assume.assumeTrue(
        "Provide modelPath to execute real inference", path != null && !path.isEmpty());
    assertTrue("Actual model file must exist", new File(path).isFile());
    assertTrue(AtlasLlamaNative.AVAILABLE);
    String options =
        "{\"threads\":2,\"context\":1024,\"maxTokens\":64,\"temperature\":0,\"seed\":42}";
    try {
      AtlasLlamaNative.begin();
      JSONObject loaded = new JSONObject(AtlasLlamaNative.load(path, options));
      assertTrue(loaded.has("architecture"));
      StringBuilder stream = new StringBuilder();
      AtomicInteger stages = new AtomicInteger();
      AtlasLlamaNative.TokenSink sink =
          value -> {
            try {
              JSONObject event = new JSONObject(value);
              if (event.has("stage")) stages.incrementAndGet();
              else stream.append(event.getString("token"));
            } catch (JSONException e) {
              throw new IllegalStateException(e);
            }
          };
      JSONArray messages =
          new JSONArray()
              .put(new JSONObject().put("role", "user").put("content", "Say hello briefly."));
      AtlasLlamaNative.begin();
      JSONObject first =
          new JSONObject(AtlasLlamaNative.generate(messages.toString(), options, false, sink));
      assertFalse(first.getString("text").trim().isEmpty());
      assertEquals(first.getString("text"), stream.toString());
      assertTrue(stages.get() >= 3);
      messages
          .put(new JSONObject().put("role", "assistant").put("content", first.getString("text")))
          .put(new JSONObject().put("role", "user").put("content", "What did I just ask?"));
      AtlasLlamaNative.begin();
      assertFalse(
          new JSONObject(
                  AtlasLlamaNative.generate(messages.toString(), options, false, value -> {}))
              .getString("text")
              .isEmpty());
      AtlasLlamaNative.reset();
      AtlasLlamaNative.begin();
      String jsonMessages =
          "[{\"role\":\"system\",\"content\":\"Return JSON only with a reply string and action"
              + " null. No tools exist.\"},{\"role\":\"user\",\"content\":\"Say hello.\"}]";
      JSONObject structured =
          new JSONObject(AtlasLlamaNative.generate(jsonMessages, options, true, value -> {}));
      JSONObject envelope = new JSONObject(structured.getString("text"));
      assertTrue(envelope.get("reply") instanceof String);
      assertTrue(envelope.isNull("action"));
      AtlasLlamaNative.begin();
      AtomicBoolean canceled = new AtomicBoolean();
      JSONObject stopped =
          new JSONObject(
              AtlasLlamaNative.generate(
                  "[{\"role\":\"user\",\"content\":\"Count to 500, one number per line.\"}]",
                  options,
                  false,
                  value -> {
                    try {
                      if (new JSONObject(value).has("token") && canceled.compareAndSet(false, true))
                        AtlasLlamaNative.cancel();
                    } catch (JSONException e) {
                      throw new IllegalStateException(e);
                    }
                  }));
      assertTrue(canceled.get());
      assertTrue(stopped.getBoolean("canceled"));
      AtlasLlamaNative.reset();
      AtlasLlamaNative.unload();
      // Same ABI can load after cancellation/unload; repeat with modelPath2 for a distinct model.
      String second = InstrumentationRegistry.getArguments().getString("modelPath2", path);
      AtlasLlamaNative.begin();
      AtlasLlamaNative.load(second, options);
      AtlasLlamaNative.begin();
      assertFalse(
          new JSONObject(
                  AtlasLlamaNative.generate(
                      "[{\"role\":\"user\",\"content\":\"Hello\"}]", options, false, value -> {}))
              .getString("text")
              .isEmpty());
    } finally {
      AtlasLlamaNative.cancel();
      AtlasLlamaNative.unload();
    }
  }
}
