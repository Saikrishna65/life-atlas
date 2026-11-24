package com.lifeatlas.app.ai;

import static org.junit.Assert.*;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run on API26+ emulator/device. No weights, network, microphone or private files required. */
@RunWith(AndroidJUnit4.class)
public class AtlasJniTest {
  @Test
  public void nativeLibraryLoadsAndMissingModelFailsSafely() {
    org.junit.Assume.assumeTrue(android.os.Build.VERSION.SDK_INT >= 26);
    assertTrue("JNI library must be packaged for this ABI", AtlasLlamaNative.AVAILABLE);
    AtlasLlamaNative.begin();
    try {
      AtlasLlamaNative.load("/not-an-atlas-model.gguf", "{}");
      fail("Missing file must fail");
    } catch (IllegalStateException expected) {
    }
    AtlasLlamaNative.cancel();
    AtlasLlamaNative.reset();
    AtlasLlamaNative.unload();
  }
}
