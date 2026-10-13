import * as THREE from "three";
import { loadFoliageTextures } from "./textureLoader";

export interface IvyVinesAssembly {
  root: THREE.Group;
  leafMesh: THREE.InstancedMesh;
}

/**
 * Creates realistic 3D ivy vines, climbing tendrils, and instanced leaves
 * that cling in dense organic clusters on the outer surface of the tree arch, branch forks, and door frame,
 * with delicate hanging tendrils draping down into the open air.
 */
export function createIvyVines(
  mainArchCurve: THREE.CatmullRomCurve3,
  forkCurveRight?: THREE.CatmullRomCurve3,
  forkCurveLeft?: THREE.CatmullRomCurve3
): IvyVinesAssembly {
  const root = new THREE.Group();
  root.name = "IvyVinesAssembly";

  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d5a22,
    roughness: 0.76,
    metalness: 0.02,
  });

  // ----------------------------------------------------
  // 1. VINE STEM SPLINES (Clinging along the outer bark surface)
  // ----------------------------------------------------
  const vineSplines: THREE.CatmullRomCurve3[] = [];

  // A. Creeping vines along the main tree arch
  const coilSteps = 80;
  const coilPoints1: THREE.Vector3[] = [];
  const coilPoints2: THREE.Vector3[] = [];
  const coilPoints3: THREE.Vector3[] = [];

  for (let i = 0; i <= coilSteps; i++) {
    const t = i / coilSteps;
    const center = mainArchCurve.getPointAt(t);
    const tangent = mainArchCurve.getTangentAt(t);

    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    const taper = Math.sin(t * Math.PI);
    const rTrunk = 0.35 - taper * 0.11;

    // Vine 1: Wrapping along surface
    const angle1 = t * Math.PI * 12;
    const offset1 = new THREE.Vector3()
      .addScaledVector(normal, Math.cos(angle1) * (rTrunk + 0.02))
      .addScaledVector(binormal, Math.sin(angle1) * (rTrunk + 0.02));
    coilPoints1.push(center.clone().add(offset1));

    // Vine 2: Second runner
    const angle2 = t * Math.PI * 12 + Math.PI * 0.7;
    const offset2 = new THREE.Vector3()
      .addScaledVector(normal, Math.cos(angle2) * (rTrunk + 0.025))
      .addScaledVector(binormal, Math.sin(angle2) * (rTrunk + 0.025));
    coilPoints2.push(center.clone().add(offset2));

    // Vine 3: Creeping along the top ridge
    const offset3 = new THREE.Vector3()
      .addScaledVector(up, rTrunk + 0.03)
      .addScaledVector(normal, Math.sin(t * Math.PI * 8) * 0.06);
    coilPoints3.push(center.clone().add(offset3));
  }

  vineSplines.push(new THREE.CatmullRomCurve3(coilPoints1));
  vineSplines.push(new THREE.CatmullRomCurve3(coilPoints2));
  vineSplines.push(new THREE.CatmullRomCurve3(coilPoints3));

  // Hanging tendrils dangling down from the arch (matching reference)
  const hangPositions = [0.22, 0.35, 0.48, 0.62, 0.74, 0.85];
  hangPositions.forEach((ht) => {
    const start = mainArchCurve.getPointAt(ht);
    start.y -= 0.15;
    const hangLen = 0.45 + Math.sin(ht * 12) * 0.25;
    const hangPts = [
      start.clone(),
      start.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, -hangLen * 0.45, 0.05)),
      start.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, -hangLen, 0.08)),
    ];
    vineSplines.push(new THREE.CatmullRomCurve3(hangPts));
  });

  // B. Vines creeping along the right plunging fork
  if (forkCurveRight) {
    const forkPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const pt = forkCurveRight.getPointAt(t);
      pt.y += 0.16;
      pt.z += 0.04 * Math.sin(t * Math.PI * 3);
      forkPts.push(pt);
    }
    vineSplines.push(new THREE.CatmullRomCurve3(forkPts));
  }

  // C. Vines creeping along the left lower branch
  if (forkCurveLeft) {
    const forkPtsL: THREE.Vector3[] = [];
    for (let i = 0; i <= 25; i++) {
      const t = i / 25;
      const pt = forkCurveLeft.getPointAt(t);
      pt.y += 0.16;
      pt.x += 0.04 * Math.sin(t * Math.PI * 2);
      forkPtsL.push(pt);
    }
    vineSplines.push(new THREE.CatmullRomCurve3(forkPtsL));
  }

  // Render all vine stems as 3D tubes
  vineSplines.forEach((curve, idx) => {
    const geo = new THREE.TubeGeometry(curve, 60, 0.013, 8, false);
    const mesh = new THREE.Mesh(geo, stemMaterial);
    mesh.name = `VineStem_${idx}`;
    mesh.castShadow = true;
    root.add(mesh);
  });

  // ----------------------------------------------------
  // 2. INSTANCED BOTANICAL IVY LEAVES (7,500 LEAVES)
  // ----------------------------------------------------
  const { ivyMap } = loadFoliageTextures();

  // Natural ivy leaf cluster geometry
  const leafGeo = new THREE.PlaneGeometry(0.11, 0.11);
  leafGeo.translate(0, -0.05, 0);

  const leafMaterial = new THREE.MeshStandardMaterial({
    map: ivyMap,
    transparent: true,
    alphaTest: 0.35,
    roughness: 0.35,
    metalness: 0.02,
    side: THREE.DoubleSide,
    color: 0xffffff,
  });

  const totalLeaves = 7500;
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMaterial, totalLeaves);
  leafMesh.name = "IvyLeavesInstanced";
  leafMesh.castShadow = false;
  leafMesh.receiveShadow = true;

  // Vibrant foliage colors matching sun-drenched reference
  const leafPalette = [
    new THREE.Color(0x386e1e), // Rich vibrant leaf
    new THREE.Color(0x4a8824), // Sunlit young shoot
    new THREE.Color(0x2a5414), // Deep lush foliage
    new THREE.Color(0x569928), // Golden sunlit edge
    new THREE.Color(0x204210), // Shadowed ivy
  ];

  const dummy = new THREE.Object3D();
  let placed = 0;

  const leavesPerSpline = Math.floor(totalLeaves / vineSplines.length);

  vineSplines.forEach((spline) => {
    for (let i = 0; i < leavesPerSpline && placed < totalLeaves; i++) {
      const t = Math.random();
      const pos = spline.getPointAt(t);
      const tangent = spline.getTangentAt(t);

      // Subtle surface jitter
      const randOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08
      );
      dummy.position.copy(pos).add(randOffset);

      const scale = 0.75 + Math.random() * 0.55;
      dummy.scale.set(scale, scale, scale);

      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      dummy.rotateX((Math.random() - 0.5) * 0.8 + 0.35);
      dummy.rotateY(Math.random() * Math.PI * 2);
      dummy.rotateZ((Math.random() - 0.5) * 0.5);

      dummy.updateMatrix();
      leafMesh.setMatrixAt(placed, dummy.matrix);

      const col = leafPalette[Math.floor(Math.random() * leafPalette.length)].clone();
      col.offsetHSL((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04);
      leafMesh.setColorAt(placed, col);

      placed++;
    }
  });

  leafMesh.count = placed;
  leafMesh.instanceMatrix.needsUpdate = true;
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;

  root.add(leafMesh);

  return { root, leafMesh };
}
