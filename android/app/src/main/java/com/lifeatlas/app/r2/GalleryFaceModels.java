package com.lifeatlas.app.r2;

import ai.onnxruntime.*;
import android.content.Context;
import android.graphics.Bitmap;
import java.io.*;
import java.net.*;
import java.nio.*;
import java.util.*;
import java.util.function.BooleanSupplier;
import org.json.*;

/** Opt-in YuNet + quantized SFace. About 10.1 MB, sharing the existing native CPU runtime. */
final class GalleryFaceModels implements AutoCloseable {
  static final String REVISION = "48b10fa505aeb51fbd127fc60a5c660040e823b7",
      VERSION = "yunet-sface-int8-v1";
  static final long BYTES = 10129522;
  static final String[] PATHS = {
    "face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "face_recognition_sface/face_recognition_sface_2021dec_int8.onnx"
  };
  static final long[] SIZES = {232589, 9896933};
  static final String[] SHA = {
    "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    "2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a"
  };
  static final float[][] CANONICAL = {
    {38.2946f, 51.6963f},
    {73.5318f, 51.5014f},
    {56.0252f, 71.7366f},
    {41.5493f, 92.3655f},
    {70.7299f, 92.2041f}
  };
  private final Context context;
  private OrtEnvironment env;
  private OrtSession detector, recognizer;

  GalleryFaceModels(Context c) {
    context = c;
  }

  static File directory(Context c) {
    File d = new File(c.getNoBackupFilesDir(), "gallery-models/people-v1");
    if (!d.isDirectory() && !d.mkdirs())
      throw new IllegalStateException("LOCAL_STORAGE_UNAVAILABLE");
    return d;
  }

  static String name(int i) {
    return PATHS[i].substring(PATHS[i].lastIndexOf('/') + 1);
  }

  static boolean ready(Context c) {
    File d = directory(c);
    return new File(d, "verified").isFile()
        && new File(d, name(0)).length() == SIZES[0]
        && new File(d, name(1)).length() == SIZES[1];
  }

  static void ensure(Context c, BooleanSupplier stopped) throws Exception {
    if (ready(c)) return;
    File dir = directory(c);
    for (int i = 0; i < 2; i++) {
      if (stopped.getAsBoolean()) throw new InterruptedIOException();
      File target = new File(dir, name(i)), part = new File(dir, name(i) + ".part");
      if (target.length() == SIZES[i] && GalleryClip.matches(target, SHA[i])) continue;
      if (part.length() == SIZES[i] && GalleryClip.matches(part, SHA[i]) && part.renameTo(target))
        continue;
      if (part.length() >= SIZES[i]) part.delete();
      long offset = part.length();
      HttpURLConnection connection =
          (HttpURLConnection)
              new URL(
                      "https://github.com/opencv/opencv_zoo/raw/"
                          + REVISION
                          + "/models/"
                          + PATHS[i])
                  .openConnection();
      connection.setConnectTimeout(20000);
      connection.setReadTimeout(20000);
      connection.setRequestProperty("Accept-Encoding", "identity");
      if (offset > 0) connection.setRequestProperty("Range", "bytes=" + offset + "-");
      try {
        int code = connection.getResponseCode();
        if (!"https".equals(connection.getURL().getProtocol()) || (code != 200 && code != 206))
          throw new IOException("PEOPLE_MODEL_DOWNLOAD_FAILED");
        if (code == 200) offset = 0;
        else if (!Objects.toString(connection.getHeaderField("Content-Range"), "")
            .startsWith("bytes " + offset + "-"))
          throw new IOException("PEOPLE_MODEL_DOWNLOAD_FAILED");
        try (InputStream in = connection.getInputStream();
            FileOutputStream out = new FileOutputStream(part, offset > 0)) {
          byte[] buffer = new byte[65536];
          int n;
          long count = offset;
          while ((n = in.read(buffer)) != -1) {
            if (stopped.getAsBoolean()) throw new InterruptedIOException();
            count += n;
            if (count > SIZES[i]) throw new IOException("PEOPLE_MODEL_INVALID");
            out.write(buffer, 0, n);
          }
          out.getFD().sync();
        }
      } finally {
        connection.disconnect();
      }
      if (part.length() != SIZES[i] || !GalleryClip.matches(part, SHA[i])) {
        part.delete();
        throw new IOException("PEOPLE_MODEL_INVALID");
      }
      if (!part.renameTo(target)) throw new IOException("LOCAL_STORAGE_UNAVAILABLE");
    }
    if (stopped.getAsBoolean()) return;
    try (FileOutputStream out = new FileOutputStream(new File(dir, "verified"))) {
      out.write(VERSION.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      out.getFD().sync();
    }
  }

  static void remove(Context c) {
    File[] files = directory(c).listFiles();
    if (files != null) for (File f : files) f.delete();
  }

  private void open() throws Exception {
    if (detector != null) return;
    if (!ready(context)) throw new R2Exception("PEOPLE_MODEL_NOT_READY");
    env = OrtEnvironment.getEnvironment();
    try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
      options.setIntraOpNumThreads(2);
      options.setInterOpNumThreads(1);
      detector = env.createSession(new File(directory(context), name(0)).getPath(), options);
      try {
        recognizer = env.createSession(new File(directory(context), name(1)).getPath(), options);
      } catch (Exception e) {
        detector.close();
        detector = null;
        throw e;
      }
    }
  }

