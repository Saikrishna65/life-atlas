import sharp from "sharp";

async function generateNormalAndAO() {
  const W = 1152;
  const H = 2048;

  const panels = [
    { x1: 195, y1: 225, x2: 520, y2: 445 },
    { x1: 665, y1: 230, x2: 990, y2: 445 },
    { x1: 195, y1: 560, x2: 520, y2: 1085 },
    { x1: 665, y1: 560, x2: 990, y2: 1085 },
    { x1: 195, y1: 1335, x2: 520, y2: 1960 },
    { x1: 665, y1: 1335, x2: 990, y2: 1960 },
  ];

  function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
  }

  // Generate height field in normalized float [0..1]
  const heights = new Float32Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let h = 0.70; // Base door leaf level

      // Frame casing
      if (x <= 92 || x >= 1060) h = 0.85;
      if (y <= 105) h = 0.90;
      if (y >= 2010) h = 0.85;

      // Seam gap
      if ((Math.abs(x - 92) <= 3 || Math.abs(x - 1060) <= 3) && y > 105 && y < 2010) {
        h = 0.50;
      }
      if (Math.abs(y - 105) <= 3 && x > 92 && x < 1060) {
        h = 0.50;
      }

      // Panels
      for (const p of panels) {
        if (x >= p.x1 && x <= p.x2 && y >= p.y1 && y <= p.y2) {
          const dx = Math.min(x - p.x1, p.x2 - x);
          const dy = Math.min(y - p.y1, p.y2 - y);
          const d = Math.min(dx, dy);

          const bevelW = 28;
          const grooveW = 12;
          const raiseW = 24;

          if (d < bevelW) {
            const t = smoothstep(0, bevelW, d);
            h = 0.70 - t * 0.32; // 0.70 down to 0.38
          } else if (d < bevelW + grooveW) {
            h = 0.38;
          } else if (d < bevelW + grooveW + raiseW) {
            const t = smoothstep(bevelW + grooveW, bevelW + grooveW + raiseW, d);
            h = 0.38 + t * 0.18; // 0.38 up to 0.56
          } else {
            h = 0.56;
          }
          break;
        }
      }

      heights[y * W + x] = h;
    }
  }

  // Read diffuse texture to extract fine micro-cracks
  const diffImage = sharp("public/textures/door/door_master_diff.jpg");
  const { data: diffData } = await diffImage.raw().toBuffer({ resolveWithObject: true });

  // Normal Map buffer (RGB)
  const normBuf = Buffer.alloc(W * H * 3);
  // AO Map buffer (Grayscale)
  const aoBuf = Buffer.alloc(W * H);

  // Sobel filter to compute normals
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      // Macro height gradient (Sobel)
      const tl = heights[(y - 1) * W + (x - 1)];
      const t  = heights[(y - 1) * W + x];
      const tr = heights[(y - 1) * W + (x + 1)];
      const l  = heights[y * W + (x - 1)];
      const r  = heights[y * W + (x + 1)];
      const bl = heights[(y + 1) * W + (x - 1)];
      const b  = heights[(y + 1) * W + x];
      const br = heights[(y + 1) * W + (x + 1)];

      const dX_macro = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dY_macro = (bl + 2 * b + br) - (tl + 2 * t + tr);

      // Micro luminance gradient from diffuse image (wood grain & cracks)
      const getLum = (px, py) => {
        const idx = (py * W + px) * 3;
        return (diffData[idx] * 0.299 + diffData[idx + 1] * 0.587 + diffData[idx + 2] * 0.114) / 255.0;
      };

      const m_tl = getLum(x - 1, y - 1);
      const m_t  = getLum(x, y - 1);
      const m_tr = getLum(x + 1, y - 1);
      const m_l  = getLum(x - 1, y);
      const m_r  = getLum(x + 1, y);
      const m_bl = getLum(x - 1, y + 1);
      const m_b  = getLum(x, y + 1);
      const m_br = getLum(x + 1, y + 1);

      const dX_micro = (m_tr + 2 * m_r + m_br) - (m_tl + 2 * m_l + m_bl);
      const dY_micro = (m_bl + 2 * m_b + m_br) - (m_tl + 2 * m_t + m_tr);

      // Blend macro architectural slope + fine crack relief
      const nx = -(dX_macro * 8.0 + dX_micro * 2.2);
      const ny = -(dY_macro * 8.0 + dY_micro * 2.2);
      const nz = 1.0;

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const normX = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      const normY = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      const normZ = Math.round(((nz / len) * 0.5 + 0.5) * 255);

      const outIdx = (y * W + x) * 3;
      normBuf[outIdx] = normX;
      normBuf[outIdx + 1] = normY;
      normBuf[outIdx + 2] = normZ;

      // Compute Ambient Occlusion:
      // Darken inside the groove channels and near cracks
      const curH = heights[y * W + x];
      let ao = 1.0;
      if (curH < 0.65) {
        // Deep groove AO
        ao = 0.55 + (curH - 0.38) * (0.45 / (0.65 - 0.38));
      }
      // Seam gap AO
      if (curH <= 0.50) ao = 0.35;

      aoBuf[y * W + x] = Math.round(Math.min(255, Math.max(0, ao * 255)));
    }
  }

  await sharp(normBuf, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile("public/textures/door/door_master_nor.jpg");

  await sharp(aoBuf, { raw: { width: W, height: H, channels: 1 } })
    .jpeg({ quality: 90 })
    .toFile("public/textures/door/door_master_ao.jpg");

  console.log("Master normal map and AO map successfully created!");
}

generateNormalAndAO();
