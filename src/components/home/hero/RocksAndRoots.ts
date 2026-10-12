import * as THREE from "three";
import { loadPBRTextures } from "./textureLoader";

export interface RocksAndRootsAssembly {
  root: THREE.Group;
}

/**
 * Creates the weathered brick stack at the left door base,
 * scattered irregular field rocks, and exposed crawling roots
 * using photogrammetry PBR scan textures.
 */
export function createRocksAndRoots(
  getElevation: (x: number, z: number) => number
): RocksAndRootsAssembly {
  const root = new THREE.Group();
  root.name = "RocksAndRootsAssembly";

  // ----------------------------------------------------
  // 1. WEATHERED BRICK STACK AT LEFT DOOR BASE
  // Prominently featured in reference: broken rustic terracotta bricks with moss
  // ----------------------------------------------------
  const { map: brickMap, normalMap: brickNor, roughnessMap: brickRough } = loadPBRTextures("brick");
  brickMap.repeat.set(1.5, 1.5);
  brickNor.repeat.set(1.5, 1.5);
  brickRough.repeat.set(1.5, 1.5);

  const brickMaterial = new THREE.MeshStandardMaterial({
    map: brickMap,
    normalMap: brickNor,
    normalScale: new THREE.Vector2(2.4, 2.4),
    roughnessMap: brickRough,
    roughness: 0.78,
    metalness: 0.02,
    color: 0xfa9070, // Warm rustic red-orange terracotta clay
  });

  const brickGroup = new THREE.Group();
  brickGroup.name = "BrickStack";

  const brickW = 0.22;
  const brickH = 0.075;
  const brickD = 0.115;
  const brickGeo = new THREE.BoxGeometry(brickW, brickH, brickD);

  // Stack of rustic weathered bricks resting naturally at the left jamb base
  const brickPositions = [
    { x: -0.58, y: 0.04, z: 0.14, rotY: 0.08, rotZ: 0.02 },
    { x: -0.56, y: 0.04, z: 0.26, rotY: -0.14, rotZ: -0.01 },
    { x: -0.60, y: 0.115, z: 0.18, rotY: 0.12, rotZ: 0.03 },
    { x: -0.57, y: 0.19, z: 0.16, rotY: -0.06, rotZ: -0.04 },
    { x: -0.59, y: 0.265, z: 0.15, rotY: 0.07, rotZ: 0.02 },
    { x: -0.58, y: 0.34, z: 0.14, rotY: -0.10, rotZ: 0.04 },
    // Crumbling fallen bricks around the base
    { x: -0.72, y: 0.04, z: 0.28, rotY: 0.42, rotZ: 0.08 },
    { x: -0.76, y: 0.04, z: 0.12, rotY: -0.32, rotZ: -0.05 },
    { x: -0.48, y: 0.04, z: 0.32, rotY: 0.22, rotZ: 0.0 },
    // Top broken half brick
    { x: -0.58, y: 0.41, z: 0.13, rotY: 0.16, rotZ: 0.08 },
  ];

  brickPositions.forEach((bp, idx) => {
    const bMesh = new THREE.Mesh(brickGeo, brickMaterial);
    bMesh.position.set(bp.x, bp.y, bp.z);
    bMesh.rotation.set(0, bp.rotY, bp.rotZ);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    bMesh.name = `Brick_${idx}`;
    brickGroup.add(bMesh);
  });

  root.add(brickGroup);

  // ----------------------------------------------------
  // 2. SCATTERED IRREGULAR FIELD ROCKS & STONES
  // ----------------------------------------------------
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x7e7668,
    roughness: 0.86,
    metalness: 0.02,
  });

  const rockConfigs = [
    { x: -0.88, z: 0.40, r: 0.16 },
    { x: 0.65, z: 0.30, r: 0.14 },
    { x: 0.82, z: 0.15, r: 0.12 },
    { x: -0.45, z: -0.40, r: 0.13 },
    { x: -1.9, z: 2.0, r: 0.24 },
    { x: 1.5, z: 2.4, r: 0.20 },
    { x: -3.0, z: 3.4, r: 0.28 },
    { x: 2.8, z: 3.0, r: 0.22 },
    { x: -0.4, z: 3.6, r: 0.16 },
    { x: -4.6, z: 0.8, r: 0.34 },
    { x: 4.8, z: 1.0, r: 0.30 },
  ];

  rockConfigs.forEach((rc, idx) => {
    const geo = new THREE.DodecahedronGeometry(rc.r, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const noise = 1.0 + (Math.sin(vx * 15 + vy * 12) * 0.15 + Math.cos(vz * 14) * 0.1);
      pos.setXYZ(i, vx * noise, vy * noise * 0.8, vz * noise);
    }
    geo.computeVertexNormals();

    const rockMesh = new THREE.Mesh(geo, rockMaterial);
    const groundY = getElevation(rc.x, rc.z);
    rockMesh.position.set(rc.x, groundY + rc.r * 0.35, rc.z);
    rockMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    rockMesh.name = `FieldRock_${idx}`;
    root.add(rockMesh);
  });

  // ----------------------------------------------------
  // 3. EXPOSED GNARLED ROOTS
  // ----------------------------------------------------
  const { map: barkMap, normalMap: barkNor, roughnessMap: barkRough } = loadPBRTextures("bark");
  barkMap.repeat.set(2, 6);
  barkNor.repeat.set(2, 6);
  barkRough.repeat.set(2, 6);

  const rootMaterial = new THREE.MeshStandardMaterial({
    map: barkMap,
    normalMap: barkNor,
    normalScale: new THREE.Vector2(2.0, 2.0),
    roughnessMap: barkRough,
    roughness: 0.88,
    metalness: 0.02,
  });

  const rootCurves = [
    [
      new THREE.Vector3(-4.8, getElevation(-4.8, 0.6) + 0.1, 0.6),
      new THREE.Vector3(-3.9, getElevation(-3.9, 0.45) + 0.08, 0.45),
      new THREE.Vector3(-3.0, getElevation(-3.0, 0.32) + 0.05, 0.32),
      new THREE.Vector3(-2.1, getElevation(-2.1, 0.22) + 0.02, 0.22),
      new THREE.Vector3(-1.4, getElevation(-1.4, 0.12) - 0.02, 0.12),
    ],
    [
      new THREE.Vector3(5.0, getElevation(5.0, 0.85) + 0.1, 0.85),
      new THREE.Vector3(4.0, getElevation(4.0, 0.95) + 0.08, 0.95),
      new THREE.Vector3(3.2, getElevation(3.2, 1.15) + 0.05, 1.15),
      new THREE.Vector3(2.3, getElevation(2.3, 1.25) + 0.02, 1.25),
      new THREE.Vector3(1.6, getElevation(1.6, 1.35) - 0.02, 1.35),
    ],
  ];

  rootCurves.forEach((pts, rIdx) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const rootGeo = new THREE.TubeGeometry(curve, 36, 0.095, 12, false);
    const rootMesh = new THREE.Mesh(rootGeo, rootMaterial);
    rootMesh.castShadow = true;
    rootMesh.receiveShadow = true;
    rootMesh.name = `ExposedRoot_${rIdx}`;
    root.add(rootMesh);
  });

  return { root };
}
