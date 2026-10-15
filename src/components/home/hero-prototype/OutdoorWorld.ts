import * as THREE from "three";
import { createMeadowTurfTextures, createPhotorealisticOutdoorBackdrop } from "./proceduralTextures";

export interface OutdoorWorldAssembly {
  root: THREE.Group;
  terrainMesh: THREE.Mesh;
  backdropMesh: THREE.Mesh;
  treelineGroup: THREE.Group;
  mountainGroup: THREE.Group;
  grassMesh: THREE.InstancedMesh;
  sunLight: THREE.DirectionalLight;
  skyLight: THREE.HemisphereLight;
  getElevation: (x: number, z: number) => number;
}

/**
 * Creates the outdoor landscape visible through the doorway matching the reference artwork:
 * - Natural rolling meadow terrain with seamless transition at the door threshold.
 * - Instanced sunlit grass blades and meadow flowers catching rim light.
 * - 3D Treeline clusters framing the mountain foot with real-time highlights.
 * - 3D Distant mountain ridges with atmospheric perspective and blue haze.
 * - Photorealistic atmospheric sky backdrop with soft cumulus clouds and sun glow.
 * - Warm directional sunlight entering through the doorway.
 * - All elements remain independently editable.
 */
export function createOutdoorWorld(): OutdoorWorldAssembly {
  const root = new THREE.Group();
  root.name = "OutdoorWorldRoot";

  // -------------------------------------------------------------------------
  // 1. ELEVATION FUNCTION (SEAMLESS THRESHOLD TO HORIZON)
  // -------------------------------------------------------------------------
  const getElevation = (x: number, z: number): number => {
    const dx = x - 1.6;
    const dz = z;
    const distToDoor = Math.sqrt(dx * dx + dz * dz);

    if (distToDoor < 1.4) {
      const blend = Math.max(0, (distToDoor - 0.4) / 1.0);
      return -0.012 * blend;
    }

    const w1 = Math.sin(x * 0.16) * Math.cos(z * 0.14) * 0.12;
    const w2 = Math.cos(x * 0.32 + 1.0) * Math.sin(z * 0.20) * 0.06;

    let height = w1 + w2;

    if (z < -6) {
      const dist = Math.abs(z) - 6;
      height += Math.pow(dist * 0.026, 1.18) * 0.72;
    }

    return height;
  };

  // -------------------------------------------------------------------------
  // 2. MEADOW TERRAIN MESH
  // -------------------------------------------------------------------------
  const terrainW = 85;
  const terrainD = 55;
  const segX = 140;
  const segZ = 100;

  const terrainGeo = new THREE.PlaneGeometry(terrainW, terrainD, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(1.6, 0, -terrainD / 2);

  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getElevation(vx, vz);
    posAttr.setY(i, vy);
  }
  terrainGeo.computeVertexNormals();

  const { map: turfMap, normalMap: turfNor, roughnessMap: turfRough } = createMeadowTurfTextures();
  turfMap.repeat.set(16, 16);
  turfNor.repeat.set(16, 16);
  turfRough.repeat.set(16, 16);

  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: turfMap,
    normalMap: turfNor,
    roughnessMap: turfRough,
    color: 0x6e9f34, // Vibrant sun-warmed meadow turf
    roughness: 0.72,
    metalness: 0.0,
    emissive: new THREE.Color(0x182c0a), // Warm subsurface soil bounce
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMaterial);
  terrainMesh.name = "MeadowTerrainMesh";
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // -------------------------------------------------------------------------
  // 3. INSTANCED FOREGROUND GRASS & MEADOW WILDFLOWERS
  // -------------------------------------------------------------------------
  const grassGeo = createGrassTuftGeometry();

  const grassMat = new THREE.MeshStandardMaterial({
    roughness: 0.44,
    metalness: 0.0,
    side: THREE.DoubleSide,
    vertexColors: true,
    emissive: new THREE.Color(0x284612), // Warm sunlit translucency
  });

  const grassCount = 3800;
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grassMesh.name = "ThresholdGrass";
  grassMesh.castShadow = true;
  grassMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let placed = 0;

  for (let i = 0; i < grassCount; i++) {
    const u = Math.random();
    const v = Math.random();

    const zDist = -0.08 - Math.pow(u, 1.25) * 11.5;
    const spreadW = 1.5 + Math.abs(zDist) * 0.48;
    const xPos = 1.6 + (v - 0.5) * spreadW;

    const yPos = getElevation(xPos, zDist);

    dummy.position.set(xPos, yPos, zDist);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.rotation.x = (Math.random() - 0.5) * 0.14;
    dummy.rotation.z = (Math.random() - 0.5) * 0.14;

    const scale = 0.72 + Math.random() * 0.55;
    dummy.scale.set(scale, scale * (0.85 + Math.random() * 0.45), scale);
    dummy.updateMatrix();

    grassMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  root.add(grassMesh);

  // -------------------------------------------------------------------------
  // 4. 3D MIDGROUND TREELINE (SITS ALONG THE HORIZON)
  // Real 3D trees with sun-dappled foliage at z = -40m to -46m
  // -------------------------------------------------------------------------
  const treelineGroup = new THREE.Group();
  treelineGroup.name = "MidgroundTreeline";

  const treeCanopyMat = new THREE.MeshStandardMaterial({
    color: 0x487524,
    roughness: 0.82,
    metalness: 0.0,
  });

  const treeHighlightMat = new THREE.MeshStandardMaterial({
    color: 0x72a838,
    roughness: 0.78,
    metalness: 0.0,
  });

  const treePositions = [
    { x: -5.0, z: -42, r: 1.8, h: 2.6 },
    { x: -2.8, z: -44, r: 2.2, h: 3.0 },
    { x: -0.8, z: -41, r: 2.0, h: 2.8 },
    { x: 0.8, z: -40, r: 1.6, h: 2.4 },
    { x: 2.4, z: -41, r: 2.0, h: 2.8 },
    { x: 4.2, z: -43, r: 2.4, h: 3.2 },
    { x: 6.0, z: -42, r: 2.1, h: 2.9 },
    { x: 8.0, z: -45, r: 2.6, h: 3.4 },
  ];

  treePositions.forEach((tp, idx) => {
    const yBase = getElevation(tp.x, tp.z);
    const treeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(tp.r, 8, 7),
      idx % 2 === 0 ? treeHighlightMat : treeCanopyMat
    );
    treeMesh.scale.set(1.0, tp.h / tp.r, 0.9);
    treeMesh.position.set(tp.x, yBase + tp.h * 0.45, tp.z);
    treelineGroup.add(treeMesh);
  });
  root.add(treelineGroup);

  // -------------------------------------------------------------------------
  // 5. 3D DISTANT MOUNTAIN RIDGES (AERIAL PERSPECTIVE)
  // -------------------------------------------------------------------------
  const mountainGroup = new THREE.Group();
  mountainGroup.name = "DistantMountains";

  const mountainMat1 = new THREE.MeshStandardMaterial({
    color: 0x587e9c, // Muted slate-cyan blue
    roughness: 0.95,
    metalness: 0.0,
  });

  const mGeo1 = createMountainRidgeGeometry(85, 9, 36, 2.5);
  mGeo1.translate(1.6, 0.85, -54);
  const mMesh1 = new THREE.Mesh(mGeo1, mountainMat1);
  mountainGroup.add(mMesh1);

  const mountainMat2 = new THREE.MeshStandardMaterial({
    color: 0x7fa5c2, // Lighter atmospheric haze cyan
    roughness: 0.98,
    metalness: 0.0,
  });

  const mGeo2 = createMountainRidgeGeometry(110, 13, 40, 3.6);
  mGeo2.translate(0, 1.10, -68);
  const mMesh2 = new THREE.Mesh(mGeo2, mountainMat2);
  mountainGroup.add(mMesh2);

  root.add(mountainGroup);

  // -------------------------------------------------------------------------
  // 6. PHOTOREALISTIC OUTDOOR SKY & CLOUDS BACKDROP
  // -------------------------------------------------------------------------
  const backdropTex = createPhotorealisticOutdoorBackdrop();
  const backdropW = 95;
  const backdropH = 48;
  const backdropGeo = new THREE.PlaneGeometry(backdropW, backdropH);
  backdropGeo.translate(1.6, 1.2, -72);

  const backdropMat = new THREE.MeshBasicMaterial({
    map: backdropTex,
    depthWrite: false,
  });

  const backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
  backdropMesh.name = "PhotorealisticOutdoorBackdrop";
  root.add(backdropMesh);

  // -------------------------------------------------------------------------
  // 7. LIGHTING SETUP
  // -------------------------------------------------------------------------
  const sunLight = new THREE.DirectionalLight(0xfff7e8, 3.6);
  sunLight.name = "SunDirectionalLight";
  sunLight.position.set(-5.5, 14.0, -10.0);
  sunLight.target.position.set(1.2, 0.0, 2.4);
  sunLight.castShadow = true;

  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1.0;
  sunLight.shadow.camera.far = 32.0;
  sunLight.shadow.camera.left = -4.5;
  sunLight.shadow.camera.right = 6.5;
  sunLight.shadow.camera.top = 5.5;
  sunLight.shadow.camera.bottom = -3.5;
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.02;

  root.add(sunLight);
  root.add(sunLight.target);

  const skyLight = new THREE.HemisphereLight(
    0xa8d4fa, // Clear daylight sky blue
    0x588532, // Meadow bounce green
    1.25
  );
  skyLight.name = "HemisphereSkyLight";
  skyLight.position.set(0, 20, 0);
  root.add(skyLight);

  return {
    root,
    terrainMesh,
    backdropMesh,
    treelineGroup,
    mountainGroup,
    grassMesh,
    sunLight,
    skyLight,
    getElevation,
  };
}

