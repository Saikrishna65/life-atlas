import * as THREE from "three";

/**
 * Procedural PBR Texture Generator
 * Generates high-resolution textures (albedo, normal, roughness) using HTML5 Canvas.
 * Ensures zero HTTP latency, zero missing asset 404s, and crisp photorealistic details.
 */

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

function heightToNormalMap(heightData: Float32Array, width: number, height: number, strength: number = 2.5): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = (x - 1 + width) % width;
      const x1 = (x + 1) % width;
      const y0 = (y - 1 + height) % height;
      const y1 = (y + 1) % height;

      const hL = heightData[y * width + x0];
      const hR = heightData[y * width + x1];
      const hD = heightData[y0 * width + x];
      const hU = heightData[y1 * width + x];

      const dx = (hR - hL) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = (dx / len) * 0.5 + 0.5;
      const ny = (dy / len) * 0.5 + 0.5;
      const nz = (dz / len) * 0.5 + 0.5;

      const idx = (y * width + x) * 4;
      data[idx] = Math.floor(nx * 255);
      data[idx + 1] = Math.floor(ny * 255);
      data[idx + 2] = Math.floor(nz * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * 1. Weathered Chipped White Wood Textures
 * Distinct peeling white paint with dark aged wood grain underneath, grime and edge wear.
 */
export function createWeatheredWoodTextures(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 1024;
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const albedoCtx = albedoCanvas.getContext("2d")!;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d")!;

  const { noise, fbm } = createNoise2D(width, height, 5);
  const heightData = new Float32Array(width * height);

  const albedoData = albedoCtx.createImageData(width, height);
  const roughData = roughCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;

      // Fine elongated vertical grain lines
      const grain = Math.sin(u * 140 + noise(u * 8, v * 40) * 12) * 0.5 + 0.5;
      // Paint flaking mask: 85% white paint, 15% edge flaking/dark wood
      const chipNoise = fbm(u * 7, v * 18, 4);
      // Grime / aging discoloration
      const grimeNoise = fbm(u * 9, v * 9, 3);

      const isChipped = chipNoise > 0.80;
      const isEdgeChip = chipNoise > 0.74 && chipNoise <= 0.80;

      const idx = (y * width + x) * 4;
      const hIdx = y * width + x;

      if (isChipped) {
        // Dark aged oak wood revealed underneath peeling paint
        const woodVal = 0.28 + grain * 0.16 + grimeNoise * 0.08;
        albedoData.data[idx] = Math.floor(woodVal * 95);     // Dark warm brown
        albedoData.data[idx + 1] = Math.floor(woodVal * 72);  // Olive brown
        albedoData.data[idx + 2] = Math.floor(woodVal * 50);  // Dark umber
        albedoData.data[idx + 3] = 255;

        roughData.data[idx] = Math.floor(210 + grain * 30);
        roughData.data[idx + 1] = roughData.data[idx];
        roughData.data[idx + 2] = roughData.data[idx];
        roughData.data[idx + 3] = 255;

        heightData[hIdx] = woodVal * 0.35;
      } else if (isEdgeChip) {
        // Dark grime line at chipped paint boundary
        albedoData.data[idx] = 110;
        albedoData.data[idx + 1] = 95;
        albedoData.data[idx + 2] = 80;
        albedoData.data[idx + 3] = 255;

        roughData.data[idx] = 240;
        roughData.data[idx + 1] = 240;
        roughData.data[idx + 2] = 240;
        roughData.data[idx + 3] = 255;

        heightData[hIdx] = 0.52;
      } else {
        // Weathered off-white paint with visible wood grain striations
        const paintBase = 244 - (grain * 14) - (grimeNoise * 10);
        albedoData.data[idx] = Math.floor(paintBase);          // White R
        albedoData.data[idx + 1] = Math.floor(paintBase - 5);  // Warm white G
        albedoData.data[idx + 2] = Math.floor(paintBase - 14); // Off-white B
        albedoData.data[idx + 3] = 255;

        const rVal = Math.floor(180 + grimeNoise * 35);
        roughData.data[idx] = rVal;
        roughData.data[idx + 1] = rVal;
        roughData.data[idx + 2] = rVal;
        roughData.data[idx + 3] = 255;

        heightData[hIdx] = 0.88 + grain * 0.08;
      }
    }
  }

  albedoCtx.putImageData(albedoData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);
  const normalCanvas = heightToNormalMap(heightData, width, height, 3.2);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);

  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, normalMap, roughnessMap };
}

