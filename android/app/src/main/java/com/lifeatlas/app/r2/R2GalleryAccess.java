package com.lifeatlas.app.r2;

import org.json.JSONObject;

final class R2GalleryAccess {
  static JSONObject describe(
      int sdk, boolean legacy, boolean images, boolean videos, boolean selected) throws Exception {
    boolean imageAccess = sdk >= 33 ? images : legacy,
        videoAccess = sdk >= 33 ? videos : legacy,
        limited = sdk >= 34 && selected;
    return new JSONObject()
        .put("images", imageAccess)
        .put("videos", videoAccess)
        .put("limited", limited)
        .put(
            "status",
            imageAccess && videoAccess
                ? "full"
                : imageAccess || videoAccess || limited ? "limited" : "denied");
  }
}
