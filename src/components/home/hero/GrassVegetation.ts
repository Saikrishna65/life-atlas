import * as THREE from "three";
import { createDaisyTexture } from "./textureGenerator";

export interface GrassAssembly {
  clumpMeshA: THREE.InstancedMesh;
  clumpMeshB: THREE.InstancedMesh;
  clumpMeshC: THREE.InstancedMesh;
  flowerMesh: THREE.InstancedMesh;
}

/**
 * Creates photorealistic wild meadow vegetation using 3 distinct multi-blade clump archetypes:
 * - Clump A: Gracefully arching meadow grass tufts (9 fine, curving, drooping blades)
 * - Clump B: Low wild clover / broadleaf ground cover rosettes
 * - Clump C: Tall wild pasture grass with delicate wispy plumes
 * Uses calibrated sRGB palette + root-to-tip AO multipliers and natural 0.80 roughness.
 */
export function createGrassVegetation(
  getElevation: (x: number, z: number) => number
): GrassAssembly {
  // ----------------------------------------------------
  // 1. BOTANICAL CLUMP GEOMETRIES
  // ----------------------------------------------------
  const clumpAGeo = createArchingTuftGeometry();
  const clumpBGeo = createCloverRosetteGeometry();
  const clumpCGeo = createTallPastureTuftGeometry();

  // Natural non-specular vegetation material
  const vegetationMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.82,
    metalness: 0.0,
    side: THREE.DoubleSide,
    vertexColors: true,
  });

  // ----------------------------------------------------
  // 2. INSTANCED DISTRIBUTION
  // ----------------------------------------------------
  const countA = 14000; // Arching meadow tufts (~126,000 fine blades)
  const countB = 7000;  // Low broadleaf clovers & ground cover
  const countC = 6500;  // Tall pasture stalks (~39,000 blades)

  const clumpMeshA = new THREE.InstancedMesh(clumpAGeo, vegetationMaterial, countA);
  clumpMeshA.name = "MeadowTuftsA";
  clumpMeshA.castShadow = true;
  clumpMeshA.receiveShadow = true;

  const clumpMeshB = new THREE.InstancedMesh(clumpBGeo, vegetationMaterial, countB);
  clumpMeshB.name = "CloverRosettesB";
  clumpMeshB.castShadow = true;
  clumpMeshB.receiveShadow = true;

  const clumpMeshC = new THREE.InstancedMesh(clumpCGeo, vegetationMaterial, countC);
  clumpMeshC.name = "PastureTuftsC";
  clumpMeshC.castShadow = true;
  clumpMeshC.receiveShadow = true;

  const dummy = new THREE.Object3D();

  // Rich, vibrant, saturated alpine meadow palette matching reference
  const tintPalette = [
    new THREE.Color(0x386814), // Rich deep meadow green
    new THREE.Color(0x447a18), // Vibrant summer grass
    new THREE.Color(0x2d5210), // Deep shadow clover
    new THREE.Color(0x4e881c), // Sun-warmed golden shoot
    new THREE.Color(0x325c12), // Lush alpine turf
  ];

  // Populate Clump A (Arching meadow grass)
  populateInstancedMesh(clumpMeshA, countA, getElevation, dummy, tintPalette, 0.85, 1.25);

  // Populate Clump B (Low clovers & ground cover)
  populateInstancedMesh(clumpMeshB, countB, getElevation, dummy, tintPalette, 0.65, 1.05, true);

  // Populate Clump C (Tall pasture grass)
  populateInstancedMesh(clumpMeshC, countC, getElevation, dummy, tintPalette, 0.80, 1.30);

  // ----------------------------------------------------
  // 3. WILDFLOWERS (WHITE DAISIES WITH GOLDEN CENTERS)
  // ----------------------------------------------------
  const daisyTex = createDaisyTexture();
  const flowerGeo = new THREE.PlaneGeometry(0.052, 0.052);
  flowerGeo.rotateX(-Math.PI / 2);

  const flowerMat = new THREE.MeshStandardMaterial({
    map: daisyTex,
    transparent: true,
    alphaTest: 0.45,
    roughness: 0.65,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const flowerCount = 650;
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  flowerMesh.name = "WildflowersInstanced";
  flowerMesh.castShadow = false;

  let fPlaced = 0;
  for (let f = 0; f < flowerCount; f++) {
    const z = Math.pow(Math.random(), 0.70) * 4.0 + 0.30;
    const x = (Math.random() - 0.5) * (9.5 + z * 1.4);

    if (Math.abs(x) < 0.45 && Math.abs(z) < 0.30) continue;

    const groundY = getElevation(x, z) + 0.10 + Math.random() * 0.08;

    dummy.position.set(x, groundY, z);
    const scale = 0.7 + Math.random() * 0.55;
    dummy.scale.set(scale, scale, scale);

    dummy.rotation.set(
      -0.18 + (Math.random() - 0.5) * 0.35,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.25
    );
    dummy.updateMatrix();
    flowerMesh.setMatrixAt(fPlaced, dummy.matrix);
    fPlaced++;
  }

  flowerMesh.count = fPlaced;
  flowerMesh.instanceMatrix.needsUpdate = true;

  return { clumpMeshA, clumpMeshB, clumpMeshC, flowerMesh };
}

function populateInstancedMesh(
  mesh: THREE.InstancedMesh,
  count: number,
  getElevation: (x: number, z: number) => number,
  dummy: THREE.Object3D,
  palette: THREE.Color[],
  minScale: number,
  maxScale: number,
  isGroundCover: boolean = false
) {
  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 4;

  while (placed < count && attempts < maxAttempts) {
    attempts++;

    let z: number;
    if (Math.random() < 0.72) {
      z = Math.pow(Math.random(), 0.75) * 4.1 + 0.1;
    } else {
      z = -Math.pow(Math.random(), 0.85) * 7.5;
    }

    const x = (Math.random() - 0.5) * (20.0 + (z > 0 ? z * 2.0 : -z * 1.4));

    if (Math.abs(x) < 0.42 && Math.abs(z) < 0.22) continue;

    const onBricks = x > -0.76 && x < -0.42 && z > 0.02 && z < 0.38;
    if (onBricks && !isGroundCover) continue;

    const groundY = getElevation(x, z);
    const scale = minScale + Math.random() * (maxScale - minScale);

    dummy.position.set(x, groundY, z);
    dummy.scale.set(scale, scale * (0.90 + Math.random() * 0.25), scale);

    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 0.25;
    const roll = (Math.random() - 0.5) * 0.25;
    dummy.rotation.set(pitch, yaw, roll);

    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);

    const tint = palette[Math.floor(Math.random() * palette.length)];
    mesh.setColorAt(placed, tint);

    placed++;
  }

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function createArchingTuftGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const bladeConfigs = [
    { angle: 0.15, length: 0.22, archZ: 0.08, archX: 0.02, width: 0.0075 },
    { angle: 0.85, length: 0.24, archZ: 0.09, archX: 0.03, width: 0.0080 },
    { angle: 1.60, length: 0.20, archZ: 0.07, archX: -0.02, width: 0.0070 },
    { angle: 2.35, length: 0.23, archZ: 0.09, archX: -0.03, width: 0.0078 },
    { angle: 3.10, length: 0.19, archZ: 0.06, archX: -0.01, width: 0.0072 },
    { angle: 3.85, length: 0.25, archZ: 0.10, archX: 0.02, width: 0.0082 },
    { angle: 4.60, length: 0.21, archZ: 0.07, archX: 0.03, width: 0.0074 },
    { angle: 5.35, length: 0.23, archZ: 0.09, archX: -0.02, width: 0.0078 },
    { angle: 6.00, length: 0.18, archZ: 0.06, archX: 0.01, width: 0.0068 },
  ];

  bladeConfigs.forEach((cfg) => {
    buildCurvedBlade(cfg, positions, normals, colors, indices);
  });

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

function createCloverRosetteGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const leafAngles = [0, 1.25, 2.51, 3.77, 5.03];
  leafAngles.forEach((angle) => {
    const vOffset = positions.length / 3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const r = 0.055;
    const w = 0.028;

    positions.push(0, 0.008, 0);
    normals.push(0, 1, 0);
    colors.push(0.20, 0.32, 0.15); // Root AO

    positions.push(cos * r * 0.6 - sin * w, 0.022, sin * r * 0.6 + cos * w);
    normals.push(0, 1, 0);
    colors.push(0.85, 0.95, 0.80);

    positions.push(cos * r * 0.6 + sin * w, 0.022, sin * r * 0.6 - cos * w);
    normals.push(0, 1, 0);
    colors.push(0.85, 0.95, 0.80);

    positions.push(cos * r, 0.015, sin * r);
    normals.push(0, 1, 0);
    colors.push(1.05, 1.10, 0.90);

    indices.push(vOffset, vOffset + 1, vOffset + 3);
    indices.push(vOffset, vOffset + 3, vOffset + 2);
  });

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

function createTallPastureTuftGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const bladeConfigs = [
    { angle: 0.25, length: 0.28, archZ: 0.07, archX: 0.02, width: 0.0068 },
    { angle: 1.40, length: 0.32, archZ: 0.09, archX: -0.03, width: 0.0072 },
    { angle: 2.60, length: 0.26, archZ: 0.06, archX: -0.02, width: 0.0065 },
    { angle: 3.90, length: 0.30, archZ: 0.08, archX: 0.03, width: 0.0070 },
    { angle: 5.15, length: 0.25, archZ: 0.06, archX: 0.02, width: 0.0064 },
    { angle: 5.95, length: 0.29, archZ: 0.08, archX: -0.01, width: 0.0069 },
  ];

  bladeConfigs.forEach((cfg) => {
    buildCurvedBlade(cfg, positions, normals, colors, indices);
  });

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

function buildCurvedBlade(
  cfg: { angle: number; length: number; archZ: number; archX: number; width: number },
  positions: number[],
  normals: number[],
  colors: number[],
  indices: number[]
) {
  const vOffset = positions.length / 3;
  const cos = Math.cos(cfg.angle);
  const sin = Math.sin(cfg.angle);

  // Multipliers on top of the rich sRGB palette:
  // Root has dark AO (0.15), mid has natural tones (0.7-0.9), tip has sunlit warmth (1.10)
  const levels = [
    { prog: 0.0, w: cfg.width * 0.5, arch: 0.0, col: [0.15, 0.25, 0.10] }, // Root AO
    { prog: 0.3, w: cfg.width * 0.44, arch: 0.15, col: [0.55, 0.70, 0.45] },
    { prog: 0.7, w: cfg.width * 0.28, arch: 0.55, col: [0.85, 0.95, 0.75] },
    { prog: 1.0, w: 0.0, arch: 1.0, col: [1.10, 1.15, 0.95] },              // Sunlit tip
  ];

  for (let i = 0; i < levels.length - 1; i++) {
    const lvl = levels[i];
    const y = lvl.prog * cfg.length;
    const curl = lvl.arch * cfg.archZ;
    const lateral = lvl.arch * cfg.archX;

    const cx = cos * curl - sin * lateral;
    const cz = sin * curl + cos * lateral;

    const px = -sin * lvl.w;
    const pz = cos * lvl.w;

    positions.push(cx - px, y, cz - pz);
    normals.push(cos * 0.4, 0.7, sin * 0.4);
    colors.push(lvl.col[0], lvl.col[1], lvl.col[2]);

    positions.push(cx + px, y, cz + pz);
    normals.push(cos * 0.4, 0.7, sin * 0.4);
    colors.push(lvl.col[0], lvl.col[1], lvl.col[2]);
  }

  const top = levels[levels.length - 1];
  const topY = top.prog * cfg.length;
  const topCurl = top.arch * cfg.archZ;
  const topLat = top.arch * cfg.archX;
  const tipX = cos * topCurl - sin * topLat;
  const tipZ = sin * topCurl + cos * topLat;

  positions.push(tipX, topY, tipZ);
  normals.push(cos * 0.5, 0.8, sin * 0.5);
  colors.push(top.col[0], top.col[1], top.col[2]);
  const tipIdx = vOffset + (levels.length - 1) * 2;

  for (let i = 0; i < levels.length - 2; i++) {
    const bl = vOffset + i * 2;
    const br = vOffset + i * 2 + 1;
    const tl = vOffset + (i + 1) * 2;
    const tr = vOffset + (i + 1) * 2 + 1;

    indices.push(bl, br, tl);
    indices.push(br, tr, tl);
  }

  const lastL = vOffset + (levels.length - 2) * 2;
  const lastR = vOffset + (levels.length - 2) * 2 + 1;
  indices.push(lastL, lastR, tipIdx);
}
