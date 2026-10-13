import sharp from "sharp";

async function processTendril() {
  const src = "C:/Users/HP/.gemini/antigravity-ide/brain/03f73338-fa87-45a3-9070-151616055b61/climbing_ivy_tendril_1791879139365.jpg";
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];

    const maxVal = Math.max(r, g, b);
    let alpha = 0;
    if (maxVal > 15) {
      alpha = Math.min(255, Math.round(((maxVal - 15) / 28) * 255));
    }

    rgba[i * 4]     = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = alpha;
  }

  // Full transparent tendril
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile("public/textures/foliage/ivy_tendril_full.png");

  // Single leaf 1 (large center leaf with stem: x: 140 to 450, y: 400 to 720)
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: 140, top: 400, width: 320, height: 320 })
    .png()
    .toFile("public/textures/foliage/ivy_leaf_center.png");

  // Single leaf 2 (top leaf with stem: x: 180 to 520, y: 0 to 280)
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: 180, top: 0, width: 340, height: 280 })
    .png()
    .toFile("public/textures/foliage/ivy_leaf_top.png");

  // Single leaf 3 (right leaf: x: 680 to 920, y: 540 to 760)
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: 680, top: 540, width: 240, height: 220 })
    .png()
    .toFile("public/textures/foliage/ivy_leaf_right.png");

  console.log("Ivy tendrils and leaves processed successfully!");
}

processTendril();
