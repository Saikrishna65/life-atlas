package com.lifeatlas.app.r2;

/**
 * Fixed codes only. Never carry an SDK exception, signed URL, body, or credential into the
 * bridge/log.
 */
public final class R2Exception extends Exception {
  public final String code;

  public R2Exception(String code) {
    super(code);
    this.code = code;
  }
}
