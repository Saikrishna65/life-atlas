package com.lifeatlas.app.r2;

import ai.onnxruntime.*;
import android.content.Context;
import android.graphics.Bitmap;
import java.io.*;
import java.net.*;
import java.nio.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.*;

/**
 * Pinned, checksum-verified CLIP, CPU inference only. Never sends an image or query to a server.
 */
final class GalleryClip implements AutoCloseable {
  static final String REVISION = "6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d";
  static final long DOWNLOAD_BYTES = 153621508L;
  static final Object LOCK = new Object();
  static final String[] NAMES = {"vision_model_quantized.onnx", "text_model_quantized.onnx"};
  static final long[] SIZES = {89117001, 64504507};
  static final String[] SHA = {
    "583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299",
    "73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a"
  };
  private OrtEnvironment environment;
  private OrtSession vision, text;
  private final Context context;

  GalleryClip(Context context) {
    this.context = context;
  }

  static File directory(Context context) {
    File dir = new File(context.getNoBackupFilesDir(), "gallery-models/clip-v1");
    if (!dir.isDirectory() && !dir.mkdirs())
      throw new IllegalStateException("LOCAL_STORAGE_UNAVAILABLE");
    return dir;
  }

  static boolean ready(Context c) {
    File dir = directory(c);
    return new File(dir, "verified").isFile()
        && new File(dir, NAMES[0]).length() == SIZES[0]
        && new File(dir, NAMES[1]).length() == SIZES[1];
  }

  static void ensure(Context c, BooleanSupplier stopped, LongConsumer progress) throws Exception {
    if (ready(c)) return;
    File dir = directory(c);
    for (int i = 0; i < NAMES.length; i++) {
      File target = new File(dir, NAMES[i]);
      if (target.length() == SIZES[i] && matches(target, SHA[i])) continue;
      File part = new File(dir, NAMES[i] + ".part");
      if (part.length() > SIZES[i]) part.delete();
      if (part.length() == SIZES[i]) {
        if (matches(part, SHA[i]) && part.renameTo(target)) continue;
        part.delete();
      }
      long offset = part.length();
      URL url =
          new URL(
              "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/"
                  + REVISION
                  + "/onnx/"
                  + NAMES[i]);
      HttpURLConnection connection = (HttpURLConnection) url.openConnection();
      connection.setConnectTimeout(20000);
      connection.setReadTimeout(20000);
      connection.setRequestProperty("Accept-Encoding", "identity");
      if (offset > 0) connection.setRequestProperty("Range", "bytes=" + offset + "-");
      try {
        int code = connection.getResponseCode();
        if (!"https".equals(connection.getURL().getProtocol()))
          throw new IOException("SEARCH_MODEL_DOWNLOAD_FAILED");
        if (code != 200 && code != 206) throw new IOException("SEARCH_MODEL_DOWNLOAD_FAILED");
        if (code == 206
            && !Objects.toString(connection.getHeaderField("Content-Range"), "")
                .startsWith("bytes " + offset + "-"))
          throw new IOException("SEARCH_MODEL_DOWNLOAD_FAILED");
        if (code == 200) offset = 0;
        try (InputStream in = connection.getInputStream();
            FileOutputStream out = new FileOutputStream(part, offset > 0)) {
          byte[] buffer = new byte[65536];
          int n;
          long count = offset, lastProgress = 0;
          while ((n = in.read(buffer)) != -1) {
            if (stopped.getAsBoolean()) throw new InterruptedIOException();
            count += n;
            if (count > SIZES[i]) throw new IOException("SEARCH_MODEL_INVALID");
            out.write(buffer, 0, n);
            long now = android.os.SystemClock.elapsedRealtime();
            if (now - lastProgress >= 1000 || count == SIZES[i]) {
              progress.accept((i == 0 ? 0 : SIZES[0]) + count);
              lastProgress = now;
            }
          }
          out.getFD().sync();
        }
      } finally {
        connection.disconnect();
      }
      if (part.length() != SIZES[i] || !matches(part, SHA[i])) {
        part.delete();
        throw new IOException("SEARCH_MODEL_INVALID");
      }
      if (!part.renameTo(target)) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
    }
    try (FileOutputStream out = new FileOutputStream(new File(dir, "verified"))) {
      out.write(REVISION.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      out.getFD().sync();
    }
  }

  static boolean matches(File file, String expected) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    try (InputStream in = new FileInputStream(file)) {
      byte[] buf = new byte[65536];
      int n;
      while ((n = in.read(buf)) != -1) digest.update(buf, 0, n);
    }
    return R2Policy.hex(digest.digest()).equals(expected);
  }

  static void remove(Context c) {
    for (File f : Objects.requireNonNull(directory(c).listFiles())) f.delete();
  }

