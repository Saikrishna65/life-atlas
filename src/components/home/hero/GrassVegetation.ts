import * as THREE from "three";
import { loadFoliageTextures } from "./textureLoader";

export interface GrassAssembly {
  clumpMeshA: THREE.InstancedMesh;
  clumpMeshB: THREE.InstancedMesh;
  clumpMeshC: THREE.InstancedMesh;
  flowerMesh: THREE.InstancedMesh;
  updateWind: (time: number) => void;
}

/**
 * Creates photorealistic wild meadow vegetation using 3 distinct multi-blade clump archetypes:
 * - Clump A: Gracefully arching meadow grass tufts
 * - Clump B: Low wild clover / broadleaf ground cover rosettes
 * - Clump C: Tall wild pasture grass with delicate wispy plumes
 * - Wild chamomile daisies scattered organically
 * Features wind vertex shader sway, root-to-tip ambient occlusion, and sunlit translucency.
 */
export function createGrassVegetation(
  getElevation: (x: number, z: number) => number
): GrassAssembly {
  const windUniform = { value: 0 };

  // Botanical clump geometries
  const clumpAGeo = createArchingTuftGeometry();
  const clumpBGeo = createCloverRosetteGeometry();
  const clumpCGeo = createTallPastureTuftGeometry();

  // Natural translucent vegetation material with sunlit subsurface glow
  const vegetationMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.62,
    metalness: 0.0,
    side: THREE.DoubleSide,
    vertexColors: true,
    emissive: new THREE.Color(0x152808), // Translucent sun-warmed glow
  });

  vegetationMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniform;
    shader.vertexShader = `
      uniform float uTime;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      float hFactor = clamp(position.y * 3.8, 0.0, 1.2);
      float sway = sin(uTime * 1.6 + transformed.x * 2.5 + transformed.z * 1.8) * 0.028 * hFactor;
      float swayGust = sin(uTime * 0.8 + transformed.z * 0.9) * 0.018 * hFactor;
      transformed.x += sway + swayGust;
      transformed.z += sway * 0.7;
      `
    );
  };

  const countA = 14000; // Arching meadow tufts (~126,000 fine blades)
  const countB = 7000;  // Low broadleaf clovers
  const countC = 6500;  // Tall pasture stalks

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

  // Rich, vibrant, alpine meadow palette matching reference
  const tintPalette = [
    new THREE.Color(0x487c1b), // Vibrant summer grass
    new THREE.Color(0x5ca223), // Sunlit golden-green shoot
    new THREE.Color(0x386814), // Deep lush meadow green
    new THREE.Color(0x6eb828), // Sun-drenched translucent blade tip
    new THREE.Color(0x3e6d16), // Alpine turf
  ];

  populateInstancedMesh(clumpMeshA, countA, getElevation, dummy, tintPalette, 0.85, 1.25);
  populateInstancedMesh(clumpMeshB, countB, getElevation, dummy, tintPalette, 0.65, 1.05, true);
  populateInstancedMesh(clumpMeshC, countC, getElevation, dummy, tintPalette, 0.80, 1.30);

  // ----------------------------------------------------
  // 3. WILDFLOWERS (BOTANICAL DAISIES WITH GOLDEN CENTERS)
  // ----------------------------------------------------
  const { daisyMap } = loadFoliageTextures();
  const flowerGeo = new THREE.PlaneGeometry(0.068, 0.068);
  flowerGeo.rotateX(-Math.PI / 2);

  const flowerMat = new THREE.MeshStandardMaterial({
    map: daisyMap,
    transparent: true,
    alphaTest: 0.35,
    roughness: 0.45,
    metalness: 0.0,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x181810),
  });

  const flowerCount = 850;
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  flowerMesh.name = "WildflowersInstanced";
  flowerMesh.castShadow = false;

  let fPlaced = 0;
  for (let f = 0; f < flowerCount; f++) {
    const z = Math.pow(Math.random(), 0.70) * 4.2 + 0.25;
    const x = (Math.random() - 0.5) * (9.5 + z * 1.4);

    if (Math.abs(x) < 0.45 && Math.abs(z) < 0.30) continue;

    const groundY = getElevation(x, z) + 0.09 + Math.random() * 0.07;

    dummy.position.set(x, groundY, z);
    const scale = 0.75 + Math.random() * 0.55;
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

  const updateWind = (time: number) => {
    windUniform.value = time;
  };

  return { clumpMeshA, clumpMeshB, clumpMeshC, flowerMesh, updateWind };
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
    let scaleMult = 1.0;
    const r = Math.random();

    if (r < 0.45) {
      // Foreground: z from 0.05 to +4.5
      z = Math.pow(Math.random(), 0.75) * 4.4 + 0.05;
    } else if (r < 0.75) {
      // Midground: z from -0.1 to -7.0
      z = -Math.pow(Math.random(), 0.85) * 7.0;
    } else {
      // Distant rolling meadow reaching the backdrop: z from -7.0 to -18.5
      z = -7.0 - Math.random() * 11.5;
      scaleMult = 1.25 + Math.random() * 0.45; // Slightly larger for great distant coverage
    }

    const x = (Math.random() - 0.5) * (20.0 + (z > 0 ? z * 2.2 : -z * 1.6));

    if (Math.abs(x) < 0.42 && Math.abs(z) < 0.22) continue;

    const onBricks = x > -0.88 && x < -0.46 && z > 0.01 && z < 0.38;
    if (onBricks && !isGroundCover) continue;

    const groundY = getElevation(x, z);
    let scale = (minScale + Math.random() * (maxScale - minScale)) * scaleMult;

    // In front of the door, gently taper grass height so the door threshold and lower rail are visible
    if (Math.abs(x) < 0.85 && z > 0.05 && z < 1.1) {
      scale *= Math.min(1.0, 0.35 + z * 0.55);
    }

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
