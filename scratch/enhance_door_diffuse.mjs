import sharp from "sharp";

async function enhanceDiffuse() {
  const W = 1152;
  const H = 2048;

  const panels = [
    // Top row
    { x1: 195, y1: 225, x2: 520, y2: 445 },
    { x1: 665, y1: 230, x2: 990, y2: 445 },
    // Middle row
    { x1: 195, y1: 560, x2: 520, y2: 1085 },
    { x1: 665, y1: 560, x2: 990, y2: 1085 },
    // Bottom row
    { x1: 195, y1: 1335, x2: 520, y2: 1960 },
    { x1: 665, y1: 1335, x2: 990, y2: 1960 },
  ];

  function smoothstep(min, max, value) {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return t * t * (3 - 2 * t);
  }

  const diffImage = sharp("public/textures/door/door_master_diff.jpg");
  const { data, info } = await diffImage.raw().toBuffer({ resolveWithObject: true });

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 3;

      // Check reveal seam (gap between casing and door leaf)
      let seamDist = Math.min(
        Math.abs(x - 92),
        Math.abs(x - 1060),
        y > 105 ? Math.abs(y - 105) : 999
      );
      if (seamDist <= 4 && y >= 105 && y <= 2010 && x >= 90 && x <= 1062) {
        // Darken the gap line
        data[idx]     = Math.round(data[idx] * 0.40);
        data[idx + 1] = Math.round(data[idx + 1] * 0.40);
        data[idx + 2] = Math.round(data[idx + 2] * 0.38);
        continue;
      }

      // Check panels
      for (const p of panels) {
        if (x >= p.x1 && x <= p.x2 && y >= p.y1 && y <= p.y2) {
          const dxLeft = x - p.x1;
          const dxRight = p.x2 - x;
          const dyTop = y - p.y1;
          const dyBottom = p.y2 - y;
          const d = Math.min(dxLeft, dxRight, dyTop, dyBottom);

          const bevelW = 28;
          const grooveW = 12;

          // Crevice shading in the groove and top/left shadow
          if (d <= bevelW + grooveW) {
            // Shadow from top and left
            let shadowFactor = 1.0;

            // Top edge receives strong shadow
            if (dyTop < bevelW + grooveW) {
              const st = 1.0 - smoothstep(4, bevelW + grooveW, dyTop);
              shadowFactor -= st * 0.38;
            }
            // Left edge receives directional shadow
            if (dxLeft < bevelW + grooveW) {
              const sl = 1.0 - smoothstep(4, bevelW + grooveW, dxLeft);
              shadowFactor -= sl * 0.30;
            }

            // Bottom and right edges catch soft light
            if (dyBottom < bevelW) {
              const sb = 1.0 - smoothstep(0, bevelW, dyBottom);
              shadowFactor += sb * 0.12;
            }
            if (dxRight < bevelW) {
              const sr = 1.0 - smoothstep(0, bevelW, dxRight);
              shadowFactor += sr * 0.10;
            }

            // Bottom of the groove gets natural dirt/AO
            if (d >= bevelW - 6 && d <= bevelW + grooveW) {
              shadowFactor -= 0.15;
            }

            shadowFactor = Math.max(0.40, Math.min(1.20, shadowFactor));

            data[idx]     = Math.min(255, Math.round(data[idx] * shadowFactor));
            data[idx + 1] = Math.min(255, Math.round(data[idx + 1] * shadowFactor));
            data[idx + 2] = Math.min(255, Math.round(data[idx + 2] * shadowFactor));
          }
          break;
        }
      }
    }
  }

  await sharp(data, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 95 })
    .toFile("public/textures/door/door_master_diff.jpg");

  console.log("door_master_diff.jpg successfully enhanced with bevel depth and contact shadows!");
}

enhanceDiffuse();
