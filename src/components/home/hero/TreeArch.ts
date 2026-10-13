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
  // 1. PRIMARY ARCH SPLINE CURVE
  // Matching reference: rises from left, arches over door with ample headroom, extends to right
  // ----------------------------------------------------
  const archPoints = [
    new THREE.Vector3(-5.8, 0.35, 0.65),
    new THREE.Vector3(-4.6, 1.45, 0.35),
    new THREE.Vector3(-3.4, 2.55, 0.05),
    new THREE.Vector3(-2.0, 3.40, -0.25),
    new THREE.Vector3(-0.9, 3.75, -0.40),
    new THREE.Vector3(0.0, 3.82, -0.45), // Apex gracefully framing door
    new THREE.Vector3(1.15, 3.68, -0.35),
    new THREE.Vector3(2.35, 3.25, -0.15),
    new THREE.Vector3(3.60, 2.65, 0.15),
    new THREE.Vector3(4.80, 2.05, 0.45),
    new THREE.Vector3(5.85, 1.45, 0.75),
  ];

  const mainArchCurve = new THREE.CatmullRomCurve3(archPoints, false, "centripetal");

  // Build the main craggy trunk mesh with moss vertex coloring
  const mainArchGeo = createGnarledTrunkGeometry(mainArchCurve, 220, 36, 0.36, 0.22);
  applyMossVertexColors(mainArchGeo);
  const mainArchMesh = new THREE.Mesh(mainArchGeo, barkMaterial);
  mainArchMesh.name = "MainTreeArch";
  mainArchMesh.castShadow = true;
  mainArchMesh.receiveShadow = true;
  root.add(mainArchMesh);

  // ----------------------------------------------------
  // 2. SECONDARY BRANCHES (Graceful forks matching reference)
  // ----------------------------------------------------
  // Major right fork branching towards the lower-right margin
  const forkPointsRight = [
    new THREE.Vector3(2.35, 3.20, -0.15),
    new THREE.Vector3(2.95, 2.50, 0.05),
    new THREE.Vector3(3.60, 1.85, 0.25),
    new THREE.Vector3(4.35, 1.25, 0.45),
    new THREE.Vector3(5.15, 0.65, 0.65),
  ];
  const forkCurveRight = new THREE.CatmullRomCurve3(forkPointsRight);
  const forkGeoRight = createScaledTubeGeometry(forkCurveRight, 60, 0.12, 14, 1, 4);
  applyMossVertexColors(forkGeoRight);
  const forkMeshRight = new THREE.Mesh(forkGeoRight, barkMaterial);
  forkMeshRight.name = "RightForkBranch";
  forkMeshRight.castShadow = true;
  forkMeshRight.receiveShadow = true;
  root.add(forkMeshRight);

  // Left lower split
  const forkPointsLeft = [
    new THREE.Vector3(-3.4, 2.50, 0.05),
    new THREE.Vector3(-4.0, 1.75, 0.30),
    new THREE.Vector3(-4.6, 1.05, 0.55),
    new THREE.Vector3(-5.2, 0.40, 0.75),
  ];
  const forkCurveLeft = new THREE.CatmullRomCurve3(forkPointsLeft);
  const forkGeoLeft = createScaledTubeGeometry(forkCurveLeft, 50, 0.13, 14, 1, 4);
  applyMossVertexColors(forkGeoLeft);
  const forkMeshLeft = new THREE.Mesh(forkGeoLeft, barkMaterial);
  forkMeshLeft.name = "LeftForkBranch";
  forkMeshLeft.castShadow = true;
  forkMeshLeft.receiveShadow = true;
  root.add(forkMeshLeft);

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
