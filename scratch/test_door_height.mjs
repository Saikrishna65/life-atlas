import sharp from "sharp";

// Let's create an accurate height map for the door in scratch/door_height_test.png
const W = 1152;
const H = 2048;

// Panel rectangles in pixel coordinates [x1, y1, x2, y2]
// Based on our verified debug image:
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

// Frame bounds:
// Left jamb: 0 to 92
// Right jamb: 1060 to 1152
// Top lintel: 0 to 105
// Threshold sill: 2010 to 2048

const heightBuf = Buffer.alloc(W * H);

function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // Default door leaf surface = 180 (base level 0)
    let val = 180;

    // 1. Frame Casing (projects forward)
    // Left jamb
    if (x <= 92) {
      val = 215; // +15mm
    }
    // Right jamb
    if (x >= 1060) {
      val = 215; // +15mm
    }
    // Top lintel
    if (y <= 105) {
      val = 230; // +20mm
    }
    // Threshold sill
    if (y >= 2010) {
      val = 220; // +18mm
    }

    // Door reveal seam (shadow gap between casing and door leaf)
    // Seam along left: around x=92
    if (Math.abs(x - 92) <= 4 && y > 105 && y < 2010) {
      val = 130; // -20mm shadow gap
    }
    // Seam along right: around x=1060
    if (Math.abs(x - 1060) <= 4 && y > 105 && y < 2010) {
      val = 130;
    }
    // Seam along top: around y=105
    if (Math.abs(y - 105) <= 4 && x > 92 && x < 1060) {
      val = 130;
    }

    // 2. Six Recessed Panels with Bevelled Mouldings and Raised Centers
    for (const p of panels) {
      if (x >= p.x1 && x <= p.x2 && y >= p.y1 && y <= p.y2) {
        // Distance to outer panel edge
        const dx = Math.min(x - p.x1, p.x2 - x);
        const dy = Math.min(y - p.y1, p.y2 - y);
        const d = Math.min(dx, dy);

        // Bevel width ~26 pixels in 1152px width (approx 2.5cm)
        const bevelW = 26;
        const grooveW = 12;
        const raiseW = 24;

        if (d < bevelW) {
          // Outer moulding sloping DOWN from door leaf (180) to deep groove (100)
          const t = smoothstep(0, bevelW, d);
          val = 180 - t * 80; // 180 -> 100
        } else if (d < bevelW + grooveW) {
          // Bottom of the groove
          val = 100;
        } else if (d < bevelW + grooveW + raiseW) {
          // Inner moulding sloping UP from groove (100) to raised field center (145)
          const t = smoothstep(bevelW + grooveW, bevelW + grooveW + raiseW, d);
          val = 100 + t * 45; // 100 -> 145
        } else {
          // Flat raised field center
          val = 145;
        }
        break;
      }
    }

    heightBuf[y * W + x] = Math.round(val);
  }
}

await sharp(heightBuf, { raw: { width: W, height: H, channels: 1 } })
  .resize(576, 1024)
  .png()
  .toFile("scratch/door_height_test.png");

console.log("door_height_test.png generated!");
