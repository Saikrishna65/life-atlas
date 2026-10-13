import * as THREE from "three";
import { loadPBRTextures } from "./textureLoader";

export interface TerrainAssembly {
  mesh: THREE.Mesh;
  getElevation: (x: number, z: number) => number;
}

/**
 * Natural uneven meadow terrain mesh with photogrammetry PBR soil/moss scan textures.
 * Expands into a sweeping meadow reaching the horizon.
 */
export function createTerrain(): TerrainAssembly {
  const width = 48;
  const depth = 34;
  const segX = 160;
  const segZ = 120;

  // Elevation function: natural gentle knolls that slope gently to meet the backdrop
  const getElevation = (x: number, z: number): number => {
    // Gentle natural undulating meadow contours
    const m1 = Math.sin(x * 0.22) * Math.cos(z * 0.20) * 0.05;
    const m2 = Math.cos(x * 0.45 + 0.8) * Math.sin(z * 0.35) * 0.03;
    const m3 = Math.sin(x * 0.9 + z * 0.7) * 0.015;

    let height = m1 + m2 + m3;

    // Gentle upward slope towards distant horizon to meet the backdrop meadow
    if (z < -3) {
      height += Math.pow(Math.max(0, -z - 3) * 0.055, 1.25) * 0.65;
    }

    // Natural smooth resting bed directly under the door footing
    const doorDist = Math.sqrt(Math.pow(x * 0.9, 2) + Math.pow(z * 1.5, 2));
    if (doorDist < 1.8) {
      const blend = Math.min(1, Math.max(0, (doorDist - 0.5) / 1.3));
      height = height * blend;
    }

    return height;
  };

  const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geometry.rotateX(-Math.PI / 2);

  // Position center so z extends from +8 (in front of camera) to -26 (at the backdrop)
  geometry.translate(0, 0, -9);

  const posAttr = geometry.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getElevation(x, z);
    posAttr.setY(i, y);
  }

  geometry.computeVertexNormals();

  // Load CC0 photogrammetry ground PBR maps
  const { map, normalMap, roughnessMap } = loadPBRTextures("ground");
  map.repeat.set(18, 22);
  normalMap.repeat.set(18, 22);
  roughnessMap.repeat.set(18, 22);

  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(1.8, 1.8),
    roughnessMap,
    roughness: 0.85,
    metalness: 0.01,
    color: 0x487622, // Sun-warmed vibrant meadow turf
    emissive: new THREE.Color(0x0e1c07), // Ambient soil bounce
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "TerrainMesh";
  mesh.receiveShadow = true;

  return { mesh, getElevation };
}
