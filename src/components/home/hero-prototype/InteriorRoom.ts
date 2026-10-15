import * as THREE from "three";
import { createConcreteFloorTextures, createWallPlasterTextures } from "./proceduralTextures";

export interface InteriorRoomAssembly {
  root: THREE.Group;
  floorMesh: THREE.Mesh;
  backWallLeft: THREE.Mesh;
  backWallRight: THREE.Mesh;
  backWallTop: THREE.Mesh;
  rightWall: THREE.Mesh;
  doorPosition: THREE.Vector3;
}

/**
 * Creates the minimalist, realistic interior room matching the reference artwork:
 * - Soft off-white / pale-grey plaster walls (#d4d9dd in soft ambient shadow).
 * - Polished architectural concrete floor with restrained satin specular reflections.
 * - Classical white skirting boards (baseboards) with stepped top profile along back and right walls.
 * - Generous empty negative space on the left for Life Atlas editorial typography.
 * - Authentic warm golden sunlight spill streaming diagonally across the floor from the doorway.
 */
export function createInteriorRoom(): InteriorRoomAssembly {
  const root = new THREE.Group();
  root.name = "InteriorRoomRoot";

  // -------------------------------------------------------------------------
  // 1. DIMENSIONS & COORDINATES
  // -------------------------------------------------------------------------
  const roomHeight = 3.6;
  const doorwayCenterX = 1.6;
  const doorWidth = 1.04;
  const doorHeight = 2.44;
  const casingWidth = 0.088;

  const doorwayLeft = doorwayCenterX - doorWidth / 2;
  const doorwayRight = doorwayCenterX + doorWidth / 2;
  const roomLeftX = -7.5;
  const roomRightX = 3.75;
  const roomFrontZ = 8.5;

  const doorPosition = new THREE.Vector3(doorwayCenterX, 0, 0);

  // -------------------------------------------------------------------------
  // 2. MATERIALS
  // -------------------------------------------------------------------------
  const { map: wallMap, normalMap: wallNor, roughnessMap: wallRough } = createWallPlasterTextures();
  wallMap.repeat.set(4, 3);
  wallNor.repeat.set(4, 3);
  wallRough.repeat.set(4, 3);

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallMap,
    normalMap: wallNor,
    roughnessMap: wallRough,
    color: 0xd8dde1, // Soft pale grey / off-white matching reference
    roughness: 0.90,
    metalness: 0.0,
  });

  const { map: floorMap, roughnessMap: floorRough, normalMap: floorNor } = createConcreteFloorTextures();
  floorMap.repeat.set(3, 4);
  floorRough.repeat.set(3, 4);
  floorNor.repeat.set(3, 4);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorMap,
    roughnessMap: floorRough,
    normalMap: floorNor,
    color: 0x9ca2a8, // Polished neutral concrete
    roughness: 0.25, // Smooth satin sheen with restrained reflections
    metalness: 0.03,
  });

  const baseboardMaterial = new THREE.MeshStandardMaterial({
    color: 0xfcfdfd,
    roughness: 0.36,
    metalness: 0.01,
  });

  // -------------------------------------------------------------------------
  // 3. WALLS WITH PRECISE DOORWAY CUTOUT
  // -------------------------------------------------------------------------
  const leftWallW = doorwayLeft - roomLeftX;
  const leftWallGeo = new THREE.PlaneGeometry(leftWallW, roomHeight);
  leftWallGeo.translate(roomLeftX + leftWallW / 2, roomHeight / 2, 0);
  const backWallLeft = new THREE.Mesh(leftWallGeo, wallMaterial);
  backWallLeft.name = "BackWallLeft";
  backWallLeft.receiveShadow = true;
  root.add(backWallLeft);

  const rightWallW = roomRightX - doorwayRight;
  const rightWallGeo = new THREE.PlaneGeometry(rightWallW, roomHeight);
  rightWallGeo.translate(doorwayRight + rightWallW / 2, roomHeight / 2, 0);
  const backWallRight = new THREE.Mesh(rightWallGeo, wallMaterial);
  backWallRight.name = "BackWallRight";
  backWallRight.receiveShadow = true;
  root.add(backWallRight);

  const topWallH = roomHeight - (doorHeight + casingWidth);
  const topWallW = doorWidth;
  const topWallGeo = new THREE.PlaneGeometry(topWallW, topWallH);
  topWallGeo.translate(doorwayCenterX, (doorHeight + casingWidth) + topWallH / 2, 0);
  const backWallTop = new THREE.Mesh(topWallGeo, wallMaterial);
  backWallTop.name = "BackWallTop";
  backWallTop.receiveShadow = true;
  root.add(backWallTop);

  const rightSideWallLength = roomFrontZ;
  const rightSideWallGeo = new THREE.PlaneGeometry(rightSideWallLength, roomHeight);
  rightSideWallGeo.rotateY(-Math.PI / 2);
  rightSideWallGeo.translate(roomRightX, roomHeight / 2, rightSideWallLength / 2);
  const rightWall = new THREE.Mesh(rightSideWallGeo, wallMaterial);
  rightWall.name = "RightWall";
  rightWall.receiveShadow = true;
  root.add(rightWall);

  // -------------------------------------------------------------------------
  // 4. POLISHED CONCRETE FLOOR
  // -------------------------------------------------------------------------
  const floorW = roomRightX - roomLeftX + 2.0;
  const floorD = roomFrontZ + 1.0;
  const floorGeo = new THREE.PlaneGeometry(floorW, floorD, 40, 40);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(roomLeftX + floorW / 2 - 1.0, 0, floorD / 2);

  const floorMesh = new THREE.Mesh(floorGeo, floorMaterial);
  floorMesh.name = "PolishedConcreteFloor";
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  // -------------------------------------------------------------------------
  // 5. CLASSICAL SKIRTING BOARDS (BASEBOARDS)
  // -------------------------------------------------------------------------
  const baseH = 0.135;
  const baseThick = 0.02;
  const baseboardGroup = new THREE.Group();
  baseboardGroup.name = "Baseboards";

  const leftBaseLength = (doorwayLeft - casingWidth) - roomLeftX;
  const leftBaseGeo = new THREE.BoxGeometry(leftBaseLength, baseH, baseThick);
  leftBaseGeo.translate(roomLeftX + leftBaseLength / 2, baseH / 2, baseThick / 2);
  const leftBaseMesh = new THREE.Mesh(leftBaseGeo, baseboardMaterial);
  leftBaseMesh.castShadow = true;
  leftBaseMesh.receiveShadow = true;
  baseboardGroup.add(leftBaseMesh);

  const rightBaseStartX = doorwayRight + casingWidth;
  const rightBaseLength = roomRightX - rightBaseStartX;
  const rightBaseGeo = new THREE.BoxGeometry(rightBaseLength, baseH, baseThick);
  rightBaseGeo.translate(rightBaseStartX + rightBaseLength / 2, baseH / 2, baseThick / 2);
  const rightBaseMesh = new THREE.Mesh(rightBaseGeo, baseboardMaterial);
  rightBaseMesh.castShadow = true;
  rightBaseMesh.receiveShadow = true;
  baseboardGroup.add(rightBaseMesh);

  const rightWallBaseGeo = new THREE.BoxGeometry(baseThick, baseH, roomFrontZ);
  rightWallBaseGeo.translate(roomRightX - baseThick / 2, baseH / 2, roomFrontZ / 2);
  const rightWallBaseMesh = new THREE.Mesh(rightWallBaseGeo, baseboardMaterial);
  rightWallBaseMesh.castShadow = true;
  rightWallBaseMesh.receiveShadow = true;
  baseboardGroup.add(rightWallBaseMesh);

  root.add(baseboardGroup);

  // -------------------------------------------------------------------------
  // 6. PRECISE SUNLIGHT FLOOR BEAM (DIRECTLY TIED TO DOOR OPENING)
  // Starts at door sill (x: 1.08 to 2.12, z: 0) and projects diagonally to lower-left
  // -------------------------------------------------------------------------
  const sunBeamGeo = new THREE.BufferGeometry();
  // 4 Vertices forming the exact sunlight beam projection
  const positions = new Float32Array([
    // V0: Top-Left (Door sill left edge)
    doorwayLeft, 0.003, 0.01,
    // V1: Top-Right (Door sill right edge)
    doorwayRight, 0.003, 0.01,
    // V2: Bottom-Right (Projected foreground right)
    1.15, 0.003, 5.4,
    // V3: Bottom-Left (Projected foreground left)
    -1.45, 0.003, 5.4,
  ]);

  const uvs = new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  sunBeamGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  sunBeamGeo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  sunBeamGeo.setIndex(new THREE.BufferAttribute(indices, 1));
  sunBeamGeo.computeVertexNormals();

  // Beam texture: soft warm golden glow with feathered sides and distance falloff
  const beamCanvas = document.createElement("canvas");
  beamCanvas.width = 512;
  beamCanvas.height = 512;
  const bCtx = beamCanvas.getContext("2d")!;

  // Horizontal gradient (feathered edges)
  const horizGrad = bCtx.createLinearGradient(0, 0, 512, 0);
  horizGrad.addColorStop(0.0, "rgba(255, 238, 200, 0.0)");
  horizGrad.addColorStop(0.12, "rgba(255, 245, 218, 0.65)");
  horizGrad.addColorStop(0.50, "rgba(255, 248, 225, 0.82)");
  horizGrad.addColorStop(0.88, "rgba(255, 245, 218, 0.65)");
  horizGrad.addColorStop(1.0, "rgba(255, 238, 200, 0.0)");

  bCtx.fillStyle = horizGrad;
  bCtx.fillRect(0, 0, 512, 512);

  // Vertical falloff: strong at door sill, softly fading in foreground
  const vertGrad = bCtx.createLinearGradient(0, 0, 0, 512);
  vertGrad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  vertGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.85)");
  vertGrad.addColorStop(0.75, "rgba(255, 255, 255, 0.50)");
  vertGrad.addColorStop(1.0, "rgba(255, 255, 255, 0.05)");

  bCtx.globalCompositeOperation = "destination-in";
  bCtx.fillStyle = vertGrad;
  bCtx.fillRect(0, 0, 512, 512);

  const beamTex = new THREE.CanvasTexture(beamCanvas);
  beamTex.colorSpace = THREE.SRGBColorSpace;

  const sunBeamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const sunBeamMesh = new THREE.Mesh(sunBeamGeo, sunBeamMat);
  sunBeamMesh.name = "SunlightFloorSpill";
  root.add(sunBeamMesh);

  // -------------------------------------------------------------------------
  // 7. SPECULAR REFLECTION POOL (DIRECTLY UNDER OPEN DOORWAY)
  // Replicates the glossy outdoor sky reflection in front of the door
  // -------------------------------------------------------------------------
  const specGeo = new THREE.PlaneGeometry(1.6, 1.2);
  specGeo.rotateX(-Math.PI / 2);

  const specCanvas = document.createElement("canvas");
  specCanvas.width = 256;
  specCanvas.height = 256;
  const sCtx = specCanvas.getContext("2d")!;
  const sGrad = sCtx.createRadialGradient(128, 128, 5, 128, 128, 120);
  sGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.50)");
  sGrad.addColorStop(0.35, "rgba(240, 248, 255, 0.25)");
  sGrad.addColorStop(0.7, "rgba(225, 240, 255, 0.08)");
  sGrad.addColorStop(1.0, "rgba(225, 240, 255, 0.0)");
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 256, 256);

  const specTex = new THREE.CanvasTexture(specCanvas);
  specTex.colorSpace = THREE.SRGBColorSpace;

  const specMat = new THREE.MeshBasicMaterial({
    map: specTex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const specMesh = new THREE.Mesh(specGeo, specMat);
  specMesh.position.set(doorwayCenterX, 0.0035, 0.65);
  root.add(specMesh);

  return {
    root,
    floorMesh,
    backWallLeft,
    backWallRight,
    backWallTop,
    rightWall,
    doorPosition,
  };
}
