package com.lifeatlas.app.r2;

import java.net.URI;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.UUID;

/** Shared validation; credentials are never routed through a general-purpose proxy. */
public final class R2Policy {
  private R2Policy() {}

  public static String account(String value) {
    if (value == null || !value.matches("[a-fA-F0-9]{32}"))
      throw new IllegalArgumentException("INVALID_ACCOUNT");
    return value.toLowerCase(Locale.ROOT);
  }

  public static String endpoint(String account, String override) {
    String id = account(account);
    String value =
        override == null || override.trim().isEmpty()
            ? "https://" + id + ".r2.cloudflarestorage.com"
            : override.trim();
    URI uri;
    try {
      uri = URI.create(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("INVALID_ENDPOINT");
    }
    if (!"https".equals(uri.getScheme())
        || uri.getRawUserInfo() != null
        || uri.getPort() != -1
        || uri.getRawQuery() != null
        || uri.getRawFragment() != null
        || (uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))
        || uri.getHost() == null
        || !uri.getHost().matches(id + "(\\.(eu|fedramp))?\\.r2\\.cloudflarestorage\\.com"))
      throw new IllegalArgumentException("INVALID_ENDPOINT");
    return "https://" + uri.getHost();
  }

  public static String bucket(String value) {
    if (value == null
        || !value.matches("[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]")
        || value.contains("..")
        || value.matches("[0-9.]+")) throw new IllegalArgumentException("INVALID_BUCKET");
    return value;
  }

  public static String slot(String value) {
    if (!"public".equals(value) && !"private".equals(value))
      throw new IllegalArgumentException("INVALID_BUCKET_SLOT");
    return value;
  }

  public static String key(String value) {
    if (value == null
        || value.isEmpty()
        || value.length() > 1000
        || value.startsWith("/")
        || value.contains("\\")
        || value.codePoints().anyMatch(Character::isISOControl))
      throw new IllegalArgumentException("INVALID_OBJECT_KEY");
    for (String part : value.split("/", -1))
      if (part.isEmpty() || part.equals(".") || part.equals(".."))
        throw new IllegalArgumentException("INVALID_OBJECT_KEY");
    return value;
  }

  public static String publicBase(String value) {
    if (value == null || value.trim().isEmpty()) return "";
    URI uri;
    try {
      uri = URI.create(value.trim());
    } catch (Exception e) {
      throw new IllegalArgumentException("INVALID_PUBLIC_URL");
    }
    if (!"https".equals(uri.getScheme())
        || uri.getHost() == null
        || uri.getUserInfo() != null
        || uri.getQuery() != null
        || uri.getFragment() != null
        || uri.getPort() != -1
        || uri.getHost().endsWith(".r2.cloudflarestorage.com")
        || uri.getHost().equals("localhost")
        || uri.getHost().matches("[0-9.]+")
        || uri.getHost().contains(":")) throw new IllegalArgumentException("INVALID_PUBLIC_URL");
    String result = uri.toASCIIString();
    while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
    return result;
  }

  public static String encoded(String value) {
    try {
      return URLEncoder.encode(value, "UTF-8").replace("+", "%20").replace("%7E", "~");
    } catch (java.io.UnsupportedEncodingException e) {
      throw new IllegalStateException(e);
    }
  }

  public static String path(String key) {
    StringBuilder result = new StringBuilder();
    for (String part : key(key).split("/")) {
      if (result.length() > 0) result.append('/');
      result.append(encoded(part));
    }
    return result.toString();
  }

  public static String objectKey(String slot, String mime) {
    slot(slot);
    String kind =
        mime.startsWith("video/") ? "videos" : mime.startsWith("image/") ? "photos" : "files";
    return (slot.equals("private") ? "encrypted/" + kind + "/" : "galleries/originals/")
        + UUID.randomUUID()
        + (slot.equals("private") ? ".atlasenc" : ".bin");
  }

  public static String hex(byte[] bytes) {
    StringBuilder out = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b & 255));
    return out.toString();
  }

  public static String digest(byte[] data) {
    try {
      return hex(MessageDigest.getInstance("SHA-256").digest(data));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static String safeError(Exception error) {
    String code =
        error instanceof R2Exception
            ? ((R2Exception) error).code
            : error instanceof IllegalArgumentException
                    && error.getMessage() != null
                    && error.getMessage().matches("[A-Z_]{3,50}")
                ? error.getMessage()
                : "STORAGE_OPERATION_FAILED";
    return code;
  }

  public static long partSize(long bytes) {
    return Math.max(16L * 1024 * 1024, (bytes + 9999) / 10000);
  }
}
