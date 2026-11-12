package com.lifeatlas.app.r2;

import android.graphics.*;
import android.media.MediaMetadataRetriever;
import android.os.Build;
import java.io.*;

public final class R2Thumbnails {
  private R2Thumbnails() {}

  public static byte[] create(File file, String mime) {
    Bitmap bitmap = null;
    try {
      if (mime.startsWith("image/")) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
        BitmapFactory.Options options = new BitmapFactory.Options();
        int sample = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / sample > 640) sample *= 2;
        options.inSampleSize = sample;
        bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), options);
      } else if (mime.startsWith("video/") && Build.VERSION.SDK_INT >= 27) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
          retriever.setDataSource(file.getAbsolutePath());
          bitmap =
              retriever.getScaledFrameAtTime(
                  0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 480, 320);
        } finally {
          retriever.release();
        }
      }
      if (bitmap == null) return null;
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      bitmap.compress(Bitmap.CompressFormat.JPEG, 70, bytes);
      return bytes.size() <= 300000 ? bytes.toByteArray() : null;
    } catch (Exception | OutOfMemoryError e) {
      return null;
    } finally {
      if (bitmap != null) bitmap.recycle();
    }
  }
}
