"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { createDoor, DoorAssembly } from "./Door";
import { createTerrain } from "./Terrain";
import { createGrassVegetation } from "./GrassVegetation";
import { createTreeArch } from "./TreeArch";
import { createIvyVines } from "./IvyVines";
import { createRocksAndRoots } from "./RocksAndRoots";

interface HeroSceneProps {
  className?: string;
  onSceneReady?: () => void;
}

/**
 * Photorealistic 3D Foreground Hero Scene
 * Features:
 * - Real IBL (Image-Based Lighting) via HDRI environment reflection map
 * - Photogrammetry PBR scan materials for weathered painted wood, ground, bark, and bricks
 * - Architectural 6-panel door with dimensional bevels and antique brass hardware
 * - Wild meadow multi-blade clump archetypes with root-to-tip ambient occlusion
 * - Cinematic outdoor directional sunlight with soft PCF contact shadows
 * - ACES Filmic Tone Mapping and sRGB color space
 */
export default function HeroScene({ className = "", onSceneReady }: HeroSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const doorAssemblyRef = useRef<DoorAssembly | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ----------------------------------------------------
    // 1. RENDERER SETUP
    // ----------------------------------------------------
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: true, // Transparent backdrop for future background plate
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ----------------------------------------------------
    // 2. SCENE & CINEMATIC CAMERA SETUP
    // ----------------------------------------------------
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Fixed cinematic perspective camera matching reference framing
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(0, 1.70, 6.4);
    camera.lookAt(0, 1.65, 0);

    // ----------------------------------------------------
    // 3. IBL ENVIRONMENT & PHYSICALLY BASED OUTDOOR LIGHTING
    // ----------------------------------------------------
    // Load CC0 outdoor HDRI for realistic PBR environment reflections & sky bounce
    const hdrLoader = new HDRLoader();
    hdrLoader.load(
      "/textures/hdri/alps_field_1k.hdr",
      (hdrTexture) => {
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = hdrTexture;
      },
      undefined,
      (err) => {
        console.warn("Could not load HDRI:", err);
      }
    );

    // Warm natural sunlight shining from front-left onto the door and meadow
    const sunLight = new THREE.DirectionalLight(0xfffaec, 3.6);
    sunLight.position.set(-3.2, 6.5, 5.5);
    sunLight.target.position.set(0, 1.3, 0);
    sunLight.castShadow = true;

    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1.0;
    sunLight.shadow.camera.far = 28.0;
    sunLight.shadow.camera.left = -7.5;
    sunLight.shadow.camera.right = 7.5;
    sunLight.shadow.camera.top = 7.5;
    sunLight.shadow.camera.bottom = -2.5;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.radius = 2.0;

    scene.add(sunLight);
    scene.add(sunLight.target);

    // Soft natural sky ambient fill
    const hemiLight = new THREE.HemisphereLight(0xcde4fa, 0x486c26, 1.15);
    scene.add(hemiLight);

    // Cool rim/fill light from right side
    const fillLight = new THREE.DirectionalLight(0xd4e5f8, 0.40);
    fillLight.position.set(4.8, 3.5, -1.0);
    scene.add(fillLight);

    // ----------------------------------------------------
    // 4. TERRAIN
    // ----------------------------------------------------
    const { mesh: terrainMesh, getElevation } = createTerrain();
    scene.add(terrainMesh);

    // ----------------------------------------------------
    // 5. DOOR ASSEMBLY
    // ----------------------------------------------------
    const doorAssembly = createDoor();
    doorAssembly.root.position.set(0, getElevation(0, 0), 0);
    scene.add(doorAssembly.root);
    doorAssemblyRef.current = doorAssembly;

    // ----------------------------------------------------
    // 6. TREE ARCH
    // ----------------------------------------------------
    const { root: treeArchRoot, mainArchCurve, forkCurveRight, forkCurveLeft } = createTreeArch();
    scene.add(treeArchRoot);

    // ----------------------------------------------------
    // 7. ROCKS, BRICK STACK, AND ROOTS
    // ----------------------------------------------------
    const { root: rocksAndRootsRoot } = createRocksAndRoots(getElevation);
    scene.add(rocksAndRootsRoot);

    // ----------------------------------------------------
    // 8. IVY VINES & HANGING TENDRILS
    // ----------------------------------------------------
    const { root: ivyVinesRoot } = createIvyVines(mainArchCurve, forkCurveRight, forkCurveLeft);
    scene.add(ivyVinesRoot);

    // ----------------------------------------------------
    // 9. DENSE INSTANCED 3D GRASS & WILDFLOWERS
    // ----------------------------------------------------
    const { clumpMeshA, clumpMeshB, clumpMeshC, flowerMesh } = createGrassVegetation(getElevation);
    scene.add(clumpMeshA);
    scene.add(clumpMeshB);
    scene.add(clumpMeshC);
    scene.add(flowerMesh);

    if (onSceneReady) {
      onSceneReady();
    }

    // ----------------------------------------------------
    // 10. RESIZE LISTENER
    // ----------------------------------------------------
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;

      camera.aspect = newWidth / newHeight;
      if (camera.aspect < 1.3) {
        camera.position.set(0, 1.70, 7.4);
      } else {
        camera.position.set(0, 1.70, 6.4);
      }
      camera.lookAt(0, 1.65, 0);
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener("resize", handleResize);

    // ----------------------------------------------------
    // 11. RENDER LOOP
    // ----------------------------------------------------
    let animationFrameId: number;
    let isDisposed = false;

    const render = () => {
      if (isDisposed) return;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // ----------------------------------------------------
    // 12. CLEANUP & RESOURCE DISPOSAL
    // ----------------------------------------------------
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          if (obj.geometry) {
            obj.geometry.dispose();
          }
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => {
              disposeMaterial(mat);
            });
          } else if (obj.material) {
            disposeMaterial(obj.material);
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onSceneReady]);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full overflow-hidden select-none pointer-events-none ${className}`}
      style={{
        background: "linear-gradient(180deg, #1d4372 0%, #3e6ea7 26%, #7aa5d6 52%, #b5d1ed 74%, #e2eef7 100%)",
      }}
    />
  );
}

function disposeMaterial(mat: THREE.Material) {
  const standardMat = mat as THREE.MeshStandardMaterial;
  if (standardMat.map) standardMat.map.dispose();
  if (standardMat.normalMap) standardMat.normalMap.dispose();
  if (standardMat.roughnessMap) standardMat.roughnessMap.dispose();
  if (standardMat.metalnessMap) standardMat.metalnessMap.dispose();
  if (standardMat.alphaMap) standardMat.alphaMap.dispose();
  mat.dispose();
}
