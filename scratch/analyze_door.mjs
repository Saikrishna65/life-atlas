import sharp from "sharp";

async function analyze() {
  const image = sharp("public/textures/door/door_master_diff.jpg");
  const metadata = await image.metadata();
  console.log("Metadata:", metadata.width, metadata.height);

  // Extract raw RGB buffer
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  console.log("Raw info:", info);

  // Find the brass lock plate: it has warm yellow/brown/gold color: high R, medium G, low B (R > 120, G > 80, B < 60)
  let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
  let brassCount = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Brass detection around the left lock stile (x between 8% and 25%, y between 45% and 65%)
      if (x > info.width * 0.08 && x < info.width * 0.25 && y > info.height * 0.45 && y < info.height * 0.65) {
        if (r > 100 && g > 70 && b < 60 && (r - b) > 40) {
          brassCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  console.log(`Brass plate bounds: x=[${minX}, ${maxX}] (${(minX/info.width).toFixed(3)} to ${(maxX/info.width).toFixed(3)}), y=[${minY}, ${maxY}] (${(minY/info.height).toFixed(3)} to ${(maxY/info.height).toFixed(3)})`);
  console.log(`Brass center: x=${((minX+maxX)/(2*info.width)).toFixed(3)}, y=${((minY+maxY)/(2*info.height)).toFixed(3)}`);
}

analyze();
