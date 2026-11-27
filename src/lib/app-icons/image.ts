/** Read only image headers so icon decoding can bound both dimensions before allocation. */
export function iconImageDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, orientation = 1;
  const text = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
  if (bytes.length >= 24 && text(1, 3) === "PNG") {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    const kind = text(12, 4);
    const u24 = (at: number) => bytes[at] + (bytes[at + 1] << 8) + (bytes[at + 2] << 16);
    if (kind === "VP8X") { width = u24(24) + 1; height = u24(27) + 1; }
    else if (kind === "VP8 ") { width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff; }
    else if (kind === "VP8L") {
      const bits = view.getUint32(21, true);
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    }
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at] !== 0xff) break;
      const marker = bytes[at + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = view.getUint16(at + 2);
      if (length < 2 || at + 2 + length > bytes.length) break;
      if (marker === 0xe1 && text(at + 4, 6) === "Exif\0\0") {
        const tiff = at + 10, end = at + 2 + length;
        if (tiff + 8 <= end) {
          const little = text(tiff, 2) === "II";
          const ifd = tiff + view.getUint32(tiff + 4, little);
          if (ifd >= tiff && ifd + 2 <= end) {
            const count = Math.min(view.getUint16(ifd, little), 256);
            for (let i = 0; i < count; i++) {
              const entry = ifd + 2 + i * 12;
              if (entry + 12 > end) break;
              if (view.getUint16(entry, little) === 0x112) orientation = view.getUint16(entry + 8, little);
            }
          }
        }
      }
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
        height = view.getUint16(at + 5); width = view.getUint16(at + 7); break;
      }
      at += 2 + length;
    }
  }
  if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
  if (!width || !height || width > 32768 || height > 32768 || width * height > 100_000_000 || Math.max(width, height) / Math.min(width, height) > 10)
    throw Error("Choose a standard photo or crop this image first. Its dimensions could not be safely read.");
  const ratio = Math.min(1, 1024 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export async function decodeIconPhoto(file: File) {
  const dimensions = iconImageDimensions(new Uint8Array(await file.slice(0, 1_048_576).arrayBuffer()));
  return createImageBitmap(file, { resizeWidth: dimensions.width, resizeHeight: dimensions.height, resizeQuality: "high", imageOrientation: "from-image" });
}
