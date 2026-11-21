package com.lifeatlas.app.r2;

final class GalleryEditGeometry {
  final double width, height, x, y;

  GalleryEditGeometry(
      double sourceWidth,
      double sourceHeight,
      double angle,
      double aspect,
      double zoom,
      double panX,
      double panY) {
    double radians = Math.toRadians(angle),
        c = Math.abs(Math.cos(radians)),
        s = Math.abs(Math.sin(radians));
    boolean turned = Math.abs(Math.round(angle / 90)) % 2 == 1;
    if (aspect == 0) aspect = turned ? sourceHeight / sourceWidth : sourceWidth / sourceHeight;
    height = Math.min(sourceWidth / (aspect * c + s), sourceHeight / (aspect * s + c)) / zoom;
    width = height * aspect;
    x = sourceWidth / 2 + (panX * 2 - 1) * Math.max(0, (sourceWidth - width * c - height * s) / 2);
    y =
        sourceHeight / 2
            + (panY * 2 - 1) * Math.max(0, (sourceHeight - width * s - height * c) / 2);
  }
}