/**
 * 2. Tree Bark Texture with Deep Fissures & Rich Moss
 * Organic dark bark with craggy ridges, deep shadow furrows, and velvety green moss.
 */
export function createTreeBarkTextures(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 1024;
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const albedoCtx = albedoCanvas.getContext("2d")!;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d")!;

  const { fbm } = createNoise2D(width, height, 6);
  const heightData = new Float32Array(width * height);

  const albedoData = albedoCtx.createImageData(width, height);
  const roughData = roughCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;

      // Deep elongated vertical bark fissures
      const fissureNoise = fbm(u * 22, v * 5, 5);
      const deepFissure = Math.abs(Math.sin(u * 32 + fissureNoise * 6));
      // Organic moss distribution
      const mossNoise = fbm(u * 7, v * 7, 4);

      const idx = (y * width + x) * 4;
      const hIdx = y * width + x;

      const isMoss = mossNoise > 0.62;

      if (isMoss) {
        // Lush vibrant moss on top surfaces
        const m = (mossNoise - 0.62) / 0.38;
        albedoData.data[idx] = Math.floor(45 + m * 30);      // R
        albedoData.data[idx + 1] = Math.floor(100 + m * 55); // Vibrant green G
        albedoData.data[idx + 2] = Math.floor(25 + m * 20);  // B
        albedoData.data[idx + 3] = 255;

        roughData.data[idx] = 245;
        roughData.data[idx + 1] = 245;
        roughData.data[idx + 2] = 245;
        roughData.data[idx + 3] = 255;

        heightData[hIdx] = 0.85 + m * 0.15;
      } else {
        // Deep dark rich bark tone: authentic aged timber
        const barkTone = 0.18 + (1 - deepFissure) * 0.35 + fissureNoise * 0.12;
        albedoData.data[idx] = Math.floor(barkTone * 72);    // Rich dark brown
        albedoData.data[idx + 1] = Math.floor(barkTone * 52); // Charcoal wood
        albedoData.data[idx + 2] = Math.floor(barkTone * 38); // Umber
        albedoData.data[idx + 3] = 255;

        roughData.data[idx] = Math.floor(225 - deepFissure * 45);
        roughData.data[idx + 1] = roughData.data[idx];
        roughData.data[idx + 2] = roughData.data[idx];
        roughData.data[idx + 3] = 255;

        heightData[hIdx] = (1 - deepFissure) * 0.94;
      }
    }
  }

  albedoCtx.putImageData(albedoData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);
  const normalCanvas = heightToNormalMap(heightData, width, height, 4.5);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);

  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, normalMap, roughnessMap };
}

/**
 * 3. Meadow Terrain Ground Texture
 * Rich dark loam, moss carpet, organic undergrowth and small pebble clods.
 */
export function createGroundTerrainTextures(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 1024;
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const albedoCtx = albedoCanvas.getContext("2d")!;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d")!;

  const { fbm } = createNoise2D(width, height, 5);
  const heightData = new Float32Array(width * height);

  const albedoData = albedoCtx.createImageData(width, height);
  const roughData = roughCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;

      const soilNoise = fbm(u * 14, v * 14, 4);
      const mossNoise = fbm(u * 8, v * 8, 4);
      const pebbleNoise = fbm(u * 36, v * 36, 2);

      const idx = (y * width + x) * 4;
      const hIdx = y * width + x;

      if (mossNoise > 0.44) {
        // Meadow moss carpet
        const m = mossNoise;
        albedoData.data[idx] = Math.floor(38 + m * 35);
        albedoData.data[idx + 1] = Math.floor(75 + m * 55);
        albedoData.data[idx + 2] = Math.floor(20 + m * 18);
        albedoData.data[idx + 3] = 255;

        roughData.data[idx] = 240;
        roughData.data[idx + 1] = 240;
        roughData.data[idx + 2] = 240;
        roughData.data[idx + 3] = 255;

        heightData[hIdx] = 0.65 + m * 0.3;
      } else {
        // Dark rich moist soil
        const s = soilNoise * 0.8 + (pebbleNoise > 0.72 ? 0.35 : 0);
        albedoData.data[idx] = Math.floor(30 + s * 25);
        albedoData.data[idx + 1] = Math.floor(24 + s * 20);
        albedoData.data[idx + 2] = Math.floor(15 + s * 14);
        albedoData.data[idx + 3] = 255;

        roughData.data[idx] = 250;
        roughData.data[idx + 1] = 250;
        roughData.data[idx + 2] = 250;
        roughData.data[idx + 3] = 255;

        heightData[hIdx] = 0.3 + s * 0.45;
      }
    }
  }

  albedoCtx.putImageData(albedoData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);
  const normalCanvas = heightToNormalMap(heightData, width, height, 3.5);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);

  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  map.repeat.set(18, 18);
  normalMap.repeat.set(18, 18);
  roughnessMap.repeat.set(18, 18);

  return { map, normalMap, roughnessMap };
}