  static final class Detection {
    final float[] bounds, points;
    final float score;

    Detection(float[] bounds, float[] points, float score) {
      this.bounds = bounds;
      this.points = points;
      this.score = score;
    }
  }

  static List<Detection> decode(Map<String, float[][]> outputs, int side) {
    List<Detection> candidates = new ArrayList<>();
    for (int stride : new int[] {8, 16, 32}) {
      int cols = side / stride;
      float[][] cls = outputs.get("cls_" + stride),
          obj = outputs.get("obj_" + stride),
          boxes = outputs.get("bbox_" + stride),
          points = outputs.get("kps_" + stride);
      if (cls == null || obj == null || boxes == null || points == null)
        throw new IllegalArgumentException("PEOPLE_MODEL_INVALID");
      for (int i = 0; i < cls.length; i++) {
        float score =
            (float)
                Math.sqrt(
                    Math.max(0, Math.min(1, cls[i][0])) * Math.max(0, Math.min(1, obj[i][0])));
        if (!Float.isFinite(score) || score < .9f) continue;
        int x = i % cols, y = i / cols;
        float cx = (x + boxes[i][0]) * stride,
            cy = (y + boxes[i][1]) * stride,
            w = (float) Math.exp(boxes[i][2]) * stride,
            h = (float) Math.exp(boxes[i][3]) * stride;
        if (!Float.isFinite(w) || !Float.isFinite(h) || w < 20 || h < 20) continue;
        float[] landmarks = new float[10];
        for (int k = 0; k < 5; k++) {
          landmarks[2 * k] = (x + points[i][2 * k]) * stride;
          landmarks[2 * k + 1] = (y + points[i][2 * k + 1]) * stride;
        }
        candidates.add(new Detection(new float[] {cx - w / 2, cy - h / 2, w, h}, landmarks, score));
      }
    }
    candidates.sort(Comparator.comparingDouble((Detection d) -> -d.score));
    List<Detection> kept = new ArrayList<>();
    for (Detection candidate : candidates) {
      boolean suppressed = false;
      for (Detection old : kept)
        if (iou(candidate.bounds, old.bounds) > .3) {
          suppressed = true;
          break;
        }
      if (!suppressed) {
        kept.add(candidate);
        if (kept.size() == 32) break;
      }
    }
    return kept;
  }

