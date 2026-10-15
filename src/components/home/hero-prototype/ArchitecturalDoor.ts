import * as THREE from "three";

export interface DoorAssembly {
  root: THREE.Group;
  doorLeaf: THREE.Group;
  doorFrame: THREE.Group;
  pivot: THREE.Group;
  setOpenAngle: (angleRad: number) => void;
  getOpenAngle: () => number;
}

/**
 * Creates a photorealistic 3D architectural white door matching the reference artwork:
 * - Tall, elegant proportions (1.04m x 2.44m, 4.5cm thickness).
 * - Upper panel: classical cambered arch top with raised bevelled field and moulding reveals.
 * - Lower panel: rectangular with matching raised bevelled field and moulding reveals.
 * - Clean classical mitered architrave casing with interior jambs and threshold.
 * - Luxury polished satin brass lever handle with rounded escutcheon backplate and hinges.
 * - Independent rotation around the right-hand hinge axis.
 */
export function createArchitecturalDoor(): DoorAssembly {
  const root = new THREE.Group();
  root.name = "ArchitecturalDoorRoot";

  // -------------------------------------------------------------------------
  // 1. DIMENSIONS
  // -------------------------------------------------------------------------
  const doorWidth = 1.04;
  const doorHeight = 2.44;
  const doorThick = 0.045;

  const stileWidth = 0.13;
  const topRailH = 0.14;
  const lockRailH = 0.15;
  const bottomRailH = 0.24;

  // Stile & Rail panel opening boundaries
  const panelW = doorWidth - stileWidth * 2; // 0.78m
  const halfPanelW = panelW / 2; // 0.39m

  const lowerPanelBottom = bottomRailH; // 0.24m
  const lowerPanelTop = bottomRailH + 0.72; // 0.96m
  const lockRailCenterY = (lowerPanelTop + (lowerPanelTop + lockRailH)) / 2; // 1.035m

  const upperPanelBottom = lowerPanelTop + lockRailH; // 1.11m
  const upperPanelTopMax = doorHeight - topRailH; // 2.30m
  const archSpringH = upperPanelTopMax - 0.15; // 2.15m (height where arch begins curving)

  // -------------------------------------------------------------------------
  // 2. MATERIALS
  // -------------------------------------------------------------------------
  // Clean satin architectural white paint for stile/rail frame
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.01,
  });

  // Raised panel field material (catches soft highlights)
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0xfcfdfd,
    roughness: 0.32,
    metalness: 0.01,
  });

  // Shadow reveal material for the recessed panel perimeter groove
  const revealMaterial = new THREE.MeshStandardMaterial({
    color: 0xdde2e5,
    roughness: 0.65,
    metalness: 0.0,
  });

  // Door frame / casing material (matching white architectural trim)
  const casingMaterial = new THREE.MeshStandardMaterial({
    color: 0xfcfdfd,
    roughness: 0.38,
    metalness: 0.01,
  });

  // Polished luxury satin brass hardware material
  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0xf3bf50,
    roughness: 0.14,
    metalness: 0.96,
  });

  // Dark brass/steel lock cylinder & keyhole
  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x222224,
    roughness: 0.45,
    metalness: 0.8,
  });

  // Threshold sill: satin brushed aluminum / pale stone
  const sillMaterial = new THREE.MeshStandardMaterial({
    color: 0xe6e8eb,
    roughness: 0.32,
    metalness: 0.35,
  });

  // -------------------------------------------------------------------------
  // 3. DOOR FRAME & CASING (Fixed to Room Wall)
  // -------------------------------------------------------------------------
  const doorFrame = new THREE.Group();
  doorFrame.name = "DoorFrameGroup";

  const casingWidth = 0.088; // 8.8cm architrave
  const casingThick = 0.022; // 2.2cm projection from wall
  const jambDepth = 0.16; // 16cm wall thickness jamb

  // A. Interior jamb liners (left, right, top)
  const jambLeftGeo = new THREE.BoxGeometry(0.02, doorHeight, jambDepth);
  jambLeftGeo.translate(-doorWidth / 2 - 0.01, doorHeight / 2, -jambDepth / 2);
  const jambLeftMesh = new THREE.Mesh(jambLeftGeo, casingMaterial);
  jambLeftMesh.castShadow = true;
  jambLeftMesh.receiveShadow = true;
  doorFrame.add(jambLeftMesh);

  const jambRightGeo = new THREE.BoxGeometry(0.02, doorHeight, jambDepth);
  jambRightGeo.translate(doorWidth / 2 + 0.01, doorHeight / 2, -jambDepth / 2);
  const jambRightMesh = new THREE.Mesh(jambRightGeo, casingMaterial);
  jambRightMesh.castShadow = true;
  jambRightMesh.receiveShadow = true;
  doorFrame.add(jambRightMesh);

  const jambTopGeo = new THREE.BoxGeometry(doorWidth + 0.04, 0.02, jambDepth);
  jambTopGeo.translate(0, doorHeight + 0.01, -jambDepth / 2);
  const jambTopMesh = new THREE.Mesh(jambTopGeo, casingMaterial);
  jambTopMesh.castShadow = true;
  jambTopMesh.receiveShadow = true;
  doorFrame.add(jambTopMesh);

  // B. Architectural Casing Trim (Face Moulding facing the room)
  const casingLeftGeo = new THREE.BoxGeometry(casingWidth, doorHeight, casingThick);
  casingLeftGeo.translate(-doorWidth / 2 - casingWidth / 2, doorHeight / 2, casingThick / 2);
  const casingLeftMesh = new THREE.Mesh(casingLeftGeo, casingMaterial);
  casingLeftMesh.castShadow = true;
  casingLeftMesh.receiveShadow = true;
  doorFrame.add(casingLeftMesh);

  const casingRightGeo = new THREE.BoxGeometry(casingWidth, doorHeight, casingThick);
  casingRightGeo.translate(doorWidth / 2 + casingWidth / 2, doorHeight / 2, casingThick / 2);
  const casingRightMesh = new THREE.Mesh(casingRightGeo, casingMaterial);
  casingRightMesh.castShadow = true;
  casingRightMesh.receiveShadow = true;
  doorFrame.add(casingRightMesh);

  const casingTopWidth = doorWidth + casingWidth * 2;
  const casingTopGeo = new THREE.BoxGeometry(casingTopWidth, casingWidth, casingThick);
  casingTopGeo.translate(0, doorHeight + casingWidth / 2, casingThick / 2);
  const casingTopMesh = new THREE.Mesh(casingTopGeo, casingMaterial);
  casingTopMesh.castShadow = true;
  casingTopMesh.receiveShadow = true;
  doorFrame.add(casingTopMesh);

  // C. Threshold Sill at Floor
  const sillGeo = new THREE.BoxGeometry(doorWidth + 0.04, 0.012, jambDepth + 0.04);
  sillGeo.translate(0, 0.006, -jambDepth / 2 + 0.02);
  const sillMesh = new THREE.Mesh(sillGeo, sillMaterial);
  sillMesh.receiveShadow = true;
  doorFrame.add(sillMesh);

  root.add(doorFrame);

  // -------------------------------------------------------------------------
  // 4. HINGE PIVOT & ROTATING DOOR LEAF
  // -------------------------------------------------------------------------
  const pivot = new THREE.Group();
  pivot.name = "DoorHingePivot";
  const pivotX = doorWidth / 2;
  const pivotZ = 0.0;
  pivot.position.set(pivotX, 0, pivotZ);

  const doorLeaf = new THREE.Group();
  doorLeaf.name = "DoorLeaf";
  doorLeaf.position.set(-doorWidth / 2, 0, 0);

  // -------------------------------------------------------------------------
  // 5. DOOR STILE & RAIL FRAME (WITH CUTOUT HOLES)
  // -------------------------------------------------------------------------
  const outerDoorShape = new THREE.Shape();
  outerDoorShape.moveTo(-doorWidth / 2, 0);
  outerDoorShape.lineTo(doorWidth / 2, 0);
  outerDoorShape.lineTo(doorWidth / 2, doorHeight);
  outerDoorShape.lineTo(-doorWidth / 2, doorHeight);
  outerDoorShape.closePath();

  // Hole 1: Lower rectangular panel cutout
  const lowerHole = new THREE.Path();
  lowerHole.moveTo(-halfPanelW, lowerPanelBottom);
  lowerHole.lineTo(halfPanelW, lowerPanelBottom);
  lowerHole.lineTo(halfPanelW, lowerPanelTop);
  lowerHole.lineTo(-halfPanelW, lowerPanelTop);
  lowerHole.closePath();
  outerDoorShape.holes.push(lowerHole);

  // Hole 2: Upper arched panel cutout
  const upperHole = new THREE.Path();
  upperHole.moveTo(-halfPanelW, upperPanelBottom);
  upperHole.lineTo(halfPanelW, upperPanelBottom);
  upperHole.lineTo(halfPanelW, archSpringH);

  const archSteps = 32;
  for (let i = 1; i <= archSteps; i++) {
    const t = i / archSteps;
    const px = halfPanelW * (1 - 2 * t);
    const normX = px / halfPanelW;
    const py = archSpringH + (upperPanelTopMax - archSpringH) * Math.cos(normX * (Math.PI / 2));
    upperHole.lineTo(px, py);
  }
  upperHole.lineTo(-halfPanelW, archSpringH);
  upperHole.closePath();
  outerDoorShape.holes.push(upperHole);

  const doorExtrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: doorThick,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.002,
    bevelThickness: 0.002,
  };

  const doorFrameGeometry = new THREE.ExtrudeGeometry(outerDoorShape, doorExtrudeSettings);
  doorFrameGeometry.translate(0, 0, -doorThick / 2);
  doorFrameGeometry.computeVertexNormals();

  const doorFrameMesh = new THREE.Mesh(doorFrameGeometry, doorMaterial);
  doorFrameMesh.name = "DoorStileRailFrame";
  doorFrameMesh.castShadow = true;
  doorFrameMesh.receiveShadow = true;
  doorLeaf.add(doorFrameMesh);

  // -------------------------------------------------------------------------
  // 6. RAISED PANELS & CLASSICAL MOULDING REVEALS
  // -------------------------------------------------------------------------
  // A. Lower Raised Panel
  // Recess backing (creates shadow line around panel perimeter)
  const lowerBackingGeo = new THREE.PlaneGeometry(panelW, lowerPanelTop - lowerPanelBottom);
  lowerBackingGeo.translate(0, (lowerPanelBottom + lowerPanelTop) / 2, -0.004);
  const lowerBackingMesh = new THREE.Mesh(lowerBackingGeo, revealMaterial);
  doorLeaf.add(lowerBackingMesh);

  const lowerPanelMargin = 0.022;
  const lowerPanelShape = new THREE.Shape();
  lowerPanelShape.moveTo(-halfPanelW + lowerPanelMargin, lowerPanelBottom + lowerPanelMargin);
  lowerPanelShape.lineTo(halfPanelW - lowerPanelMargin, lowerPanelBottom + lowerPanelMargin);
  lowerPanelShape.lineTo(halfPanelW - lowerPanelMargin, lowerPanelTop - lowerPanelMargin);
  lowerPanelShape.lineTo(-halfPanelW + lowerPanelMargin, lowerPanelTop - lowerPanelMargin);
  lowerPanelShape.closePath();

  const lowerPanelGeo = new THREE.ExtrudeGeometry(lowerPanelShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.028,
    bevelThickness: 0.012,
  });
  lowerPanelGeo.translate(0, 0, -0.006);
  lowerPanelGeo.computeVertexNormals();

  const lowerPanelMesh = new THREE.Mesh(lowerPanelGeo, panelMaterial);
  lowerPanelMesh.name = "LowerRaisedPanel";
  lowerPanelMesh.castShadow = true;
  lowerPanelMesh.receiveShadow = true;
  doorLeaf.add(lowerPanelMesh);

  // B. Upper Arched Raised Panel
  const upperPanelMargin = 0.022;
  const upperPanelInnerHalfW = halfPanelW - upperPanelMargin;
  const upperPanelInnerBottom = upperPanelBottom + upperPanelMargin;
  const upperSpringHInner = archSpringH - upperPanelMargin * 0.4;
  const upperTopMaxInner = upperPanelTopMax - upperPanelMargin;

  const upperPanelShape = new THREE.Shape();
  upperPanelShape.moveTo(-upperPanelInnerHalfW, upperPanelInnerBottom);
  upperPanelShape.lineTo(upperPanelInnerHalfW, upperPanelInnerBottom);
  upperPanelShape.lineTo(upperPanelInnerHalfW, upperSpringHInner);

  for (let i = 1; i <= archSteps; i++) {
    const t = i / archSteps;
    const px = upperPanelInnerHalfW * (1 - 2 * t);
    const normX = px / upperPanelInnerHalfW;
    const py = upperSpringHInner + (upperTopMaxInner - upperSpringHInner) * Math.cos(normX * (Math.PI / 2));
    upperPanelShape.lineTo(px, py);
  }
  upperPanelShape.lineTo(-upperPanelInnerHalfW, upperSpringHInner);
  upperPanelShape.closePath();

  const upperPanelGeo = new THREE.ExtrudeGeometry(upperPanelShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.028,
    bevelThickness: 0.012,
  });
  upperPanelGeo.translate(0, 0, -0.006);
  upperPanelGeo.computeVertexNormals();

  const upperPanelMesh = new THREE.Mesh(upperPanelGeo, panelMaterial);
  upperPanelMesh.name = "UpperArchedRaisedPanel";
  upperPanelMesh.castShadow = true;
  upperPanelMesh.receiveShadow = true;
  doorLeaf.add(upperPanelMesh);

  // -------------------------------------------------------------------------
  // 7. BRASS HARDWARE (HANDLE, ESCUTCHEON, HINGES)
  // -------------------------------------------------------------------------
  const hardwareGroup = new THREE.Group();
  hardwareGroup.name = "DoorHardware";

  const handleX = -doorWidth / 2 + 0.075;
  const handleY = lockRailCenterY;
  const handleZ = doorThick / 2 + 0.002;

  // A. Backplate / Escutcheon
  const escutcheonW = 0.044;
  const escutcheonH = 0.25;
  const escutcheonD = 0.008;

  const escShape = new THREE.Shape();
  const ew2 = escutcheonW / 2;
  const eh2 = escutcheonH / 2;
  const er = 0.018;
  escShape.moveTo(-ew2 + er, -eh2);
  escShape.lineTo(ew2 - er, -eh2);
  escShape.quadraticCurveTo(ew2, -eh2, ew2, -eh2 + er);
  escShape.lineTo(ew2, eh2 - er);
  escShape.quadraticCurveTo(ew2, eh2, ew2 - er, eh2);
  escShape.lineTo(-ew2 + er, eh2);
  escShape.quadraticCurveTo(-ew2, eh2, -ew2, eh2 - er);
  escShape.lineTo(-ew2, -eh2 + er);
  escShape.quadraticCurveTo(-ew2, -eh2, -ew2 + er, -eh2);
  escShape.closePath();

  const escGeo = new THREE.ExtrudeGeometry(escShape, {
    depth: escutcheonD,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.002,
    bevelThickness: 0.002,
  });
  escGeo.computeVertexNormals();

  const escMeshFront = new THREE.Mesh(escGeo, brassMaterial);
  escMeshFront.position.set(handleX, handleY, handleZ);
  escMeshFront.castShadow = true;
  hardwareGroup.add(escMeshFront);

  // Keyhole detail on backplate
  const keyholeGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.003, 12);
  keyholeGeo.rotateX(Math.PI / 2);
  const keyholeMesh = new THREE.Mesh(keyholeGeo, darkMetalMaterial);
  keyholeMesh.position.set(handleX, handleY - 0.054, handleZ + escutcheonD + 0.002);
  hardwareGroup.add(keyholeMesh);

  // B. Brass Lever Handle
  const spindleGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.044, 16);
  spindleGeo.rotateX(Math.PI / 2);
  const spindleMesh = new THREE.Mesh(spindleGeo, brassMaterial);
  spindleMesh.position.set(handleX, handleY + 0.038, handleZ + escutcheonD + 0.022);
  spindleMesh.castShadow = true;
  hardwareGroup.add(spindleMesh);

  // Lever bar (horizontal with smooth curved drop tip)
  const leverShape = new THREE.Shape();
  leverShape.moveTo(0, -0.008);
  leverShape.lineTo(0.122, -0.006);
  leverShape.quadraticCurveTo(0.132, -0.008, 0.132, -0.024);
  leverShape.quadraticCurveTo(0.132, -0.034, 0.120, -0.032);
  leverShape.lineTo(0, -0.018);
  leverShape.closePath();

  const leverGeo = new THREE.ExtrudeGeometry(leverShape, {
    depth: 0.015,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.002,
    bevelThickness: 0.002,
  });
  leverGeo.rotateY(Math.PI / 2);
  leverGeo.computeVertexNormals();

  const leverMesh = new THREE.Mesh(leverGeo, brassMaterial);
  leverMesh.position.set(handleX - 0.007, handleY + 0.046, handleZ + escutcheonD + 0.040);
  leverMesh.castShadow = true;
  hardwareGroup.add(leverMesh);

  // C. Butt Hinges on Right Edge
  const hingeHeights = [0.35, 1.22, 2.10];
  hingeHeights.forEach((hy) => {
    const hingeGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.09, 16);
    const hingeMesh = new THREE.Mesh(hingeGeo, brassMaterial);
    hingeMesh.position.set(doorWidth / 2 - 0.002, hy, 0.0);
    hingeMesh.castShadow = true;
    hardwareGroup.add(hingeMesh);
  });

  doorLeaf.add(hardwareGroup);
  pivot.add(doorLeaf);
  root.add(pivot);

  // -------------------------------------------------------------------------
  // 8. ROTATION CONTROL
  // -------------------------------------------------------------------------
  let currentOpenAngle = 0;

  const setOpenAngle = (angleRad: number) => {
    currentOpenAngle = angleRad;
    pivot.rotation.y = angleRad;
  };

  const getOpenAngle = () => currentOpenAngle;

  // Default: Open at ~66 degrees (1.152 rad) matching reference
  setOpenAngle(1.152);

  return {
    root,
    doorLeaf,
    doorFrame,
    pivot,
    setOpenAngle,
    getOpenAngle,
  };
}
