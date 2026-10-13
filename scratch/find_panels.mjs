import sharp from "sharp";

async function drawDebug() {
  const image = sharp("public/textures/door/door_master_diff.jpg");
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  function drawRect(x1, y1, x2, y2, r, g, b, thickness = 4) {
    for (let t = 0; t < thickness; t++) {
      for (let x = x1; x <= x2; x++) {
        setPixel(x, y1 + t, r, g, b);
        setPixel(x, y2 - t, r, g, b);
      }
      for (let y = y1; y <= y2; y++) {
        setPixel(x1 + t, y, r, g, b);
        setPixel(x2 - t, y, r, g, b);
      }
    }
  }

  function setPixel(x, y, r, g, b) {
    if (x >= 0 && x < W && y >= 0 && y < H) {
      const idx = (y * W + x) * info.channels;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
    }
  }

  const panels = [
    { x1: 195, y1: 225, x2: 520, y2: 445 },
    { x1: 665, y1: 230, x2: 990, y2: 445 },
    { x1: 195, y1: 560, x2: 520, y2: 1085 },
    { x1: 665, y1: 560, x2: 990, y2: 1085 },
    { x1: 195, y1: 1335, x2: 520, y2: 1960 },
    { x1: 665, y1: 1335, x2: 990, y2: 1960 },
  ];

  panels.forEach(p => drawRect(p.x1, p.y1, p.x2, p.y2, 255, 0, 0, 5));
  drawRect(92, 105, 1060, 2010, 0, 100, 255, 6); // blue door leaf
  drawRect(112, 1031, 233, 1328, 255, 255, 0, 5); // yellow brass plate

  await sharp(data, { raw: { width: W, height: H, channels: info.channels } })
    .resize(576, 1024)
    .jpeg({ quality: 85 })
    .toFile("scratch/panels_debug.jpg");

  console.log("panels_debug.jpg successfully created!");
}

drawDebug();
