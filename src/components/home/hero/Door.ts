import * as THREE from "three";
import { loadMasterDoorTextures, loadWhiteWeatheredWoodTextures, loadFoliageTextures, loadPBRTextures } from "./textureLoader";

export interface DoorAssembly {
  root: THREE.Group;
  doorLeaf: THREE.Group;
  doorFrame: THREE.Group;
  pivot: THREE.Group;
  openDoor: (progress: number) => void;
}

/**
 * Creates an exact 1:1 photorealistic 3D replica of the antique weathered white wooden door
 * matching the reference artwork:
 * - Dimensional architectural relief with physical panel bevels and shadow reveals
 * - Master PBR orthographic texture atlas with authentic craquelure, rain streaks, and chipped white paint
 * - Antique turned brass spherical doorknob perfectly aligned with the lock plate
 * - Dark iron butt hinges on the right jamb
 * - Asymmetric, organic botanical climbing ivy matching the reference:
 *     * Lower-left jamb & brick cluster (tapers off at the lock rail)
 *     * Top lintel leafy crown perched on the header
 *     * Upper-right corner trailing cluster (lower-right jamb remains bare wood)
 * - Tumbled, weathered terracotta bricks nestled at the left footing with moss & soil embedding
 */
export function createDoor(): DoorAssembly {
  const root = new THREE.Group();
  root.name = "DoorAssembly";

  // ----------------------------------------------------
  // 1. PBR MATERIALS
  // ----------------------------------------------------
  const { map: masterDiff, normalMap: masterNor, roughnessMap: masterRough, aoMap: masterAo, metalnessMap: masterMetal } = loadMasterDoorTextures();

  const doorFrontMat = new THREE.MeshStandardMaterial({
    map: masterDiff,
    normalMap: masterNor,
    normalScale: new THREE.Vector2(2.2, 2.2),
    roughnessMap: masterRough,
    metalnessMap: masterMetal,
    aoMap: masterAo,
    aoMapIntensity: 1.35,
    roughness: 0.82,
    metalness: 0.08,
    color: 0xfffaf2, // Warm antique bone white
  });

  const { map: sideWoodMap, normalMap: sideWoodNor, roughnessMap: sideWoodRough } = loadWhiteWeatheredWoodTextures();
  sideWoodMap.repeat.set(1.0, 2.5);
  sideWoodNor.repeat.set(1.0, 2.5);
  sideWoodRough.repeat.set(1.0, 2.5);

  const frameWoodMat = new THREE.MeshStandardMaterial({
    map: sideWoodMap,
    normalMap: sideWoodNor,
    normalScale: new THREE.Vector2(1.8, 1.8),
    roughnessMap: sideWoodRough,
    roughness: 0.76,
    metalness: 0.02,
    color: 0xf5f2e8, // Warm antique bone white matching front casing
  });

  // Dark weathered threshold wood/stone
  const sillMat = new THREE.MeshStandardMaterial({
    color: 0x221c16,
    roughness: 0.92,
    metalness: 0.03,
  });

  // Antique brass hardware
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xdeb055,
    metalness: 0.95,
    roughness: 0.22,
  });

  // Antique iron butt hinges
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x36302a,
    metalness: 0.82,
    roughness: 0.52,
  });

  // ----------------------------------------------------
  // 2. DIMENSIONS & COORDINATES (CENTERED AT X = 0)
  // ----------------------------------------------------
  const totalWidth = 1.18;   // Outer casing width
  const totalHeight = 2.22;  // Outer casing height
  const frameDepth = 0.12;   // 12cm wall casing depth
  const halfW = totalWidth / 2; // 0.59m

  const pivot = new THREE.Group();
  pivot.name = "HingePivot";
  pivot.position.set(halfW, 0, 0); // Pivot at right hinge edge

  const doorLeaf = new THREE.Group();
  doorLeaf.name = "DoorLeaf";
  doorLeaf.position.set(-halfW, 0, 0); // Local space relative to pivot centers the door at X = 0

  // ----------------------------------------------------
  // 3. PHYSICAL 3D ARCHITECTURAL RELIEF FRONT MESH
  // Subdivided plane with analytical displaced panel bevels,
  // stiles, rails, reveal seams and outer casing projection.
  // ----------------------------------------------------
  const segX = 180;
  const segY = 320;
  const reliefGeo = new THREE.PlaneGeometry(totalWidth, totalHeight, segX, segY);
  reliefGeo.translate(0, totalHeight / 2, 0); // Y: [0, totalHeight], X: [-halfW, +halfW]

  const posAttr = reliefGeo.attributes.position as THREE.BufferAttribute;
  const uvAttr = reliefGeo.attributes.uv as THREE.BufferAttribute;

  // Panel bounds in pixel space (1152x2048)
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

  function smoothstep(min: number, max: number, value: number): number {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return t * t * (3 - 2 * t);
  }

  for (let i = 0; i < posAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    const px = u * 1152;
    const py = (1.0 - v) * 2048;

    let z = 0.0; // Base door leaf level

    // 1. Frame Casing (projects forward by 14mm)
    if (px <= 92 || px >= 1060) {
      z = 0.014;
    }
    if (py <= 105) {
      z = 0.018;
    }
    if (py >= 2010) {
      z = 0.014;
    }

    // Door reveal seam (shadow gap between casing and door leaf)
    if ((Math.abs(px - 92) <= 3.5 || Math.abs(px - 1060) <= 3.5) && py > 105 && py < 2010) {
      z = -0.018;
    }
    if (Math.abs(py - 105) <= 3.5 && px > 92 && px < 1060) {
      z = -0.018;
    }

    // 2. Six Recessed Panels with Bevelled Mouldings and Raised Centers
    for (const p of panels) {
      if (px >= p.x1 && px <= p.x2 && py >= p.y1 && py <= p.y2) {
        const dx = Math.min(px - p.x1, p.x2 - px);
        const dy = Math.min(py - p.y1, p.y2 - py);
        const d = Math.min(dx, dy);

        const bevelW = 28;
        const grooveW = 12;
        const raiseW = 24;

        if (d < bevelW) {
          // Outer moulding sloping DOWN into the groove
          const t = smoothstep(0, bevelW, d);
          z = -t * 0.028; // 0 down to -28mm deep recess
        } else if (d < bevelW + grooveW) {
          // Bottom of groove
          z = -0.028;
        } else if (d < bevelW + grooveW + raiseW) {
          // Inner moulding sloping UP from groove to raised field
          const t = smoothstep(bevelW + grooveW, bevelW + grooveW + raiseW, d);
          z = -0.028 + t * 0.018; // -28mm up to -10mm
        } else {
          // Flat raised field center
          z = -0.010;
        }
        break;
      }
    }

    posAttr.setZ(i, z);
  }

  reliefGeo.computeVertexNormals();
  reliefGeo.setAttribute("uv2", reliefGeo.attributes.uv.clone());

  const frontMesh = new THREE.Mesh(reliefGeo, doorFrontMat);
  frontMesh.castShadow = true;
  frontMesh.receiveShadow = true;
  doorLeaf.add(frontMesh);

  // ----------------------------------------------------
  // 4. SOLID SIDES, CASING HEADER & BACK (12cm Deep)
  // ----------------------------------------------------
  const casingGroup = new THREE.Group();
  casingGroup.name = "DoorCasingDepth";

  // Left jamb return side
  const leftSide = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, totalHeight, frameDepth),
    frameWoodMat
  );
  leftSide.position.set(-halfW - 0.0075, totalHeight / 2, -frameDepth / 2);
  leftSide.castShadow = true;
  leftSide.receiveShadow = true;
  casingGroup.add(leftSide);

  // Right jamb return side
  const rightSide = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, totalHeight, frameDepth),
    frameWoodMat
  );
  rightSide.position.set(halfW + 0.0075, totalHeight / 2, -frameDepth / 2);
  rightSide.castShadow = true;
  rightSide.receiveShadow = true;
  casingGroup.add(rightSide);

  // Top lintel header cap (projects forward and out matching reference)
  const lintelCap = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth + 0.10, 0.080, frameDepth + 0.05),
    frameWoodMat
  );
  lintelCap.position.set(0, totalHeight + 0.038, -frameDepth / 2 + 0.022);
  lintelCap.castShadow = true;
  lintelCap.receiveShadow = true;
  casingGroup.add(lintelCap);

  // Weathered threshold sill at base
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth + 0.14, 0.055, frameDepth + 0.08),
    sillMat
  );
  sill.position.set(0, 0.027, -frameDepth / 2 + 0.03);
  sill.castShadow = true;
  sill.receiveShadow = true;
  casingGroup.add(sill);

  // Back face of door
  const backMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(totalWidth, totalHeight),
    frameWoodMat
  );
  backMesh.rotation.y = Math.PI;
  backMesh.position.set(0, totalHeight / 2, -frameDepth);
  backMesh.receiveShadow = true;
  casingGroup.add(backMesh);

  doorLeaf.add(casingGroup);

  // ----------------------------------------------------
  // 5. AUTHENTIC 3D ANTIQUE BRASS HARDWARE
  // Perfectly aligned with the painted rosette on the texture
  // ----------------------------------------------------
  const knobX = -halfW + (168 / 1152) * totalWidth; // ~ -0.418m
  const knobY = (1.0 - 1195 / 2048) * totalHeight;  // ~ 0.925m

  // Turned Brass Rosette Collar
  const rosette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, 0.010, 24),
    brassMat
  );
  rosette.rotation.x = Math.PI / 2;
  rosette.position.set(knobX, knobY, 0.007);
  rosette.castShadow = true;
  doorLeaf.add(rosette);

  // Turned Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.012, 0.024, 18),
    brassMat
  );
  stem.rotation.x = Math.PI / 2;
  stem.position.set(knobX, knobY, 0.020);
  stem.castShadow = true;
  doorLeaf.add(stem);

  // Antique Spherical Brass Doorknob (projects forward & catches sun glint)
  const knobSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 28, 28),
    brassMat
  );
  knobSphere.scale.set(1, 1, 0.90);
  knobSphere.position.set(knobX, knobY, 0.040);
  knobSphere.castShadow = true;
  doorLeaf.add(knobSphere);

  // ----------------------------------------------------
  // 6. IRON BUTT HINGES ON RIGHT CASING
  // Matching hinges visible on the reference right jamb
  // ----------------------------------------------------
  const hingeX = -halfW + (1095 / 1152) * totalWidth; // ~ +0.531m
  const hingeYs = [
    (1.0 - 340 / 2048) * totalHeight,
    (1.0 - 1760 / 2048) * totalHeight,
  ];

  hingeYs.forEach((hY) => {
    const knuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.11, 16),
      ironMat
    );
    knuckle.position.set(hingeX, hY, 0.014);
    knuckle.castShadow = true;
    doorLeaf.add(knuckle);
  });

  pivot.add(doorLeaf);
  root.add(pivot);

  // ----------------------------------------------------
  // 7. ORGANIC BOTANICAL CLIMBING IVY (ACCURATE TO REFERENCE)
  // Matching reference artwork:
  // - Cluster A: Lower-left jamb & bricks (tapers off at lock rail)
  // ----------------------------------------------------
  // 7. PHOTOREALISTIC BOTANICAL CLIMBING IVY
  // Matching reference artwork with extreme fidelity:
  // - Real 3D woody climbing vine stems snaking up the casing
  // - High-resolution botanical tendril shoots with visible stems & petioles
  // - Curved individual ivy leaves with waxy specular gloss & translucent veins
  // - Natural spacing showing the antique white wood of the jamb behind
  // ----------------------------------------------------
  const { 
    ivyTendrilMap, 
    ivyLeafLargeMap, 
    ivyLeafYoungMap, 
    ivyLeafCenterMap 
  } = loadFoliageTextures();

  // Woody vine stem material
  const vineStemMat = new THREE.MeshStandardMaterial({
    color: 0x483a2c, // Weathered woody bark
    roughness: 0.88,
    metalness: 0.02,
  });

  // Botanical tendril shoot material
  const tendrilMat = new THREE.MeshStandardMaterial({
    map: ivyTendrilMap,
    transparent: true,
    alphaTest: 0.28,
    roughness: 0.28,
    metalness: 0.01,
    side: THREE.DoubleSide,
    color: 0xffffff,
  });

  // Individual curved leaf materials
  const leafMatA = new THREE.MeshStandardMaterial({
    map: ivyLeafLargeMap,
    transparent: true,
    alphaTest: 0.28,
    roughness: 0.26,
    metalness: 0.01,
    side: THREE.DoubleSide,
    color: 0xffffff,
  });

  const leafMatB = new THREE.MeshStandardMaterial({
    map: ivyLeafCenterMap,
    transparent: true,
    alphaTest: 0.28,
    roughness: 0.26,
    metalness: 0.01,
    side: THREE.DoubleSide,
    color: 0xffffff,
  });

  const leafMatYoung = new THREE.MeshStandardMaterial({
    map: ivyLeafYoungMap,
    transparent: true,
    alphaTest: 0.28,
    roughness: 0.24,
    metalness: 0.01,
    side: THREE.DoubleSide,
    color: 0xf6faea, // Fresh sunlit shoot tint
  });

  const ivyGroup = new THREE.Group();
  ivyGroup.name = "PhotorealisticBotanicalIvy";

  // Helper to create non-planar curved leaf geometry
  const createCurvedLeafGeo = (w: number, h: number) => {
    const geo = new THREE.PlaneGeometry(w, h, 3, 3);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const cup = (1.0 - Math.abs(x) / (w * 0.5)) * 0.007;
      const droop = (y < 0 ? (y / (h * 0.5)) * 0.006 : 0);
      pos.setZ(i, cup + droop);
    }
    geo.computeVertexNormals();
    geo.translate(0, -h * 0.35, 0); // Pivot at petiole stem base
    return geo;
  };

  const leafGeoLarge = createCurvedLeafGeo(0.145, 0.155);
  const leafGeoMid = createCurvedLeafGeo(0.120, 0.130);
  const leafGeoSmall = createCurvedLeafGeo(0.095, 0.105);
  const tendrilGeo = new THREE.PlaneGeometry(0.32, 0.32);
  tendrilGeo.translate(0, -0.06, 0);

  // ----------------------------------------------------
  // A. LEFT CASING CLIMBING VINE (Bricks up to lock rail)
  // ----------------------------------------------------
  // 1. Natural S-curve winding woody stem hugging the casing
  const leftStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfW - 0.16, 0.02, 0.14),
    new THREE.Vector3(-halfW - 0.11, 0.16, 0.11),
    new THREE.Vector3(-halfW - 0.04, 0.34, 0.075), // weaves inward over jamb edge
    new THREE.Vector3(-halfW - 0.08, 0.52, 0.060), // loops outward to the left
    new THREE.Vector3(-halfW - 0.04, 0.72, 0.042), // weaves back in
    new THREE.Vector3(-halfW - 0.06, 0.88, 0.032), // gentle outward loop
    new THREE.Vector3(-halfW - 0.03, 1.00, 0.024), // terminates gracefully near rosette
  ]);
  const leftStemMesh = new THREE.Mesh(
    new THREE.TubeGeometry(leftStemCurve, 42, 0.0050, 8, false),
    vineStemMat
  );
  leftStemMesh.castShadow = true;
  leftStemMesh.receiveShadow = true;
  ivyGroup.add(leftStemMesh);

  // Secondary side branches over bricks & outer wall
  const leftBranchCurve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfW - 0.10, 0.18, 0.10),
    new THREE.Vector3(-halfW - 0.20, 0.12, 0.15),
    new THREE.Vector3(-halfW - 0.26, 0.04, 0.18),
  ]);
  const leftBranchMesh1 = new THREE.Mesh(
    new THREE.TubeGeometry(leftBranchCurve1, 18, 0.0036, 6, false),
    vineStemMat
  );
  leftBranchMesh1.castShadow = true;
  ivyGroup.add(leftBranchMesh1);

  const leftBranchCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfW - 0.07, 0.54, 0.06),
    new THREE.Vector3(-halfW - 0.14, 0.48, 0.05),
    new THREE.Vector3(-halfW - 0.18, 0.40, 0.04),
  ]);
  const leftBranchMesh2 = new THREE.Mesh(
    new THREE.TubeGeometry(leftBranchCurve2, 16, 0.0030, 6, false),
    vineStemMat
  );
  leftBranchMesh2.castShadow = true;
  ivyGroup.add(leftBranchMesh2);

  // 2. Tendril shoots along left vine (natural varied orientations along the S-curve)
  const leftTendrilConfigs = [
    { x: -halfW - 0.15, y: 0.07, z: 0.13, s: 1.15, rx: 0.45, ry: -0.65, rz: 0.35 },
    { x: -halfW - 0.09, y: 0.20, z: 0.105, s: 1.25, rx: 0.35, ry: 0.20, rz: -0.25 },
    { x: -halfW - 0.04, y: 0.36, z: 0.078, s: 1.10, rx: 0.25, ry: -0.30, rz: 0.30 },
    { x: -halfW - 0.12, y: 0.46, z: 0.065, s: 1.05, rx: 0.40, ry: -0.60, rz: -0.15 },
    { x: -halfW - 0.05, y: 0.62, z: 0.050, s: 1.15, rx: 0.30, ry: 0.35, rz: 0.20 },
    { x: -halfW - 0.07, y: 0.78, z: 0.038, s: 1.00, rx: 0.35, ry: -0.45, rz: -0.20 },
    { x: -halfW - 0.035, y: 0.94, z: 0.026, s: 0.85, rx: 0.20, ry: -0.15, rz: 0.15 },
  ];
  leftTendrilConfigs.forEach((cfg) => {
    const tMesh = new THREE.Mesh(tendrilGeo, tendrilMat);
    tMesh.position.set(cfg.x, cfg.y, cfg.z);
    tMesh.rotation.set(cfg.rx, cfg.ry, cfg.rz);
    tMesh.scale.set(cfg.s, cfg.s, cfg.s);
    tMesh.castShadow = true;
    ivyGroup.add(tMesh);
  });

  // 3. Individually sculpted single leaves on left (organic, multi-angle)
  const leftSingleLeaves = [
    // Leaves scrambling on terracotta bricks at base
    { x: -halfW - 0.22, y: 0.05, z: 0.19, geo: leafGeoLarge, mat: leafMatA, rx: 0.65, ry: -0.70, rz: 0.45 },
    { x: -halfW - 0.16, y: 0.13, z: 0.16, geo: leafGeoMid, mat: leafMatB, rx: 0.45, ry: -0.25, rz: -0.30 },
    { x: -halfW - 0.25, y: 0.03, z: 0.21, geo: leafGeoSmall, mat: leafMatYoung, rx: 0.85, ry: -0.90, rz: 0.55 },
    { x: -halfW - 0.06, y: 0.15, z: 0.12, geo: leafGeoLarge, mat: leafMatA, rx: 0.35, ry: 0.15, rz: 0.15 },
    { x: -halfW - 0.12, y: 0.22, z: 0.13, geo: leafGeoMid, mat: leafMatYoung, rx: 0.50, ry: -0.45, rz: 0.25 },
    // Mid-vine leaves climbing along casing
    { x: -halfW - 0.02, y: 0.32, z: 0.080, geo: leafGeoLarge, mat: leafMatB, rx: 0.20, ry: 0.25, rz: 0.30 },
    { x: -halfW - 0.06, y: 0.38, z: 0.085, geo: leafGeoMid, mat: leafMatA, rx: 0.40, ry: -0.50, rz: -0.20 },
    { x: -halfW - 0.14, y: 0.44, z: 0.068, geo: leafGeoLarge, mat: leafMatA, rx: 0.50, ry: -0.70, rz: 0.35 },
    { x: -halfW - 0.03, y: 0.54, z: 0.062, geo: leafGeoMid, mat: leafMatYoung, rx: 0.25, ry: 0.15, rz: -0.25 },
    { x: -halfW - 0.08, y: 0.66, z: 0.048, geo: leafGeoLarge, mat: leafMatB, rx: 0.35, ry: -0.35, rz: 0.20 },
    { x: -halfW - 0.02, y: 0.74, z: 0.040, geo: leafGeoSmall, mat: leafMatA, rx: 0.20, ry: 0.30, rz: -0.15 },
    { x: -halfW - 0.07, y: 0.84, z: 0.034, geo: leafGeoMid, mat: leafMatYoung, rx: 0.30, ry: -0.40, rz: 0.25 },
    // Delicate trailing tip near lock rail
    { x: -halfW - 0.03, y: 0.92, z: 0.028, geo: leafGeoSmall, mat: leafMatYoung, rx: 0.25, ry: 0.10, rz: 0.15 },
    { x: -halfW - 0.02, y: 1.00, z: 0.022, geo: leafGeoSmall, mat: leafMatYoung, rx: 0.15, ry: -0.20, rz: -0.35 },
  ];
  leftSingleLeaves.forEach((leaf) => {
    const lMesh = new THREE.Mesh(leaf.geo, leaf.mat);
    lMesh.position.set(leaf.x, leaf.y, leaf.z);
    lMesh.rotation.set(leaf.rx, leaf.ry, leaf.rz);
    lMesh.castShadow = true;
    ivyGroup.add(lMesh);
  });

  // ----------------------------------------------------
  // B. TOP LINTEL HEADER CROWN (Resting ON the top ledge)
  // ----------------------------------------------------
  // 1. 3D Stem lying horizontally across the top ledge
  const topStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.20, totalHeight + 0.035, 0.02),
    new THREE.Vector3(0.02, totalHeight + 0.045, 0.035),
    new THREE.Vector3(0.22, totalHeight + 0.040, 0.030),
    new THREE.Vector3(0.40, totalHeight + 0.048, 0.038),
    new THREE.Vector3(halfW + 0.01, totalHeight + 0.025, 0.02),
  ]);
  const topStemMesh = new THREE.Mesh(
    new THREE.TubeGeometry(topStemCurve, 28, 0.0048, 8, false),
    vineStemMat
  );
  topStemMesh.castShadow = true;
  ivyGroup.add(topStemMesh);

  // 2. Tendrils nestled on top of header
  const topTendrilConfigs = [
    { x: -0.14, y: totalHeight + 0.06, z: 0.028, s: 1.15, rx: 0.55, ry: 0.35, rz: -0.25 },
    { x: 0.06, y: totalHeight + 0.07, z: 0.040, s: 1.25, rx: 0.65, ry: -0.20, rz: 0.15 },
    { x: 0.26, y: totalHeight + 0.065, z: 0.035, s: 1.20, rx: 0.50, ry: 0.40, rz: -0.20 },
    { x: 0.42, y: totalHeight + 0.055, z: 0.030, s: 1.10, rx: 0.55, ry: -0.30, rz: 0.25 },
  ];
  topTendrilConfigs.forEach((cfg) => {
    const tMesh = new THREE.Mesh(tendrilGeo, tendrilMat);
    tMesh.position.set(cfg.x, cfg.y, cfg.z);
    tMesh.rotation.set(cfg.rx, cfg.ry, cfg.rz);
    tMesh.scale.set(cfg.s, cfg.s, cfg.s);
    tMesh.castShadow = true;
    ivyGroup.add(tMesh);
  });

  // 3. Single leaves on top lintel: reaching into the sky & drooping over front
  const topSingleLeaves = [
    // Upright sunlit leaves pointing into the sky
    { x: -0.16, y: totalHeight + 0.10, z: 0.018, geo: leafGeoSmall, mat: leafMatYoung, rx: 0.2, ry: 0.2, rz: -0.3 },
    { x: -0.04, y: totalHeight + 0.13, z: 0.025, geo: leafGeoLarge, mat: leafMatA, rx: 0.15, ry: -0.3, rz: 0.2 },
    { x: 0.16, y: totalHeight + 0.14, z: 0.030, geo: leafGeoLarge, mat: leafMatB, rx: 0.1, ry: 0.4, rz: -0.1 },
    { x: 0.32, y: totalHeight + 0.12, z: 0.025, geo: leafGeoMid, mat: leafMatYoung, rx: 0.2, ry: -0.2, rz: 0.3 },
    { x: 0.46, y: totalHeight + 0.09, z: 0.018, geo: leafGeoSmall, mat: leafMatYoung, rx: 0.25, ry: 0.3, rz: -0.2 },
    // Drooping leaves cascading forward over the front lintel edge
    { x: -0.08, y: totalHeight - 0.01, z: 0.050, geo: leafGeoMid, mat: leafMatA, rx: 0.90, ry: 0.1, rz: 0.15 },
    { x: 0.10, y: totalHeight - 0.02, z: 0.055, geo: leafGeoLarge, mat: leafMatB, rx: 0.95, ry: -0.2, rz: -0.2 },
    { x: 0.24, y: totalHeight - 0.01, z: 0.050, geo: leafGeoMid, mat: leafMatYoung, rx: 0.85, ry: 0.3, rz: 0.1 },
    { x: 0.36, y: totalHeight - 0.02, z: 0.045, geo: leafGeoSmall, mat: leafMatA, rx: 0.80, ry: -0.1, rz: -0.3 },
  ];
  topSingleLeaves.forEach((leaf) => {
    const lMesh = new THREE.Mesh(leaf.geo, leaf.mat);
    lMesh.position.set(leaf.x, leaf.y, leaf.z);
    lMesh.rotation.set(leaf.rx, leaf.ry, leaf.rz);
    lMesh.castShadow = true;
    ivyGroup.add(lMesh);
  });

  // ----------------------------------------------------
  // C. UPPER-RIGHT JAMB CASCADE (Corner down to 1.38m)
  // ----------------------------------------------------
  // 1. Slender 3D trailing stem
  const rightStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(halfW + 0.01, totalHeight + 0.025, 0.020),
    new THREE.Vector3(halfW + 0.025, totalHeight - 0.15, 0.025),
    new THREE.Vector3(halfW + 0.018, totalHeight - 0.40, 0.028),
    new THREE.Vector3(halfW + 0.028, totalHeight - 0.65, 0.024),
    new THREE.Vector3(halfW + 0.020, 1.38, 0.018),
  ]);
  const rightStemMesh = new THREE.Mesh(
    new THREE.TubeGeometry(rightStemCurve, 24, 0.0040, 6, false),
    vineStemMat
  );
  rightStemMesh.castShadow = true;
  ivyGroup.add(rightStemMesh);

  // 2. Tendril shoots on right jamb
  const rightTendrilConfigs = [
    { x: halfW + 0.02, y: totalHeight - 0.12, z: 0.032, s: 1.05, rx: 0.35, ry: 0.5, rz: -0.2 },
    { x: halfW + 0.025, y: totalHeight - 0.38, z: 0.034, s: 0.95, rx: 0.4, ry: 0.3, rz: 0.15 },
    { x: halfW + 0.022, y: 1.50, z: 0.028, s: 0.85, rx: 0.3, ry: 0.6, rz: -0.3 },
  ];
  rightTendrilConfigs.forEach((cfg) => {
    const tMesh = new THREE.Mesh(tendrilGeo, tendrilMat);
    tMesh.position.set(cfg.x, cfg.y, cfg.z);
    tMesh.rotation.set(cfg.rx, cfg.ry, cfg.rz);
    tMesh.scale.set(cfg.s, cfg.s, cfg.s);
    tMesh.castShadow = true;
    ivyGroup.add(tMesh);
  });

  // 3. Single leaves on right jamb: pointing into the sky and trailing down
  const rightSingleLeaves = [
    { x: halfW + 0.035, y: totalHeight - 0.05, z: 0.028, geo: leafGeoMid, mat: leafMatYoung, rx: 0.2, ry: 0.5, rz: -0.4 },
    { x: halfW + 0.010, y: totalHeight - 0.22, z: 0.038, geo: leafGeoLarge, mat: leafMatA, rx: 0.4, ry: 0.2, rz: 0.2 },
    { x: halfW + 0.045, y: totalHeight - 0.30, z: 0.032, geo: leafGeoMid, mat: leafMatB, rx: 0.3, ry: 0.7, rz: -0.3 },
    { x: halfW + 0.015, y: totalHeight - 0.52, z: 0.035, geo: leafGeoSmall, mat: leafMatYoung, rx: 0.5, ry: 0.3, rz: 0.1 },
    { x: halfW + 0.038, y: 1.58, z: 0.028, geo: leafGeoMid, mat: leafMatA, rx: 0.35, ry: 0.6, rz: -0.25 },
    { x: halfW + 0.022, y: 1.42, z: 0.022, geo: leafGeoSmall, mat: leafMatYoung, rx: 0.4, ry: 0.4, rz: -0.1 },
  ];
  rightSingleLeaves.forEach((leaf) => {
    const lMesh = new THREE.Mesh(leaf.geo, leaf.mat);
    lMesh.position.set(leaf.x, leaf.y, leaf.z);
    lMesh.rotation.set(leaf.rx, leaf.ry, leaf.rz);
    lMesh.castShadow = true;
    ivyGroup.add(lMesh);
  });

  root.add(ivyGroup);

  // ----------------------------------------------------
  // 8. WEATHERED TERRACOTTA BRICK STACK AT LEFT FOOTING
  // Matching the rustic terracotta bricks nestled against the left jamb in reference
  // ----------------------------------------------------
  const { map: brickMap, normalMap: brickNor, roughnessMap: brickRough } = loadPBRTextures("brick");
  brickMap.repeat.set(1.0, 1.0);
  brickNor.repeat.set(1.0, 1.0);
  brickRough.repeat.set(1.0, 1.0);

  const brickMaterial = new THREE.MeshStandardMaterial({
    map: brickMap,
    normalMap: brickNor,
    normalScale: new THREE.Vector2(2.4, 2.4),
    roughnessMap: brickRough,
    roughness: 0.82,
    metalness: 0.02,
    color: 0xeb7852, // Warm rustic red-orange terracotta clay
    emissive: new THREE.Color(0x321008), // Warm terracotta clay bounce
  });

  const mossMaterial = new THREE.MeshStandardMaterial({
    color: 0x427518,
    roughness: 0.95,
    metalness: 0.01,
  });

  const brickGroup = new THREE.Group();
  brickGroup.name = "DoorBrickStack";

  const brickW = 0.22;
  const brickH = 0.076;
  const brickD = 0.12;
  const brickGeo = new THREE.BoxGeometry(brickW, brickH, brickD);

  const brickPositions = [
    // Bottom foundation brick embedded in ground
    { x: -halfW - 0.10, y: 0.038, z: 0.10, rotY: 0.08, rotZ: 0.02 },
    // Second brick slightly shifted
    { x: -halfW - 0.11, y: 0.114, z: 0.11, rotY: -0.06, rotZ: -0.02 },
    // Third brick slightly angled
    { x: -halfW - 0.09, y: 0.190, z: 0.09, rotY: 0.12, rotZ: 0.03 },
    // Fourth brick
    { x: -halfW - 0.10, y: 0.266, z: 0.10, rotY: -0.05, rotZ: -0.01 },
    // Fifth top weathered brick
    { x: -halfW - 0.09, y: 0.342, z: 0.08, rotY: 0.10, rotZ: 0.02 },
    // Broken tumbled bricks lying at base
    { x: -halfW - 0.24, y: 0.038, z: 0.16, rotY: 0.38, rotZ: 0.05 },
    { x: -halfW - 0.18, y: 0.038, z: 0.24, rotY: -0.22, rotZ: -0.03 },
  ];

  brickPositions.forEach((bp, idx) => {
    const bMesh = new THREE.Mesh(brickGeo, brickMaterial);
    bMesh.position.set(bp.x, bp.y, bp.z);
    bMesh.rotation.set(0, bp.rotY, bp.rotZ);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    bMesh.name = `DoorBrick_${idx}`;
    brickGroup.add(bMesh);

    // Subtle moss patch on top of bricks
    if (idx < 5) {
      const mossPatch = new THREE.Mesh(
        new THREE.BoxGeometry(brickW * 0.75, 0.008, brickD * 0.65),
        mossMaterial
      );
      mossPatch.position.set(bp.x + (Math.random() - 0.5) * 0.03, bp.y + brickH / 2 + 0.004, bp.z + 0.01);
      mossPatch.rotation.set(0, bp.rotY, bp.rotZ);
      brickGroup.add(mossPatch);
    }
  });

  root.add(brickGroup);

  // ----------------------------------------------------
  // 9. OPEN DOOR ANIMATION CONTROLLER
  // ----------------------------------------------------
  const openDoor = (progress: number) => {
    pivot.rotation.y = progress * (Math.PI / 2);
  };

  return { root, doorLeaf, doorFrame: casingGroup, pivot, openDoor };
}
