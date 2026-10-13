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
 * Photorealistic Cinematic 3D Hero Scene
 * Matches the reference artwork:
 * - Panoramic atmospheric matte backdrop with cosmic starry zenith, towering clouds, misty mountains & overgrown ruins
 * - Architectural antique weathered white painted door with brass hardware
 * - Ancient mossy gnarled tree bough framing the door with hanging ivy tendrils
 * - Dense, vibrant wildflower meadow with botanical daisies, wind animation & sunlit translucency
 * - Golden sunlight with soft contact shadows and rim lighting
 * - Floating sunlit pollen motes drifting in the breeze
 * - Smooth interactive mouse parallax
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
      alpha: true,
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ----------------------------------------------------
    // 2. SCENE & CINEMATIC CAMERA SETUP
    // ----------------------------------------------------
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    const getCamZ = () => ((width / height) < 1.3 ? 7.2 : 6.2);
    camera.position.set(0, 1.52, getCamZ());
    camera.lookAt(0, 1.38, 0);

    // ----------------------------------------------------
    // 3. IBL & PHOTOREALISTIC OUTDOOR LIGHTING
    // ----------------------------------------------------
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

    // Warm golden sunlight matching reference angle (front-left streaming in)
    const sunLight = new THREE.DirectionalLight(0xfff7e2, 3.8);
    sunLight.position.set(-3.6, 6.2, 5.2);
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

    // Natural sky blue ambient fill from above & warm green bounce from meadow below
    const hemiLight = new THREE.HemisphereLight(0xcde5fc, 0x426f1c, 1.15);
    scene.add(hemiLight);

    // Subtle sun rim-light from top-right to catch foliage contours
    const rimLight = new THREE.DirectionalLight(0xfff1dc, 0.75);
    rimLight.position.set(4.8, 4.2, -1.8);
    scene.add(rimLight);

    // ----------------------------------------------------
    // 4. PANORAMIC ATMOSPHERIC BACKDROP PLATE
    // ----------------------------------------------------
    const textureLoader = new THREE.TextureLoader();
    const backdropTex = textureLoader.load("/images/hero-backdrop.jpg");
    backdropTex.colorSpace = THREE.SRGBColorSpace;

    const backdropGeo = new THREE.PlaneGeometry(54.0, 30.3);
    const backdropMat = new THREE.MeshBasicMaterial({
      map: backdropTex,
      depthWrite: false,
    });
    const backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
    backdropMesh.position.set(0, 5.0, -22.0);
    backdropMesh.name = "CinematicBackdropPlate";
    scene.add(backdropMesh);

    // ----------------------------------------------------
    // 5. TERRAIN
    // ----------------------------------------------------
    const { mesh: terrainMesh, getElevation } = createTerrain();
    scene.add(terrainMesh);

    // ----------------------------------------------------
    // 6. DOOR ASSEMBLY
    // ----------------------------------------------------
    const doorAssembly = createDoor();
    doorAssembly.root.position.set(0, getElevation(0, 0), 0);
    scene.add(doorAssembly.root);
    doorAssemblyRef.current = doorAssembly;

    // ----------------------------------------------------
    // 7. TREE ARCH
    // ----------------------------------------------------
    const { root: treeArchRoot, mainArchCurve, forkCurveRight, forkCurveLeft } = createTreeArch();
    scene.add(treeArchRoot);

    // ----------------------------------------------------
    // 9. IVY VINES & HANGING TENDRILS
    // ----------------------------------------------------
    const { root: ivyVinesRoot } = createIvyVines(mainArchCurve, forkCurveRight, forkCurveLeft);
    scene.add(ivyVinesRoot);

    // ----------------------------------------------------
    // 10. DENSE INSTANCED 3D GRASS & WILDFLOWERS
    // ----------------------------------------------------
    const { clumpMeshA, clumpMeshB, clumpMeshC, flowerMesh, updateWind } = createGrassVegetation(getElevation);
    scene.add(clumpMeshA);
    scene.add(clumpMeshB);
    scene.add(clumpMeshC);
    scene.add(flowerMesh);

    // ----------------------------------------------------
    // 11. FLOATING SUNLIT POLLEN / DUST MOTE PARTICLES
    // ----------------------------------------------------
    const particleCount = 240;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleData: { x: number; y: number; z: number; speed: number; phase: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      const px = (Math.random() - 0.5) * 8.5;
      const py = 0.35 + Math.random() * 3.6;
      const pz = -1.2 + Math.random() * 6.5;

      particlePositions[i * 3] = px;
      particlePositions[i * 3 + 1] = py;
      particlePositions[i * 3 + 2] = pz;

      particleData.push({
        x: px,
        y: py,
        z: pz,
        speed: 0.25 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
      });
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const pCanvas = document.createElement("canvas");
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext("2d")!;
    const pGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    pGrad.addColorStop(0, "rgba(255, 248, 210, 0.95)");
    pGrad.addColorStop(0.45, "rgba(255, 235, 170, 0.45)");
    pGrad.addColorStop(1, "rgba(255, 220, 120, 0)");
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 32, 32);
    const pTexture = new THREE.CanvasTexture(pCanvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.048,
      map: pTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    if (onSceneReady) {
      onSceneReady();
    }

    // ----------------------------------------------------
    // 12. INTERACTIVE MOUSE PARALLAX LISTENER
    // ----------------------------------------------------
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // ----------------------------------------------------
    // 13. RESIZE LISTENER
    // ----------------------------------------------------
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;

      camera.aspect = newWidth / newHeight;
      camera.position.z = getCamZ();
      camera.lookAt(0, 1.65, 0);
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener("resize", handleResize);

    // ----------------------------------------------------
    // 14. ANIMATED RENDER LOOP
    // ----------------------------------------------------
    let animationFrameId: number;
    let isDisposed = false;
    const clock = new THREE.Clock();

    const render = () => {
      if (isDisposed) return;

      const elapsedTime = clock.getElapsedTime();

      // Living wind animation on meadow grass
      updateWind(elapsedTime);

      // Smooth damped parallax interpolation
      currentMouseX += (targetMouseX - currentMouseX) * 0.045;
      currentMouseY += (targetMouseY - currentMouseY) * 0.045;

      const baseZ = getCamZ();
      camera.position.x = currentMouseX * 0.32;
      camera.position.y = 1.52 - currentMouseY * 0.18;
      camera.position.z = baseZ;
      camera.lookAt(currentMouseX * 0.06, 1.38 - currentMouseY * 0.05, 0);

      // Subtle parallax shift on distant backdrop
      backdropMesh.position.x = currentMouseX * 0.45;
      backdropMesh.position.y = 5.0 + currentMouseY * 0.20;

      // Drifting sun pollen particles
      const pArr = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const p = particleData[i];
        pArr[i * 3] = p.x + Math.sin(elapsedTime * 0.6 + p.phase) * 0.14;
        pArr[i * 3 + 1] = p.y + Math.cos(elapsedTime * 0.45 + p.phase) * 0.10;
        pArr[i * 3 + 2] = p.z + Math.sin(elapsedTime * 0.35 + p.phase) * 0.12;
      }
      particleGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // ----------------------------------------------------
    // 15. RESOURCE DISPOSAL & CLEANUP
    // ----------------------------------------------------
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh || obj instanceof THREE.Points) {
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

      pTexture.dispose();
      backdropTex.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onSceneReady]);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full overflow-hidden select-none pointer-events-auto ${className}`}
      style={{
        background: "#0c1f38",
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
