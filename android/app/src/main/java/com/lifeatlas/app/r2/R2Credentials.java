package com.lifeatlas.app.r2;

import org.json.JSONObject;

final class R2Credentials {
  final String account, endpoint, bucket, access, secret, base, revision;

  R2Credentials(JSONObject json) throws Exception {
    account = R2Policy.account(json.getString("accountId"));
    endpoint = R2Policy.endpoint(account, json.optString("endpoint"));
    bucket = R2Policy.bucket(json.getString("bucket"));
    access = json.getString("accessKeyId");
    secret = json.getString("secretAccessKey");
    if (access.length() < 8
        || access.length() > 256
        || secret.length() < 16
        || secret.length() > 512
        || access.codePoints().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c))
        || secret
            .codePoints()
            .anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c)))
      throw new R2Exception("INVALID_CREDENTIALS");
    base = R2Policy.publicBase(json.optString("publicBaseUrl"));
    revision = json.getString("revision");
  }

  JSONObject summary(String slot) throws Exception {
    return new JSONObject()
        .put("slot", slot)
        .put("configured", true)
        .put("accountId", account)
        .put("endpoint", endpoint)
        .put("bucket", bucket)
        .put("publicBaseUrl", base)
        .put("revision", revision);
  }
}
