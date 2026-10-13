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

  return { root };
}

