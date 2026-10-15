import * as THREE from "three";

/**
 * Procedural PBR Textures for the Life Atlas "Door to the Outside World" Prototype.
 * Generates high-definition, authentic architectural textures directly via HTML5 Canvas.
 * Ensures zero HTTP latency, zero missing assets, and instant deterministic loading.
 */

// Helper: 2D smooth noise
function createNoise2D(width: number, height: number, scale: number = 8) {
  const tableSize = 256;
  const p: number[] = new Array(tableSize * 2);
  const permutation = Array.from({ length: tableSize }, (_, i) => i).sort(() => Math.random() - 0.5);
  for (let i = 0; i < tableSize * 2; i++) {
    p[i] = permutation[i % tableSize];
  }

  function fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  function grad(hash: number, x: number, y: number) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  const noise = (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];

    const x1 = lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf));
    const x2 = lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1));
    return (lerp(v, x1, x2) + 1) * 0.5;
  };

  const fbm = (x: number, y: number, octaves: number = 4) => {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return total / maxValue;
  };

  return { noise, fbm };
}

/**
 * 1. Polished Architectural Concrete Floor Textures
 * Matches the reference image: light architectural grey concrete with soft clouding,
 * fine aggregate grit, and a smooth semi-gloss / satin polish with restrained reflections.
 */
export function createConcreteFloorTextures(): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 1024;

  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const albedoCtx = albedoCanvas.getContext("2d")!;
  const albedoData = albedoCtx.createImageData(width, height);

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d")!;
  const roughData = roughCtx.createImageData(width, height);

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = width;
  normalCanvas.height = height;
  const normalCtx = normalCanvas.getContext("2d")!;
  const normalData = normalCtx.createImageData(width, height);

  const { fbm, noise } = createNoise2D(width, height, 4);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;

      const cloud1 = fbm(u * 2.2, v * 2.2, 4);
      const cloud2 = fbm(u * 5.5 + 0.4, v * 5.5 + 0.6, 3);
      const fineGrit = noise(u * 38, v * 38);

      const tone = 0.74 + (cloud1 - 0.5) * 0.16 + (cloud2 - 0.5) * 0.08 + (fineGrit - 0.5) * 0.03;
      const r = Math.floor(Math.min(255, Math.max(0, tone * 240)));
      const g = Math.floor(Math.min(255, Math.max(0, tone * 244)));
      const b = Math.floor(Math.min(255, Math.max(0, tone * 248)));

      const idx = (y * width + x) * 4;
      albedoData.data[idx] = r;
      albedoData.data[idx + 1] = g;
      albedoData.data[idx + 2] = b;
      albedoData.data[idx + 3] = 255;

      const roughVal = Math.floor(Math.min(255, Math.max(0, (0.24 + (cloud1 - 0.5) * 0.10 + (fineGrit - 0.5) * 0.04) * 255)));
      roughData.data[idx] = roughVal;
      roughData.data[idx + 1] = roughVal;
      roughData.data[idx + 2] = roughVal;
      roughData.data[idx + 3] = 255;

      const nx = 128 + Math.floor((noise(u * 50 + 0.1, v * 50) - 0.5) * 10);
      const ny = 128 + Math.floor((noise(u * 50, v * 50 + 0.1) - 0.5) * 10);
      normalData.data[idx] = nx;
      normalData.data[idx + 1] = ny;
      normalData.data[idx + 2] = 255;
      normalData.data[idx + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);
  normalCtx.putImageData(normalData, 0, 0);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap, normalMap };
}

/**
 * 2. Fine Interior Wall Plaster Textures
 * Soft matte stippling and micro-relief in luminous pale grey / warm off-white.
 */
export function createWallPlasterTextures(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = 512;
  const height = 512;

  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const albedoCtx = albedoCanvas.getContext("2d")!;
  const albedoData = albedoCtx.createImageData(width, height);

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = width;
  normalCanvas.height = height;
  const normalCtx = normalCanvas.getContext("2d")!;
  const normalData = normalCtx.createImageData(width, height);

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d")!;
  const roughData = roughCtx.createImageData(width, height);

  const { noise } = createNoise2D(width, height, 8);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;

      const n1 = noise(u * 28, v * 28);
      const n2 = noise(u * 56, v * 56);
      const stipple = (n1 * 0.6 + n2 * 0.4 - 0.5) * 0.022;

      const base = 0.96 + stipple;
      const idx = (y * width + x) * 4;

      albedoData.data[idx] = Math.floor(Math.min(255, base * 247));
      albedoData.data[idx + 1] = Math.floor(Math.min(255, base * 250));
      albedoData.data[idx + 2] = Math.floor(Math.min(255, base * 252));
      albedoData.data[idx + 3] = 255;

      const r = Math.floor((0.85 + stipple * 0.5) * 255);
      roughData.data[idx] = r;
      roughData.data[idx + 1] = r;
      roughData.data[idx + 2] = r;
      roughData.data[idx + 3] = 255;

      normalData.data[idx] = 128 + Math.floor((n1 - 0.5) * 8);
      normalData.data[idx + 1] = 128 + Math.floor((n2 - 0.5) * 8);
      normalData.data[idx + 2] = 255;
      normalData.data[idx + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoData, 0, 0);
  normalCtx.putImageData(normalData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, normalMap, roughnessMap };
}

