import * as THREE from "three";
import { loadPBRTextures } from "./textureLoader";

export interface TreeArchAssembly {
  root: THREE.Group;
  mainArchCurve: THREE.CatmullRomCurve3;
  forkCurveRight: THREE.CatmullRomCurve3;
  forkCurveLeft: THREE.CatmullRomCurve3;
}

/**
 * Creates an organic, gnarled giant tree branch arch that frames the door.
 * Features:
 * - Real photogrammetry willow/oak bark PBR textures at calibrated botanical scale
 * - Upward-facing moss vertex coloring (lush vibrant green moss coating along top bough surfaces)
 * - Multistrand twisted sinew geometry (knots, deep furrows, ancient bough anatomy)
 * - Prominent organic branch forks on the right and left matching reference silhouette
 * - Natural broken branch stubs and craggy knots
 */
export function createTreeArch(): TreeArchAssembly {
  const root = new THREE.Group();
  root.name = "TreeArchAssembly";

  // Load CC0 photogrammetry bark PBR maps (calibrated 1x repeat on textures since UVs handle aspect)
  const { map, normalMap, roughnessMap } = loadPBRTextures("bark");
  map.repeat.set(1, 1);
  normalMap.repeat.set(1, 1);
  roughnessMap.repeat.set(1, 1);

  // Set color to pure white so vertex colors (deep bark & vibrant moss) display accurately
  const barkMaterial = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(2.8, 2.8),
    roughnessMap,
    roughness: 0.85,
    metalness: 0.02,
    vertexColors: true,
    color: 0xffffff,
  });

  // ----------------------------------------------------
  // 1. PRIMARY ARCH SPLINE CURVE
  // Matching reference: rises low from left, arches over door with ample headroom, stays high on right
  // ----------------------------------------------------
  const archPoints = [
    new THREE.Vector3(-5.8, 0.40, 0.85),
    new THREE.Vector3(-4.8, 1.50, 0.45),
    new THREE.Vector3(-3.6, 2.65, 0.05),
    new THREE.Vector3(-2.2, 3.55, -0.25),
    new THREE.Vector3(-1.0, 4.10, -0.42),
    new THREE.Vector3(0.0, 4.22, -0.48), // Apex high above door
    new THREE.Vector3(1.10, 4.02, -0.38),
    new THREE.Vector3(2.25, 3.48, -0.16),
    new THREE.Vector3(3.50, 2.75, 0.15),
    new THREE.Vector3(4.70, 1.95, 0.50),
    new THREE.Vector3(5.75, 1.15, 0.85),
  ];

  const mainArchCurve = new THREE.CatmullRomCurve3(archPoints, false, "centripetal");

  // Build the main craggy trunk mesh with moss vertex coloring
  const mainArchGeo = createGnarledTrunkGeometry(mainArchCurve, 180, 26, 0.32, 0.19);
  applyMossVertexColors(mainArchGeo);
  const mainArchMesh = new THREE.Mesh(mainArchGeo, barkMaterial);
  mainArchMesh.name = "MainTreeArch";
  mainArchMesh.castShadow = true;
  mainArchMesh.receiveShadow = true;
  root.add(mainArchMesh);

  // ----------------------------------------------------
  // 2. TWISTED SINEW STRANDS (Ancient wood anatomy)
  // Two muscular chords wrapping and fusing along the trunk
  // ----------------------------------------------------
  const sinewCurve1 = createSinewSpline(mainArchCurve, 0.0, 1.0, 0.22, 5.0, 0);
  const sinewGeo1 = createScaledTubeGeometry(sinewCurve1, 130, 0.095, 12, 1, 6);
  applyMossVertexColors(sinewGeo1);
  const sinewMesh1 = new THREE.Mesh(sinewGeo1, barkMaterial);
  sinewMesh1.castShadow = true;
  sinewMesh1.receiveShadow = true;
  root.add(sinewMesh1);

  const sinewCurve2 = createSinewSpline(mainArchCurve, 0.06, 0.94, 0.20, 4.4, Math.PI * 0.9);
  const sinewGeo2 = createScaledTubeGeometry(sinewCurve2, 110, 0.085, 12, 1, 5);
  applyMossVertexColors(sinewGeo2);
  const sinewMesh2 = new THREE.Mesh(sinewGeo2, barkMaterial);
  sinewMesh2.castShadow = true;
  sinewMesh2.receiveShadow = true;
  root.add(sinewMesh2);

  // ----------------------------------------------------
  // 3. SECONDARY BRANCHES (Dramatic forks matching reference)
  // ----------------------------------------------------
  // Major right fork plunging steeply down into the meadow with distinct negative space
  const forkPointsRight = [
    new THREE.Vector3(2.25, 3.45, -0.15),
    new THREE.Vector3(2.70, 2.65, 0.05),
    new THREE.Vector3(3.10, 1.85, 0.28),
    new THREE.Vector3(3.45, 1.10, 0.52),
    new THREE.Vector3(3.75, 0.35, 0.72),
  ];
  const forkCurveRight = new THREE.CatmullRomCurve3(forkPointsRight);
  const forkGeoRight = createScaledTubeGeometry(forkCurveRight, 60, 0.145, 14, 1, 4);
  applyMossVertexColors(forkGeoRight);
  const forkMeshRight = new THREE.Mesh(forkGeoRight, barkMaterial);
  forkMeshRight.name = "RightForkBranch_Plunging";
  forkMeshRight.castShadow = true;
  forkMeshRight.receiveShadow = true;
  root.add(forkMeshRight);

  // Left lower split
  const forkPointsLeft = [
    new THREE.Vector3(-3.6, 2.60, 0.05),
    new THREE.Vector3(-4.2, 1.80, 0.35),
    new THREE.Vector3(-4.8, 1.05, 0.65),
    new THREE.Vector3(-5.3, 0.35, 0.88),
  ];
  const forkCurveLeft = new THREE.CatmullRomCurve3(forkPointsLeft);
  const forkGeoLeft = createScaledTubeGeometry(forkCurveLeft, 50, 0.150, 14, 1, 4);
  applyMossVertexColors(forkGeoLeft);
  const forkMeshLeft = new THREE.Mesh(forkGeoLeft, barkMaterial);
  forkMeshLeft.name = "LeftForkBranch";
  forkMeshLeft.castShadow = true;
  forkMeshLeft.receiveShadow = true;
  root.add(forkMeshLeft);

  // Gnarly protruding broken branch stubs
  const stubs = [
    { pos: new THREE.Vector3(-1.9, 3.70, -0.32), dir: new THREE.Vector3(-0.35, 0.65, 0.28), len: 0.42, r: 0.065 },
    { pos: new THREE.Vector3(1.85, 3.80, -0.32), dir: new THREE.Vector3(0.48, 0.52, -0.18), len: 0.36, r: 0.055 },
    { pos: new THREE.Vector3(3.5, 2.70, 0.18), dir: new THREE.Vector3(0.55, 0.35, 0.35), len: 0.44, r: 0.070 },
    { pos: new THREE.Vector3(-4.3, 1.95, 0.28), dir: new THREE.Vector3(-0.62, 0.38, 0.22), len: 0.38, r: 0.065 },
  ];

  stubs.forEach((st, idx) => {
    const end = st.pos.clone().add(st.dir.clone().multiplyScalar(st.len));
    const stubCurve = new THREE.LineCurve3(st.pos, end);
    const stubGeo = createScaledTubeGeometry(stubCurve, 12, st.r, 10, 1, 1);
    applyMossVertexColors(stubGeo);
    const stubMesh = new THREE.Mesh(stubGeo, barkMaterial);
    stubMesh.name = `BranchStub_${idx}`;
    stubMesh.castShadow = true;
    root.add(stubMesh);
  });

  return { root, mainArchCurve, forkCurveRight, forkCurveLeft };
}