/**
 * Generates an instanced multi-blade grass tuft geometry with vertex colors.
 */
function createGrassTuftGeometry(): THREE.BufferGeometry {
  const bladeCount = 7;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const height = 0.22 + Math.random() * 0.20;
    const halfW = 0.011 * (0.8 + Math.random() * 0.4);
    const bend = 0.040 + Math.random() * 0.06;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const perpX = -sinA * halfW;
    const perpZ = cosA * halfW;

    const baseIdx = positions.length / 3;

    positions.push(-perpX, 0, -perpZ);
    positions.push(perpX, 0, perpZ);

    const midX = cosA * bend * 0.4;
    const midZ = sinA * bend * 0.4;
    positions.push(midX - perpX * 0.6, height * 0.5, midZ - perpZ * 0.6);
    positions.push(midX + perpX * 0.6, height * 0.5, midZ + perpZ * 0.6);

    const tipX = cosA * bend;
    const tipZ = sinA * bend;
    positions.push(tipX, height, tipZ);

    for (let v = 0; v < 5; v++) {
      normals.push(0, 1, 0);
    }

    colors.push(0.24, 0.44, 0.10);
    colors.push(0.24, 0.44, 0.10);
    colors.push(0.50, 0.78, 0.22);
    colors.push(0.50, 0.78, 0.22);
    colors.push(0.88, 0.96, 0.40);

    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
    indices.push(baseIdx + 2, baseIdx + 3, baseIdx + 4);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

/**
 * Generates an organic mountain ridge silhouette mesh.
 */
function createMountainRidgeGeometry(
  width: number,
  height: number,
  segments: number,
  peakVariation: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -width / 2 + t * width;
    const p1 = Math.sin(t * Math.PI * 3.2 + 0.4) * 0.38;
    const p2 = Math.cos(t * Math.PI * 6.5) * 0.20;
    const p3 = Math.sin(t * Math.PI * 12.0) * 0.09;
    const envelope = Math.sin(t * Math.PI);

    const y = (height * 0.45 + (p1 + p2 + p3) * peakVariation) * envelope;
    shape.lineTo(x, y);
  }

  shape.lineTo(width / 2, 0);
  shape.closePath();

  return new THREE.ShapeGeometry(shape);
}
