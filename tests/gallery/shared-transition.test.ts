import { test } from "node:test";
import assert from "node:assert/strict";
import { sharedImageFrames } from "../../src/lib/gallery/viewer-motion";
test("shared image uses matching compositor transforms without clip masks or stretched pixels", () => {
  for (const [w, h] of [
    [300, 600],
    [600, 300],
    [400, 400],
  ]) {
    const full = { left: 100, top: 20, width: w, height: h },
      thumb = { left: 20, top: 640, width: 100, height: 100 };
    const frames = sharedImageFrames(full, thumb);
    assert.equal(frames.crop.length, frames.image.length);
    for (let i = 0; i < frames.crop.length; i++) {
      const crop = String(frames.crop[i].transform).match(
          /scale\(([^,]+),([^\)]+)\)/,
        )!,
        image = String(frames.image[i].transform).match(
          /scale\(([^,]+),([^\)]+)\)/,
        )!;
      assert.ok(
        Math.abs(
          Number(crop[1]) * Number(image[1]) -
            Number(crop[2]) * Number(image[2]),
        ) < 1e-8,
        "Composed image scale is uniform",
      );
      assert.equal(frames.crop[i].clipPath, undefined);
      assert.equal(frames.image[i].clipPath, undefined);
    }
    const first = String(frames.crop[0].transform).match(
      /translate3d\(([^p]+)px,([^p]+)px,0\) scale\(([^,]+),([^\)]+)\)/,
    )!;
    assert.ok(
      Math.abs(
        full.left +
          w / 2 +
          Number(first[1]) -
          (w * Number(first[3])) / 2 -
          thumb.left,
      ) < 1e-8,
    );
    assert.ok(
      Math.abs(
        full.top +
          h / 2 +
          Number(first[2]) -
          (h * Number(first[4])) / 2 -
          thumb.top,
      ) < 1e-8,
    );
  }
});
