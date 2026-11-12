package com.lifeatlas.app.r2;

import java.io.*;
import java.security.MessageDigest;

public final class R2Io {
  private R2Io() {}

  public static byte[] read(InputStream in, int limit) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buffer = new byte[16384];
    int n;
    while ((n = in.read(buffer)) != -1) {
      if (out.size() + n > limit) throw new IOException("RESPONSE_TOO_LARGE");
      out.write(buffer, 0, n);
    }
    return out.toByteArray();
  }

  public static String sha(File file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] buffer = new byte[65536];
    try (InputStream input = new FileInputStream(file)) {
      int n;
      while ((n = input.read(buffer)) != -1) digest.update(buffer, 0, n);
    }
    return R2Policy.hex(digest.digest());
  }
}
