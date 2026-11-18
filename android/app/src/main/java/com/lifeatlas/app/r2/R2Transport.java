package com.lifeatlas.app.r2;

import java.util.Map;
import org.json.JSONObject;

/** Narrow native transport seam for synthetic catalog concurrency tests. */
interface R2Transport {
  R2Client.Response request(
      String method,
      String key,
      Map<String, String> query,
      Map<String, String> headers,
      R2Client.Body body,
      R2Client.Progress progress)
      throws Exception;

  JSONObject head(String key) throws Exception;

  void delete(String key) throws Exception;
}
