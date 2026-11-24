package com.lifeatlas.app.ai;

import java.net.URL;

/** Pure validation used for every redirect and resumed response. */
public final class AtlasDownloadRules {
  private AtlasDownloadRules() {}

  public static boolean approved(URL url) {
    String host = url.getHost();
    return "https".equals(url.getProtocol())
        && url.getUserInfo() == null
        && (url.getPort() == -1 || url.getPort() == 443)
        && (host.equals("huggingface.co")
            || host.endsWith(".huggingface.co")
            || host.endsWith(".hf.co"));
  }

  public static boolean resumedRange(String value, long offset, long total) {
    if (value == null) return false;
    java.util.regex.Matcher match =
        java.util.regex.Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)").matcher(value);
    if (!match.matches()) return false;
    try {
      return Long.parseLong(match.group(1)) == offset
          && Long.parseLong(match.group(2)) == total - 1
          && Long.parseLong(match.group(3)) == total;
    } catch (NumberFormatException e) {
      return false;
    }
  }
}
