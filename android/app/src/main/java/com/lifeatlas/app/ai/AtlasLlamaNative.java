package com.lifeatlas.app.ai;

/** The only JNI entry point. Inference calls must run on AtlasInferenceRuntime's worker. */
public final class AtlasLlamaNative {
  public static final String VERSION = "llama.cpp:a6ac41c757c066941766164439f6876f2deaab04";
  public static final boolean AVAILABLE;

  static {
    boolean loaded;
    try {
      if (android.os.Build.VERSION.SDK_INT < 26)
        throw new UnsatisfiedLinkError("Local inference needs Android 8+");
      System.loadLibrary("atlas_llama");
      loaded = true;
    } catch (UnsatisfiedLinkError unavailable) {
      loaded = false;
    }
    AVAILABLE = loaded;
  }

  private AtlasLlamaNative() {}

  public interface TokenSink {
    void onToken(String eventJson);
  }

  public static native void begin();

  public static native String load(String path, String options);

  public static native String generate(
      String messages, String options, boolean structured, TokenSink sink);

  public static native void cancel();

  public static native void unload();

  public static native void reset();
}