/**
 * Creates TubeGeometry with properly calibrated UVs (u: 1 repeat around circumference, v: natural length repeat)
 */
function createScaledTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radius: number,
  radialSegments: number,
  repeatU: number,
  repeatV: number
): THREE.BufferGeometry {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repeatU, uv.getY(i) * repeatV);
  }
  return geo;
}

/**
 * Applies natural vertex colors: upward-facing surfaces get lush, vibrant mossy green,
 * downward/sides get deep weathered oak bark tone.
 */
function applyMossVertexColors(geo: THREE.BufferGeometry) {
  geo.computeVertexNormals();
  const normalAttr = geo.attributes.normal;
  const count = normalAttr.count;
  const colors: number[] = [];

  for (let i = 0; i < count; i++) {
    const ny = normalAttr.getY(i);

    if (ny > 0.18) {
      // Upward facing: blend towards rich vibrant emerald moss
      const mossBlend = Math.min(1.0, (ny - 0.18) / 0.55);
      const r = THREE.MathUtils.lerp(0.32, 0.26, mossBlend);
      const g = THREE.MathUtils.lerp(0.26, 0.54, mossBlend);
      const b = THREE.MathUtils.lerp(0.18, 0.12, mossBlend);
      colors.push(r, g, b);
    } else {
      // Under/side bark: rich, deep weathered oak bark
      colors.push(0.32, 0.25, 0.18);
    }
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
}

/**
 * Creates custom gnarled trunk geometry with variable radius,
 * fluting, bark furrows, and organic knot bumps along the spline.
 */
function createGnarledTrunkGeometry(
  curve: THREE.CatmullRomCurve3,
  tubularSegments: number,
  radialSegments: number,
  baseRadius: number,
  minRadius: number
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const frames = curve.computeFrenetFrames(tubularSegments, false);

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const point = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    // Radius function: thickest at flanks, tapered at apex
    const taper = Math.sin(t * Math.PI);
    const rMean = baseRadius - taper * (baseRadius - minRadius) + (1 - t) * 0.08;

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;

      // Heavy muscular fluting and irregular bark crevices
      const fluting = Math.sin(angle * 5 + t * 10) * 0.035;
      const ridges = Math.sin(angle * 9 + t * 24) * 0.022;
      const knot = Math.sin(angle * 3 + t * 38) * 0.020;

      const r = Math.max(0.12, rMean + fluting + ridges + knot);

      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      const vx = point.x + r * (cos * N.x + sin * B.x);
      const vy = point.y + r * (cos * N.y + sin * B.y);
      const vz = point.z + r * (cos * N.z + sin * B.z);

      positions.push(vx, vy, vz);

      const nx = cos * N.x + sin * B.x;
      const ny = cos * N.y + sin * B.y;
      const nz = cos * N.z + sin * B.z;
      normals.push(nx, ny, nz);

      // Calibrated UV: 1 repeat around circumference, 6 repeats along entire 12m length
      uvs.push(u * 1.5, t * 6.0);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = (i + 1) * (radialSegments + 1) + j;
      const c = (i + 1) * (radialSegments + 1) + (j + 1);
      const d = i * (radialSegments + 1) + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

/**
 * Creates a sinew spline that hugs and twists around the main arch curve
 */
function createSinewSpline(
  mainCurve: THREE.CatmullRomCurve3,
  tStart: number,
  tEnd: number,
  offsetDist: number,
  twists: number,
  phase: number
): THREE.CatmullRomCurve3 {
  const steps = 45;
  const pts: THREE.Vector3[] = [];

  for (let i = 0; i <= steps; i++) {
    const prog = i / steps;
    const t = tStart + prog * (tEnd - tStart);
    const center = mainCurve.getPointAt(t);
    const tangent = mainCurve.getTangentAt(t);

    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    const angle = prog * Math.PI * twists + phase;
    const offset = new THREE.Vector3()
      .addScaledVector(normal, Math.cos(angle) * offsetDist)
      .addScaledVector(binormal, Math.sin(angle) * offsetDist);

    pts.push(center.clone().add(offset));
  }

  return new THREE.CatmullRomCurve3(pts);
}
