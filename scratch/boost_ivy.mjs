import sharp from "sharp";

async function boostIvyFoliage() {
  const files = [
    "public/textures/foliage/ivy_tendril_full.png",
    "public/textures/foliage/ivy_leaf_center.png",
    "public/textures/foliage/ivy_single_large.png",
    "public/textures/foliage/ivy_single_young.png",
  ];

  for (const f of files) {
    const img = sharp(f);
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

    for (let i = 0; i < info.width * info.height; i++) {
      const a = data[i * 4 + 3];
      if (a > 10) {
        // Boost green depth and contrast
        let r = data[i * 4];
        let g = data[i * 4 + 1];
        let b = data[i * 4 + 2];

        // Slightly deepen highlights and enrich greens
        r = Math.round(r * 0.92);
        g = Math.min(255, Math.round(g * 1.06));
        b = Math.round(b * 0.88);

        data[i * 4]     = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
      }
    }

    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile(f);
  }

  console.log("Botanical leaf textures enriched with deep chlorophyll greens!");
}

boostIvyFoliage();