/**
 * 4. Weathered Clay Bricks & Field Stone Texture
 */
export function createWeatheredBrickTextures(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = 512;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const { fbm } = createNoise2D(width, height, 8);
  const heightData = new Float32Array(width * height);
  const imgData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const n = fbm(u * 12, v * 12, 4);
      const mossN = fbm(u * 5, v * 5, 3);

      const idx = (y * width + x) * 4;
      const hIdx = y * width + x;

      if (mossN > 0.58) {
        // Moss creeping over brick
        imgData.data[idx] = 48;
        imgData.data[idx + 1] = 98;
        imgData.data[idx + 2] = 28;
        imgData.data[idx + 3] = 255;
        heightData[hIdx] = 0.85;
      } else {
        // Weathered terracotta clay
        const b = 0.55 + n * 0.45;
        imgData.data[idx] = Math.floor(b * 160);     // Red terracotta
        imgData.data[idx + 1] = Math.floor(b * 72);  // Warm brown
        imgData.data[idx + 2] = Math.floor(b * 50);  // Dark earth
        imgData.data[idx + 3] = 255;
        heightData[hIdx] = b;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const normalCanvas = heightToNormalMap(heightData, width, height, 3.5);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normalCanvas);

  return { map, normalMap, roughnessMap: map };
}

/**
 * 5. Ivy Leaf Texture with Alpha Transparency
 */
export function createIvyLeafTexture(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Draw ivy leaf path
  ctx.save();
  ctx.translate(size / 2, size * 0.85);

  const leafPath = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * 0.4, -size * 0.2, -size * 0.5, -size * 0.55, -size * 0.25, -size * 0.65);
    ctx.bezierCurveTo(-size * 0.15, -size * 0.72, 0, -size * 0.95, 0, -size * 0.95);
    ctx.bezierCurveTo(0, -size * 0.95, size * 0.15, -size * 0.72, size * 0.25, -size * 0.65);
    ctx.bezierCurveTo(size * 0.5, -size * 0.55, size * 0.4, -size * 0.2, 0, 0);
    ctx.closePath();
  };

  const grad = ctx.createRadialGradient(0, -size * 0.5, 10, 0, -size * 0.5, size * 0.55);
  grad.addColorStop(0, "#427825");
  grad.addColorStop(0.7, "#285416");
  grad.addColorStop(1, "#18380e");

  leafPath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(150, 205, 100, 0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -size * 0.9);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.3);
  ctx.lineTo(-size * 0.3, -size * 0.48);
  ctx.moveTo(0, -size * 0.3);
  ctx.lineTo(size * 0.3, -size * 0.48);
  ctx.moveTo(0, -size * 0.55);
  ctx.lineTo(-size * 0.18, -size * 0.7);
  ctx.moveTo(0, -size * 0.55);
  ctx.lineTo(size * 0.18, -size * 0.7);
  ctx.stroke();

  ctx.restore();

  const imgData = ctx.getImageData(0, 0, size, size);
  const heightData = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const alpha = imgData.data[i * 4 + 3] / 255;
    heightData[i] = alpha * 0.8;
  }
  const normalCanvas = heightToNormalMap(heightData, size, size, 2.0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normalCanvas);

  return { map, normalMap };
}

/**
 * 6. Wildflower Daisy Texture
 */
export function createDaisyTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.translate(size / 2, size / 2);

  const petals = 12;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < petals; i++) {
    ctx.rotate((Math.PI * 2) / petals);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.32, size * 0.08, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const centerGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, size * 0.16);
  centerGrad.addColorStop(0, "#ffcc00");
  centerGrad.addColorStop(0.8, "#e69900");
  centerGrad.addColorStop(1, "#995c00");

  ctx.beginPath();
  ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = centerGrad;
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
