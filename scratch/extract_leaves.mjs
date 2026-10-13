import sharp from "sharp";

async function extractLeaves() {
  const src = "C:/Users/HP/.gemini/antigravity-ide/brain/03f73338-fa87-45a3-9070-151616055b61/botanical_ivy_leaf_1791868334298.jpg";
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  // Create RGBA buffer where black background is transparent
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];

    const lum = Math.max(r, g, b);
    let alpha = 0;
    if (lum > 18) {
      alpha = Math.min(255, Math.round(((lum - 18) / 30) * 255));
    }

    rgba[i * 4]     = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = alpha;
  }

  // 1. Center main leaf (from x: 260 to 760, y: 70 to 650)
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: 260, top: 70, width: 500, height: 580 })
    .png()
    .toFile("public/textures/foliage/ivy_single_large.png");

  // 2. Small young leaf at bottom center (x: 360 to 660, y: 580 to 980)
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: 360, top: 580, width: 300, height: 400 })
    .png()
    .toFile("public/textures/foliage/ivy_single_young.png");

  // 3. Complete branch cluster with transparent alpha
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile("public/textures/foliage/ivy_branch_clean.png");

  console.log("Individual ivy leaf textures extracted successfully!");
}

extractLeaves();