  static double iou(float[] a, float[] b) {
    double w = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])),
        h = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    return w * h / Math.max(1, a[2] * a[3] + b[2] * b[3] - w * h);
  }

  static double[] transform(float[] points) {
    double sx = 0, sy = 0, tx = 0, ty = 0;
    for (int i = 0; i < 5; i++) {
      sx += points[2 * i] / 5d;
      sy += points[2 * i + 1] / 5d;
      tx += CANONICAL[i][0] / 5d;
      ty += CANONICAL[i][1] / 5d;
    }
    double den = 0, a = 0, b = 0;
    for (int i = 0; i < 5; i++) {
      double x = points[2 * i] - sx,
          y = points[2 * i + 1] - sy,
          u = CANONICAL[i][0] - tx,
          v = CANONICAL[i][1] - ty;
      den += x * x + y * y;
      a += x * u + y * v;
      b += x * v - y * u;
    }
    if (den < 1e-6) throw new IllegalArgumentException("PEOPLE_FACE_TOO_SMALL");
    a /= den;
    b /= den;
    return new double[] {a, b, tx - a * sx + b * sy, ty - b * sx - a * sy};
  }

  static Bitmap aligned(Bitmap source, float[] points) {
    double[] m = transform(points);
    double den = m[0] * m[0] + m[1] * m[1];
    if (den < 1e-8) throw new IllegalArgumentException("PEOPLE_FACE_TOO_SMALL");
    Bitmap out = Bitmap.createBitmap(112, 112, Bitmap.Config.ARGB_8888);
    for (int y = 0; y < 112; y++)
      for (int x = 0; x < 112; x++) {
        double u = x - m[2],
            v = y - m[3],
            sx = (m[0] * u + m[1] * v) / den,
            sy = (-m[1] * u + m[0] * v) / den;
        int ix = (int) Math.floor(sx), iy = (int) Math.floor(sy);
        double dx = sx - ix, dy = sy - iy;
        double[] channels = new double[3];
        for (int yy = 0; yy < 2; yy++)
          for (int xx = 0; xx < 2; xx++) {
            int px = ix + xx, py = iy + yy;
            int c =
                (px < 0 || py < 0 || px >= source.getWidth() || py >= source.getHeight())
                    ? 0xff000000
                    : source.getPixel(px, py);
            double weight = (xx == 0 ? 1 - dx : dx) * (yy == 0 ? 1 - dy : dy);
            for (int k = 0; k < 3; k++) channels[k] += weight * ((c >> (16 - k * 8)) & 255);
          }
        out.setPixel(
            x,
            y,
            0xff000000
                | ((int) Math.round(channels[0]) << 16)
                | ((int) Math.round(channels[1]) << 8)
                | (int) Math.round(channels[2]));
      }
    return out;
  }

  static float[] normalize(float[] v) {
    double n = 0;
    for (float value : v) {
      if (!Float.isFinite(value)) throw new IllegalArgumentException("PEOPLE_MODEL_INVALID");
      n += value * value;
    }
    if (v.length != 128 || n < 1e-10) throw new IllegalArgumentException("PEOPLE_MODEL_INVALID");
    for (int i = 0; i < v.length; i++) v[i] /= (float) Math.sqrt(n);
    return v;
  }

  JSONArray analyze(Bitmap source, JSONObject media, BooleanSupplier stopped) throws Exception {
    open();
    int side = 640, w = source.getWidth(), h = source.getHeight();
    float scale = side / (float) Math.max(w, h);
    int sw = Math.max(1, Math.round(w * scale)), sh = Math.max(1, Math.round(h * scale));
    Bitmap scaled = Bitmap.createScaledBitmap(source, sw, sh, true);
    float[] pixels = new float[3 * side * side];
    int[] scaledPixels = new int[sw * sh];
    scaled.getPixels(scaledPixels, 0, sw, 0, 0, sw, sh);
    for (int y = 0; y < sh; y++)
      for (int x = 0; x < sw; x++) {
        int c = scaledPixels[y * sw + x];
        for (int k = 0; k < 3; k++) pixels[k * side * side + y * side + x] = (c >> (k * 8)) & 255;
      } // BGR
    if (scaled != source) scaled.recycle();
    Arrays.fill(scaledPixels, 0);
    List<Detection> detections;
    try (OnnxTensor input =
            OnnxTensor.createTensor(env, FloatBuffer.wrap(pixels), new long[] {1, 3, side, side});
        OrtSession.Result result =
            detector.run(Map.of(detector.getInputNames().iterator().next(), input))) {
      Map<String, float[][]> outputs = new HashMap<>();
      for (String key : detector.getOutputNames())
        outputs.put(key, ((float[][][]) result.get(key).orElseThrow().getValue())[0]);
      detections = decode(outputs, side);
    } finally {
      Arrays.fill(pixels, 0);
    }
    JSONArray faces = new JSONArray();
    int number = 0;
    for (Detection detection : detections) {
      if (stopped.getAsBoolean()) throw new InterruptedIOException();
      float[] pts = detection.points.clone();
      boolean inFrame = true;
      for (int i = 0; i < 10; i++) {
        pts[i] /= scale;
        if (!Float.isFinite(pts[i]) || pts[i] < 0 || pts[i] >= (i % 2 == 0 ? w : h))
          inFrame = false;
      }
      if (!inFrame) continue;
      // Tiny/strong-profile landmarks are unreliable: leave those photos in the ordinary gallery.
      double eye = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
      if (eye < 18 || pts[4] < Math.min(pts[0], pts[2]) || pts[4] > Math.max(pts[0], pts[2]))
        continue;
      Bitmap crop = aligned(source, pts);
      float[] rgb = new float[3 * 112 * 112];
      try {
        for (int y = 0; y < 112; y++)
          for (int x = 0; x < 112; x++) {
            int c = crop.getPixel(x, y);
            for (int k = 0; k < 3; k++)
              rgb[k * 112 * 112 + y * 112 + x] = (c >> (16 - k * 8)) & 255;
          }
        float[] embedding;
        try (OnnxTensor input =
                OnnxTensor.createTensor(env, FloatBuffer.wrap(rgb), new long[] {1, 3, 112, 112});
            OrtSession.Result result =
                recognizer.run(Map.of(recognizer.getInputNames().iterator().next(), input))) {
          embedding = normalize(((float[][]) result.get(0).getValue())[0]);
        }
        JSONArray vector = new JSONArray();
        for (float f : embedding) vector.put((double) f);
        Arrays.fill(embedding, 0);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        crop.compress(Bitmap.CompressFormat.JPEG, 82, bytes);
        String id =
            GallerySearchStore.token(media.getString("id"))
                + "."
                + (number++)
                + "."
                + GallerySearchStore.token(
                        R2DeviceGallery.stamp(media)
                            + "|"
                            + VERSION
                            + "|"
                            + Math.round(detection.bounds[0] / 4)
                            + ":"
                            + Math.round(detection.bounds[1] / 4)
                            + ":"
                            + Math.round(detection.bounds[2] / 4)
                            + ":"
                            + Math.round(detection.bounds[3] / 4))
                    .substring(0, 16);
        faces.put(
            new JSONObject()
                .put("id", id)
                .put("embedding", vector)
                .put(
                    "crop",
                    android.util.Base64.encodeToString(
                        bytes.toByteArray(), android.util.Base64.NO_WRAP))
                .put("confidence", detection.score));
      } finally {
        crop.recycle();
        Arrays.fill(rgb, 0);
      }
    }
    return faces;
  }

  public void close() throws OrtException {
    try {
      if (detector != null) detector.close();
    } finally {
      if (recognizer != null) recognizer.close();
    }
  }
}
