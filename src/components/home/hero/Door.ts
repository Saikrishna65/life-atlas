import * as THREE from "three";
import { loadWhiteWeatheredWoodTextures } from "./textureLoader";

export interface DoorAssembly {
  root: THREE.Group;
  doorLeaf: THREE.Group;
  doorFrame: THREE.Group;
  pivot: THREE.Group;
  openDoor: (progress: number) => void;
}

/**
 * Creates a photorealistic, architecturally accurate six-panel weathered white wooden door.
 * Features:
 * - Real photogrammetry PBR textures (peeling weathered white paint, chipped edges, exposed wood)
 * - Dimensional rails, stiles, and 6 beveled recessed panel mouldings
 * - Oriented horizontal wood grain for rails via geometry UV mapping
 * - Antique brass hardware (escutcheon plate, knob, rosette, keyhole)
 * - Independent HingePivot assembly on right edge for animation
 */
export function createDoor(): DoorAssembly {
  const root = new THREE.Group();
  root.name = "DoorAssembly";

  // Load CC0 photogrammetry PBR maps tuned for weathered white paint
  const { map: woodMap, normalMap: woodNor, roughnessMap: woodRough } = loadWhiteWeatheredWoodTextures();
  woodMap.repeat.set(1.5, 2.5);
  woodNor.repeat.set(1.5, 2.5);
  woodRough.repeat.set(1.5, 2.5);

  // Weathered white wood PBR material
  const whiteWoodMat = new THREE.MeshStandardMaterial({
    map: woodMap,
    normalMap: woodNor,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughnessMap: woodRough,
    roughness: 0.80,
    metalness: 0.02,
    color: 0xfcfaf6,
  });

  // Dark weathered threshold wood/stone
  const sillMat = new THREE.MeshStandardMaterial({
    color: 0x241d17,
    roughness: 0.88,
    metalness: 0.05,
  });

  // Antique brass hardware material (warm metallic sheen with subtle patina)
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc89e5a,
    metalness: 0.88,
    roughness: 0.32,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x2a2521,
    metalness: 0.75,
    roughness: 0.65,
  });

  // ----------------------------------------------------
  // 1. OUTER CASING & DOOR FRAME
  // ----------------------------------------------------
  const doorFrame = new THREE.Group();
  doorFrame.name = "DoorFrame";

  const frameWidth = 1.18;
  const frameHeight = 2.30;
  const frameDepth = 0.15;
  const jambThick = 0.08;

  // Left jamb (vertical grain)
  const leftJamb = new THREE.Mesh(
    new THREE.BoxGeometry(jambThick, frameHeight, frameDepth),
    whiteWoodMat
  );
  leftJamb.position.set(-frameWidth / 2 + jambThick / 2, frameHeight / 2, 0);
  leftJamb.castShadow = true;
  leftJamb.receiveShadow = true;
  doorFrame.add(leftJamb);

  // Right jamb (vertical grain)
  const rightJamb = new THREE.Mesh(
    new THREE.BoxGeometry(jambThick, frameHeight, frameDepth),
    whiteWoodMat
  );
  rightJamb.position.set(frameWidth / 2 - jambThick / 2, frameHeight / 2, 0);
  rightJamb.castShadow = true;
  rightJamb.receiveShadow = true;
  doorFrame.add(rightJamb);

  // Head jamb (horizontal grain)
  const headJamb = new THREE.Mesh(
    createHorizontalBoxGeometry(frameWidth, jambThick, frameDepth),
    whiteWoodMat
  );
  headJamb.position.set(0, frameHeight - jambThick / 2, 0);
  headJamb.castShadow = true;
  headJamb.receiveShadow = true;
  doorFrame.add(headJamb);

  // Sill / Threshold
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(frameWidth + 0.12, 0.07, frameDepth + 0.10),
    sillMat
  );
  sill.position.set(0, 0.035, 0.03);
  sill.castShadow = true;
  sill.receiveShadow = true;
  doorFrame.add(sill);

  // Architrave casing molding (front face border)
  const trimThick = 0.045;
  const trimDepth = 0.03;

  const leftTrim = new THREE.Mesh(
    new THREE.BoxGeometry(trimThick, frameHeight + 0.06, trimDepth),
    whiteWoodMat
  );
  leftTrim.position.set(-frameWidth / 2 - trimThick / 2 + 0.015, (frameHeight + 0.06) / 2, frameDepth / 2 + trimDepth / 2);
  leftTrim.castShadow = true;
  leftTrim.receiveShadow = true;
  doorFrame.add(leftTrim);

  const rightTrim = new THREE.Mesh(
    new THREE.BoxGeometry(trimThick, frameHeight + 0.06, trimDepth),
    whiteWoodMat
  );
  rightTrim.position.set(frameWidth / 2 + trimThick / 2 - 0.015, (frameHeight + 0.06) / 2, frameDepth / 2 + trimDepth / 2);
  rightTrim.castShadow = true;
  rightTrim.receiveShadow = true;
  doorFrame.add(rightTrim);

  const topTrim = new THREE.Mesh(
    createHorizontalBoxGeometry(frameWidth + trimThick * 2 + 0.06, trimThick, trimDepth),
    whiteWoodMat
  );
  topTrim.position.set(0, frameHeight + trimThick / 2, frameDepth / 2 + trimDepth / 2);
  topTrim.castShadow = true;
  topTrim.receiveShadow = true;
  doorFrame.add(topTrim);

  root.add(doorFrame);

  // ----------------------------------------------------
  // 2. HINGE PIVOT & DOOR LEAF
  // ----------------------------------------------------
  const leafWidth = frameWidth - jambThick * 2 - 0.012; // ~1.00m
  const leafHeight = frameHeight - jambThick - 0.07;     // ~2.15m
  const leafThickness = 0.052;

  const hingeX = frameWidth / 2 - jambThick;
  const pivot = new THREE.Group();
  pivot.name = "HingePivot";
  pivot.position.set(hingeX, 0, 0);

  const doorLeaf = new THREE.Group();
  doorLeaf.name = "DoorLeaf";
  doorLeaf.position.set(-leafWidth / 2, leafHeight / 2 + 0.07, 0);

  // Stiles and Rails
  const stileWidth = 0.125;
  const mullionWidth = 0.105;
  const topRailH = 0.145;
  const freezeRailH = 0.095;
  const lockRailH = 0.165;
  const bottomRailH = 0.235;

  // Outer left stile (vertical grain)
  const leftStile = new THREE.Mesh(
    new THREE.BoxGeometry(stileWidth, leafHeight, leafThickness),
    whiteWoodMat
  );
  leftStile.position.set(-leafWidth / 2 + stileWidth / 2, 0, 0.001);
  leftStile.castShadow = true;
  leftStile.receiveShadow = true;
  doorLeaf.add(leftStile);

  // Outer right stile (vertical grain)
  const rightStile = new THREE.Mesh(
    new THREE.BoxGeometry(stileWidth, leafHeight, leafThickness),
    whiteWoodMat
  );
  rightStile.position.set(leafWidth / 2 - stileWidth / 2, 0, 0.001);
  rightStile.castShadow = true;
  rightStile.receiveShadow = true;
  doorLeaf.add(rightStile);

  // Center vertical mullion (vertical grain)
  const mullion = new THREE.Mesh(
    new THREE.BoxGeometry(mullionWidth, leafHeight, leafThickness),
    whiteWoodMat
  );
  mullion.position.set(0, 0, 0.001);
  mullion.castShadow = true;
  mullion.receiveShadow = true;
  doorLeaf.add(mullion);

  // Top rail (horizontal grain)
  const topRail = new THREE.Mesh(
    createHorizontalBoxGeometry(leafWidth, topRailH, leafThickness),
    whiteWoodMat
  );
  topRail.position.set(0, leafHeight / 2 - topRailH / 2, 0);
  topRail.castShadow = true;
  topRail.receiveShadow = true;
  doorLeaf.add(topRail);

  // Freeze rail (horizontal grain)
  const freezeY = leafHeight * 0.28;
  const freezeRail = new THREE.Mesh(
    createHorizontalBoxGeometry(leafWidth, freezeRailH, leafThickness),
    whiteWoodMat
  );
  freezeRail.position.set(0, freezeY, 0);
  freezeRail.castShadow = true;
  freezeRail.receiveShadow = true;
  doorLeaf.add(freezeRail);

  // Lock rail (middle, horizontal grain)
  const lockY = 0.05;
  const lockRail = new THREE.Mesh(
    createHorizontalBoxGeometry(leafWidth, lockRailH, leafThickness),
    whiteWoodMat
  );
  lockRail.position.set(0, lockY, 0);
  lockRail.castShadow = true;
  lockRail.receiveShadow = true;
  doorLeaf.add(lockRail);

  // Bottom kick rail (horizontal grain)
  const bottomRail = new THREE.Mesh(
    createHorizontalBoxGeometry(leafWidth, bottomRailH, leafThickness),
    whiteWoodMat
  );
  bottomRail.position.set(0, -leafHeight / 2 + bottomRailH / 2, 0);
  bottomRail.castShadow = true;
  bottomRail.receiveShadow = true;
  doorLeaf.add(bottomRail);

  // ----------------------------------------------------
  // 3. SIX DIMENSIONAL BEVELED INSET PANELS
  // ----------------------------------------------------
  const panelW = (leafWidth - stileWidth * 2 - mullionWidth) / 2; // ~0.32m
  const topPanelH = (leafHeight / 2 - topRailH) - (freezeY + freezeRailH / 2);
  const midPanelH = (freezeY - freezeRailH / 2) - (lockY + lockRailH / 2);
  const botPanelH = (lockY - lockRailH / 2) - (-leafHeight / 2 + bottomRailH);

  const panelConfigs = [
    // Top row
    { x: -leafWidth / 4 + 0.015, y: (leafHeight / 2 - topRailH + freezeY + freezeRailH / 2) / 2, h: topPanelH },
    { x: leafWidth / 4 - 0.015, y: (leafHeight / 2 - topRailH + freezeY + freezeRailH / 2) / 2, h: topPanelH },
    // Middle row
    { x: -leafWidth / 4 + 0.015, y: (freezeY - freezeRailH / 2 + lockY + lockRailH / 2) / 2, h: midPanelH },
    { x: leafWidth / 4 - 0.015, y: (freezeY - freezeRailH / 2 + lockY + lockRailH / 2) / 2, h: midPanelH },
    // Bottom row
    { x: -leafWidth / 4 + 0.015, y: (lockY - lockRailH / 2 - leafHeight / 2 + bottomRailH) / 2, h: botPanelH },
    { x: leafWidth / 4 - 0.015, y: (lockY - lockRailH / 2 - leafHeight / 2 + bottomRailH) / 2, h: botPanelH },
  ];

  panelConfigs.forEach((cfg) => {
    // Recessed center board (inset back into door depth)
    const boardThick = leafThickness * 0.42;
    const centerBoard = new THREE.Mesh(
      new THREE.BoxGeometry(panelW - 0.02, cfg.h - 0.02, boardThick),
      whiteWoodMat
    );
    centerBoard.position.set(cfg.x, cfg.y, 0);
    centerBoard.castShadow = true;
    centerBoard.receiveShadow = true;
    doorLeaf.add(centerBoard);

    // Beveled moulding surround (cove profile)
    const mThick = 0.022;
    const mDepth = leafThickness * 0.75;

    // Top moulding
    const tM = new THREE.Mesh(createHorizontalBoxGeometry(panelW, mThick, mDepth), whiteWoodMat);
    tM.position.set(cfg.x, cfg.y + cfg.h / 2 - mThick / 2, 0);
    tM.castShadow = true;
    doorLeaf.add(tM);

    // Bottom moulding
    const bM = new THREE.Mesh(createHorizontalBoxGeometry(panelW, mThick, mDepth), whiteWoodMat);
    bM.position.set(cfg.x, cfg.y - cfg.h / 2 + mThick / 2, 0);
    bM.castShadow = true;
    doorLeaf.add(bM);

    // Left moulding
    const lM = new THREE.Mesh(new THREE.BoxGeometry(mThick, cfg.h, mDepth), whiteWoodMat);
    lM.position.set(cfg.x - panelW / 2 + mThick / 2, cfg.y, 0);
    lM.castShadow = true;
    doorLeaf.add(lM);

    // Right moulding
    const rM = new THREE.Mesh(new THREE.BoxGeometry(mThick, cfg.h, mDepth), whiteWoodMat);
    rM.position.set(cfg.x + panelW / 2 - mThick / 2, cfg.y, 0);
    rM.castShadow = true;
    doorLeaf.add(rM);
  });

  // ----------------------------------------------------
  // 4. ANTIQUE BRASS HARDWARE
  // ----------------------------------------------------
  const handleX = -leafWidth / 2 + 0.065;
  const handleY = lockY;

  // Escutcheon backplate (beveled antique brass plate)
  const plateGeo = new THREE.BoxGeometry(0.048, 0.25, 0.012);
  const plate = new THREE.Mesh(plateGeo, brassMat);
  plate.position.set(handleX, handleY, leafThickness / 2 + 0.006);
  plate.castShadow = true;
  doorLeaf.add(plate);

  // Turned brass rosette
  const rosette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.025, 0.012, 20),
    brassMat
  );
  rosette.rotation.x = Math.PI / 2;
  rosette.position.set(handleX, handleY + 0.045, leafThickness / 2 + 0.016);
  rosette.castShadow = true;
  doorLeaf.add(rosette);

  // Knob stem
  const knobStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.012, 0.035, 16),
    brassMat
  );
  knobStem.rotation.x = Math.PI / 2;
  knobStem.position.set(handleX, handleY + 0.045, leafThickness / 2 + 0.032);
  knobStem.castShadow = true;
  doorLeaf.add(knobStem);

  // Spherical antique doorknob
  const knobSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 24, 24),
    brassMat
  );
  knobSphere.scale.set(1, 1, 0.85);
  knobSphere.position.set(handleX, handleY + 0.045, leafThickness / 2 + 0.056);
  knobSphere.castShadow = true;
  doorLeaf.add(knobSphere);

  // Keyhole slot
  const keyhole = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.022, 0.002),
    ironMat
  );
  keyhole.position.set(handleX, handleY - 0.045, leafThickness / 2 + 0.013);
  doorLeaf.add(keyhole);

  // ----------------------------------------------------
  // 5. IRON BUTT HINGES ON RIGHT EDGE
  // ----------------------------------------------------
  const hingeYs = [leafHeight * 0.38, lockY, -leafHeight * 0.38];
  hingeYs.forEach((hY) => {
    const knuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.095, 14),
      ironMat
    );
    knuckle.position.set(leafWidth / 2, hY, leafThickness / 2 - 0.004);
    knuckle.castShadow = true;
    doorLeaf.add(knuckle);
  });

  pivot.add(doorLeaf);
  root.add(pivot);

  const openDoor = (progress: number) => {
    pivot.rotation.y = progress * (Math.PI / 2);
  };

  return { root, doorLeaf, doorFrame, pivot, openDoor };
}

/**
 * Creates BoxGeometry with UV coordinates rotated 90 degrees
 * so vertical wood planks run horizontally along rails and headers.
 */
function createHorizontalBoxGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const uvAttr = geo.attributes.uv;

  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    // Swap U and V and scale to match aspect
    uvAttr.setXY(i, v * (width / height), u);
  }

  return geo;
}
