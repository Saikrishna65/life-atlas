import sharp from "sharp";

async function generateRoughAndMetal() {
  const W = 1152;
  const H = 2048;

  const roughImage = sharp("public/textures/door/door_master_rough.jpg");
  const { data: roughData } = await roughImage.raw().toBuffer({ resolveWithObject: true });

  const metalBuf = Buffer.alloc(W * H);
  const newRoughBuf = Buffer.alloc(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      // original rough value from single channel or first channel
      let r = roughData[idx * (roughData.length === W * H * 3 ? 3 : 1)];

      let isBrass = (x >= 112 && x <= 233 && y >= 1031 && y <= 1328);
      let isHinge = (x >= 1085 && x <= 1115 && ((y >= 280 && y <= 400) || (y >= 1700 && y <= 1820)));

      if (isBrass) {
        // Brass has lower roughness (0.28 to 0.40) and high metalness
        newRoughBuf[idx] = Math.round(75 + (r / 255) * 35);
        metalBuf[idx] = 230; // 0.90 metalness
      } else if (isHinge) {
        // Iron hinge
        newRoughBuf[idx] = 130;
        metalBuf[idx] = 210; // 0.82 metalness
      } else {
        // Wood surface: weathered matte paint (0.72 to 0.85)
        newRoughBuf[idx] = Math.round(180 + (r / 255) * 35);
        metalBuf[idx] = 5; // non-metal
      }
    }
  }

  await sharp(newRoughBuf, { raw: { width: W, height: H, channels: 1 } })
    .jpeg({ quality: 90 })
    .toFile("public/textures/door/door_master_rough.jpg");

  await sharp(metalBuf, { raw: { width: W, height: H, channels: 1 } })
    .jpeg({ quality: 90 })
    .toFile("public/textures/door/door_master_metal.jpg");

  console.log("Refined roughness and metalness maps created!");
}

generateRoughAndMetal();