/**
 * 3. Outdoor Meadow Turf Textures
 * Vibrant sun-warmed meadow ground cover with green and gold blade nuances.
 */
export function createMeadowTurfTextures(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 1024;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(width, height);

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d")!;
  const roughData = roughCtx.createImageData(width, height);

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = width;
  normalCanvas.height = height;
  const normalCtx = normalCanvas.getContext("2d")!;
  const normalData = normalCtx.createImageData(width, height);

  const { fbm, noise } = createNoise2D(width, height, 6);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;

      const clump = fbm(u * 10, v * 10, 4);
      const detail = noise(u * 40, v * 40);

      const blend = clump * 0.65 + detail * 0.35;
      const r = Math.floor(125 + blend * 75);
      const g = Math.floor(185 + blend * 65);
      const b = Math.floor(48 + blend * 45);

      const idx = (y * width + x) * 4;
      imgData.data[idx] = Math.min(255, r);
      imgData.data[idx + 1] = Math.min(255, g);
      imgData.data[idx + 2] = Math.min(255, b);
      imgData.data[idx + 3] = 255;

      const rough = Math.floor((0.70 + (detail - 0.5) * 0.2) * 255);
      roughData.data[idx] = rough;
      roughData.data[idx + 1] = rough;
      roughData.data[idx + 2] = rough;
      roughData.data[idx + 3] = 255;

      normalData.data[idx] = 128 + Math.floor((noise(u * 40, v * 40) - 0.5) * 26);
      normalData.data[idx + 1] = 128 + Math.floor((noise(u * 40 + 0.2, v * 40 + 0.2) - 0.5) * 26);
      normalData.data[idx + 2] = 255;
      normalData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);
  normalCtx.putImageData(normalData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap, normalMap };
}

/**
 * 4. High-Fidelity Outdoor Mountain & Sky Panorama
 * A painted panoramic canvas matching the exact landscape in the reference artwork:
 * - Upper 50%: Luminous daylight blue sky with soft white cumulus clouds and gentle sun glow.
 * - Mid 30%: Majestic distant mountain ranges with aerial blue haze, atmospheric perspective, and soft ridge contours.
 * - Lower 20%: Sunlit woodland grove and rolling horizon meadow meeting the 3D terrain seamlessly.
 */