  private OrtSession open(int model) throws Exception {
    if (environment == null) environment = OrtEnvironment.getEnvironment();
    if (!ready(context)) throw new R2Exception("SEARCH_MODEL_NOT_READY");
    try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
      options.setIntraOpNumThreads(2);
      options.setInterOpNumThreads(1);
      return environment.createSession(
          new File(directory(context), NAMES[model]).getPath(), options);
    }
  }

  float[] image(Bitmap bitmap) throws Exception {
    if (vision == null) vision = open(0);
    try (OnnxTensor input =
            OnnxTensor.createTensor(
                environment, FloatBuffer.wrap(pixels(bitmap)), new long[] {1, 3, 224, 224});
        OrtSession.Result out = vision.run(Map.of("pixel_values", input))) {
      return vector(out, "image_embeds");
    }
  }

  float[] query(String query) throws Exception {
    if (text == null) text = open(1);
    GalleryClipTokenizer tokenizer =
        new GalleryClipTokenizer(context.getAssets().open("gallery-models/clip-merges.txt"));
    long[] ids = tokenizer.encode(query), mask = new long[ids.length];
    Arrays.fill(mask, 1);
    try (OnnxTensor input =
            OnnxTensor.createTensor(environment, LongBuffer.wrap(ids), new long[] {1, ids.length});
        OnnxTensor attention =
            OnnxTensor.createTensor(
                environment, LongBuffer.wrap(mask), new long[] {1, ids.length})) {
      Map<String, OnnxTensor> inputs = new HashMap<>();
      inputs.put("input_ids", input);
      if (text.getInputNames().contains("attention_mask")) inputs.put("attention_mask", attention);
      try (OrtSession.Result out = text.run(inputs)) {
        return vector(out, "text_embeds");
      }
    }
  }

  private static float[] vector(OrtSession.Result result, String name) throws Exception {
    OnnxValue value = result.get(name).orElseThrow(() -> new IOException("SEARCH_MODEL_INVALID"));
    float[] v = ((float[][]) value.getValue())[0];
    return normalize(v);
  }

  static float[] normalize(float[] vector) throws IOException {
    if (vector.length != 512) throw new IOException("SEARCH_MODEL_INVALID");
    double sum = 0;
    for (float f : vector) {
      if (!Float.isFinite(f)) throw new IOException("SEARCH_MODEL_INVALID");
      sum += f * f;
    }
    if (sum < 1e-12) throw new IOException("SEARCH_MODEL_INVALID");
    for (int i = 0; i < vector.length; i++) vector[i] /= (float) Math.sqrt(sum);
    return vector;
  }

  static double cosine(float[] a, float[] b) {
    if (a.length != b.length) return -1;
    double value = 0;
    for (int i = 0; i < a.length; i++) value += a[i] * b[i];
    return value;
  }

  // CLIP's RGB center crop, 224px bicubic sampling, NCHW and published mean/std.
  static float[] pixels(Bitmap bitmap) {
    int width = bitmap.getWidth(), height = bitmap.getHeight(), edge = Math.min(width, height);
    int[] rgb = new int[width * height];
    bitmap.getPixels(rgb, 0, width, 0, 0, width, height);
    float[] result = new float[3 * 224 * 224];
    float[] mean = {.48145466f, .4578275f, .40821073f}, std = {.26862954f, .26130258f, .27577711f};
    for (int y = 0; y < 224; y++)
      for (int x = 0; x < 224; x++) {
        double sx = (width - edge) / 2.0 + (x + .5) * edge / 224.0 - .5,
            sy = (height - edge) / 2.0 + (y + .5) * edge / 224.0 - .5;
        int ix = (int) Math.floor(sx), iy = (int) Math.floor(sy);
        double[] channels = new double[3];
        double total = 0;
        for (int dy = -1; dy <= 2; dy++)
          for (int dx = -1; dx <= 2; dx++) {
            double weight = cubic(sx - (ix + dx)) * cubic(sy - (iy + dy));
            int color =
                rgb[
                    Math.max(0, Math.min(height - 1, iy + dy)) * width
                        + Math.max(0, Math.min(width - 1, ix + dx))];
            channels[0] += weight * ((color >> 16) & 255);
            channels[1] += weight * ((color >> 8) & 255);
            channels[2] += weight * (color & 255);
            total += weight;
          }
        for (int c = 0; c < 3; c++)
          result[c * 224 * 224 + y * 224 + x] =
              ((float) Math.max(0, Math.min(255, channels[c] / total)) / 255f - mean[c]) / std[c];
      }
    Arrays.fill(rgb, 0);
    return result;
  }

  private static double cubic(double x) {
    x = Math.abs(x);
    if (x <= 1) return 1.5 * x * x * x - 2.5 * x * x + 1;
    if (x < 2) return -.5 * x * x * x + 2.5 * x * x - 4 * x + 2;
    return 0;
  }

  public void close() throws OrtException {
    if (vision != null) vision.close();
    if (text != null) text.close();
  }
}
