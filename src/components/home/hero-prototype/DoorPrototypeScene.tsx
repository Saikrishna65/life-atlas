"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { createInteriorRoom, InteriorRoomAssembly } from "./InteriorRoom";
import { createArchitecturalDoor, DoorAssembly } from "./ArchitecturalDoor";
import { createOutdoorWorld, OutdoorWorldAssembly } from "./OutdoorWorld";

export interface DoorPrototypeSceneProps {
  className?: string;
  doorAngleDeg?: number; // 0 = Closed, 68 = Reference Open, 95 = Wide Open
  exposure?: number;
  sunIntensity?: number;
  onSceneReady?: () => void;
}

/**
 * Photorealistic 3D Prototype Scene — "The Door to the Outside World"
 * Renders an authentic interior room opening onto a vibrant, sunlit landscape.
 */
export default function DoorPrototypeScene({
  className = "",
  doorAngleDeg = 68,
  exposure = 1.05,
  sunIntensity = 3.6,
  onSceneReady,
}: DoorPrototypeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const doorAssemblyRef = useRef<DoorAssembly | null>(null);
  const outdoorRef = useRef<OutdoorWorldAssembly | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Update door angle dynamically when prop changes
  useEffect(() => {
    if (doorAssemblyRef.current) {
      const angleRad = (doorAngleDeg * Math.PI) / 180;
      doorAssemblyRef.current.setOpenAngle(angleRad);
    }
  }, [doorAngleDeg]);

  // Update exposure when prop changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.toneMappingExposure = exposure;
    }
  }, [exposure]);

  // Update sun intensity when prop changes
  useEffect(() => {
    if (outdoorRef.current) {
      outdoorRef.current.sunLight.intensity = sunIntensity;
    }
  }, [sunIntensity]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // -------------------------------------------------------------------------
    // 1. RENDERER SETUP
    // -------------------------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      precision: "highp",
      alpha: false,
    });
    rendererRef.current = renderer;

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // -------------------------------------------------------------------------
    // 2. SCENE & CAMERA (EXACT REFERENCE PERSPECTIVE)
    // -------------------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdcebf8);

    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(44.0, aspect, 0.1, 200);

    const updateCamera = () => {
      const currentAspect = container.clientWidth / container.clientHeight;
      camera.aspect = currentAspect;

      if (currentAspect < 1.0) {
        // Mobile / Portrait: centered door perspective
        camera.fov = 54;
        camera.position.set(1.4, 1.25, 3.4);
        camera.lookAt(1.4, 1.25, 0.0);
      } else if (currentAspect < 1.4) {
        // Tablet / Squarish desktop
        camera.fov = 48;
        camera.position.set(0.75, 1.25, 3.6);
        camera.lookAt(1.10, 1.25, 0.0);
      } else {
        // Widescreen Desktop: exact reference composition
        camera.fov = 44.0;
        camera.position.set(0.38, 1.25, 3.65);
        camera.lookAt(0.85, 1.25, 0.0);
      }
      camera.updateProjectionMatrix();
    };
    updateCamera();

    // -------------------------------------------------------------------------
    // 3. BUILD ASSEMBLIES
    // -------------------------------------------------------------------------
    // A. Interior Room
    const room = createInteriorRoom();
    scene.add(room.root);

    // B. Architectural 3D Door
    const door = createArchitecturalDoor();
    doorAssemblyRef.current = door;
    door.root.position.copy(room.doorPosition);
    door.setOpenAngle((doorAngleDeg * Math.PI) / 180);
    scene.add(door.root);

    // C. Outdoor World (Landscape beyond doorway)
    const outdoor = createOutdoorWorld();
    outdoorRef.current = outdoor;
    scene.add(outdoor.root);

    // -------------------------------------------------------------------------
    // 4. INTERIOR INDIRECT LIGHTING (INDOOR BOUNCE & RADIOSITY)
    // Calibrated to produce realistic contrast between direct sun and soft ambient
    // -------------------------------------------------------------------------
    // Soft diffuse indoor ambient light
    const roomAmbient = new THREE.AmbientLight(0xdde5ed, 0.45);
    scene.add(roomAmbient);

    // Warm daylight bounce coming from the sunlit floor spill towards room interior
    const floorBounce = new THREE.DirectionalLight(0xffedd2, 0.42);
    floorBounce.position.set(1.0, 0.05, 2.2);
    floorBounce.target.position.set(-1.8, 2.0, 0.0);
    scene.add(floorBounce);
    scene.add(floorBounce.target);

    // Cool skylight bounce filling the room from the doorway opening
    const skySpill = new THREE.DirectionalLight(0xc2deff, 0.35);
    skySpill.position.set(1.6, 1.8, -0.5);
    skySpill.target.position.set(0.0, 1.2, 3.0);
    scene.add(skySpill);
    scene.add(skySpill.target);

    // -------------------------------------------------------------------------
    // 5. ANIMATION & RENDER LOOP
    // -------------------------------------------------------------------------
    let animId: number;
    let startTime = performance.now();
    let isDisposed = false;

    const render = () => {
      if (isDisposed) return;
      animId = requestAnimationFrame(render);

      const elapsedTime = (performance.now() - startTime) * 0.001;

      // Subtle atmospheric grass breeze
      if (outdoor.grassMesh) {
        outdoor.grassMesh.rotation.y = Math.sin(elapsedTime * 0.8) * 0.004;
      }

      renderer.render(scene, camera);
    };

    render();

    if (onSceneReady) {
      onSceneReady();
    }

    // -------------------------------------------------------------------------
    // 6. RESIZE HANDLER
    // -------------------------------------------------------------------------
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      updateCamera();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      doorAssemblyRef.current = null;
      outdoorRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
    </div>
  );
}