export function createPhotorealisticOutdoorBackdrop(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // 1. Sky Gradient (Zenith down to horizon)
  const horizonY = height * 0.62; // 635px (precisely 38% from bottom)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0.0, "#4892df"); // Deep daylight blue
  skyGrad.addColorStop(0.35, "#70abe7"); // Mid sky blue
  skyGrad.addColorStop(0.65, "#a5d0f6"); // Lower atmospheric sky
  skyGrad.addColorStop(0.85, "#d6eaf8"); // Luminous sunlit horizon haze
  skyGrad.addColorStop(1.0, "#f4f8fc"); // Pure horizon glow

  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Soft Golden Sun Disc & Radial Glow (Upper Left Quadrant)
  const sunX = width * 0.36;
  const sunY = height * 0.28;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 14, sunX, sunY, width * 0.45);
  sunGlow.addColorStop(0.0, "rgba(255, 255, 248, 0.98)");
  sunGlow.addColorStop(0.12, "rgba(255, 252, 238, 0.75)");
  sunGlow.addColorStop(0.35, "rgba(255, 246, 222, 0.38)");
  sunGlow.addColorStop(0.70, "rgba(240, 248, 255, 0.10)");
  sunGlow.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");

  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, width, height);

  // 3. Cumulus & Cirrus Clouds (Upper Atmosphere)
  const { fbm, noise } = createNoise2D(width, height, 5);
  const cloudData = ctx.getImageData(0, 0, width, Math.floor(horizonY));

  for (let y = Math.floor(height * 0.05); y < Math.floor(horizonY * 0.90); y++) {
    const v = y / (horizonY * 0.90);
    const vertEnvelope = Math.sin(v * Math.PI);

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const cNoise = fbm(u * 6.5, v * 10.0, 5);

      if (cNoise > 0.40) {
        const cloudAlpha = Math.min(1.0, (cNoise - 0.40) * 2.8 * vertEnvelope);
        const idx = (y * width + x) * 4;

        const distToSun = Math.sqrt(Math.pow((x - sunX) / width, 2) + Math.pow((y - sunY) / height, 2));
        const sunWarmth = Math.max(0, 1 - distToSun * 2.2);

        const cr = 250 + Math.floor(sunWarmth * 5);
        const cg = 252 + Math.floor(sunWarmth * 3);
        const cb = 255 - Math.floor(sunWarmth * 12);

        cloudData.data[idx] = Math.floor(cloudData.data[idx] * (1 - cloudAlpha * 0.88) + cr * (cloudAlpha * 0.88));
        cloudData.data[idx + 1] = Math.floor(cloudData.data[idx + 1] * (1 - cloudAlpha * 0.88) + cg * (cloudAlpha * 0.88));
        cloudData.data[idx + 2] = Math.floor(cloudData.data[idx + 2] * (1 - cloudAlpha * 0.88) + cb * (cloudAlpha * 0.88));
      }
    }
  }
  ctx.putImageData(cloudData, 0, 0);

  // 4. Distant Mountain Range 1 (Far Alpine Peaks with Cyan-Blue Atmospheric Haze)
  // Peaks rise up to y = height * 0.44
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, horizonY);

  for (let x = 0; x <= width; x += 6) {
    const u = x / width;
    const p1 = Math.sin(u * 12.0 + 0.3) * 0.06;
    const p2 = Math.cos(u * 24.0 + 1.2) * 0.028;
    const p3 = Math.sin(u * 48.0) * 0.012;
    const mY = horizonY - 0.14 * height + (p1 + p2 + p3) * height;
    ctx.lineTo(x, mY);
  }
  ctx.lineTo(width, horizonY);
  ctx.lineTo(width, height);
  ctx.closePath();

  const m1Grad = ctx.createLinearGradient(0, horizonY - 0.20 * height, 0, horizonY);
  m1Grad.addColorStop(0.0, "#8ab0cb"); // Sunlit mountain ridge crest
  m1Grad.addColorStop(0.4, "#7298b4"); // Mid slope blue
  m1Grad.addColorStop(0.85, "#9cbfd9"); // Atmospheric valley mist
  m1Grad.addColorStop(1.0, "#c2dcf0"); // Low haze
  ctx.fillStyle = m1Grad;
  ctx.fill();
  ctx.restore();

  // 5. Midground Mountain Range 2 (Closer Rolling Green/Blue Ridges)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, horizonY);

  for (let x = 0; x <= width; x += 5) {
    const u = x / width;
    const r1 = Math.sin(u * 8.5 + 1.4) * 0.042;
    const r2 = Math.cos(u * 17.0 + 0.5) * 0.020;
    const r3 = Math.sin(u * 34.0) * 0.008;
    const rY = horizonY - 0.08 * height + (r1 + r2 + r3) * height;
    ctx.lineTo(x, rY);
  }
  ctx.lineTo(width, horizonY);
  ctx.lineTo(width, height);
  ctx.closePath();

  const m2Grad = ctx.createLinearGradient(0, horizonY - 0.12 * height, 0, horizonY);
  m2Grad.addColorStop(0.0, "#5b849b"); // Deeper slate cyan
  m2Grad.addColorStop(0.35, "#4c778f"); // Mid mountain body
  m2Grad.addColorStop(0.75, "#5b8869"); // Greenish mountain foot
  m2Grad.addColorStop(1.0, "#7eb288"); // Blends into horizon
  ctx.fillStyle = m2Grad;
  ctx.fill();
  ctx.restore();

  // 6. Horizon Treeline & Woodland Grove (Soft leafy canopies at mountain foot)
  ctx.save();
  for (let x = 0; x < width; x += 12) {
    const u = x / width;
    const treeH = 14 + noise(u * 22, 0.5) * 18;
    const treeY = horizonY - treeH;
    const treeR = 10 + noise(u * 16, 0.8) * 12;

    const tGrad = ctx.createRadialGradient(x, treeY, 2, x, treeY, treeR);
    tGrad.addColorStop(0.0, "#72a838"); // Sunlit leafy crown
    tGrad.addColorStop(0.6, "#4a7826"); // Rich olive green body
    tGrad.addColorStop(1.0, "rgba(50, 80, 25, 0.0)");

    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.arc(x, treeY, treeR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 7. Horizon Meadow Band (Meets the 3D terrain elevation at y = horizonY)
  const hGrad = ctx.createLinearGradient(0, horizonY - 10, 0, height);
  hGrad.addColorStop(0.0, "rgba(125, 185, 50, 0.4)");
  hGrad.addColorStop(0.15, "#82be38");
  hGrad.addColorStop(0.55, "#94cc40");
  hGrad.addColorStop(1.0, "#a2d848");

  ctx.fillStyle = hGrad;
  ctx.fillRect(0, horizonY - 2, width, height - horizonY + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
