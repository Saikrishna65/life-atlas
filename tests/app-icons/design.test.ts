import { test } from "node:test";
import assert from "node:assert/strict";
import { cropRegion, defaultDesign, iconApps, validIconLabel } from "../../src/lib/app-icons/design";
import { iconImageDimensions } from "../../src/lib/app-icons/image";

test("crop preserves a square at every aspect ratio and clamps crop/zoom limits", () => {
  assert.deepEqual(cropRegion(4000, 2000, 1, 0.5, 0.5), { sx: 1000, sy: 0, size: 2000 });
  assert.deepEqual(cropRegion(2000, 4000, 2, 1, 0), { sx: 1000, sy: 0, size: 1000 });
  assert.deepEqual(cropRegion(900, 600, 99, -2, 9), { sx: 0, sy: 400, size: 200 });
  assert.throws(() => cropRegion(0, 200, 1, 0.5, 0.5));
  for (const app of iconApps) assert.equal(defaultDesign(app.id).module, app.id);
  assert.equal(new Set(iconApps.map((app) => app.id)).size, 6);
});
test("labels count Unicode characters, reject invisible controls, and keep ordinary names", () => {
  for (const label of ["Atlas", "My photos", "Music 🎵", "🎵".repeat(32)]) assert.equal(validIconLabel(label), true);
  for (const label of ["", "   ", "a".repeat(33), "Atlas\nGallery", "Atlas\u202egallery"]) assert.equal(validIconLabel(label), false);
});
function png(width: number, height: number) {
  const bytes = new Uint8Array(24); bytes.set([137, 80, 78, 71]);
  const view = new DataView(bytes.buffer); view.setUint32(16, width); view.setUint32(20, height);
  return bytes;
}
test("photo derivatives bound both dimensions and preserve their aspect ratio", () => {
  assert.deepEqual(iconImageDimensions(png(4000, 2000)), { width: 1024, height: 512 });
  assert.deepEqual(iconImageDimensions(png(2000, 4000)), { width: 512, height: 1024 });
  assert.deepEqual(iconImageDimensions(png(400, 200)), { width: 400, height: 200 });
  assert.throws(() => iconImageDimensions(png(32768, 32768)));
  assert.throws(() => iconImageDimensions(png(1, 10000)));
  assert.throws(() => iconImageDimensions(new Uint8Array([1, 2, 3])));
});
test("JPEG orientation is applied before calculating a bounded derivative", () => {
  const bytes = new Uint8Array(49);
  const view = new DataView(bytes.buffer);
  bytes.set([255,216,255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0,255,192,0,9,8,0,0,0,0,1,1]);
  view.setUint16(43, 2000); view.setUint16(45, 4000);
  assert.deepEqual(iconImageDimensions(bytes), { width: 512, height: 1024 });
});
test("WebP dimension variants are bounded without decoding the full photo", () => {
  for (const kind of ["VP8X", "VP8 ", "VP8L"]) {
    const bytes = new Uint8Array(30), view = new DataView(bytes.buffer);
    for (const [at, text] of [[0, "RIFF"], [8, "WEBP"], [12, kind]] as const) bytes.set(new TextEncoder().encode(text), at);
    if (kind === "VP8X") { bytes[24] = 255; bytes[25] = 7; bytes[27] = 255; bytes[28] = 3; }
    else if (kind === "VP8 ") { view.setUint16(26, 2048, true); view.setUint16(28, 1024, true); }
    else view.setUint32(21, 2047 | (1023 << 14), true);
    assert.deepEqual(iconImageDimensions(bytes), { width: 1024, height: 512 });
  }
});
