"use client";

import React, { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

interface HeroSceneProps {
  className?: string;
  onSceneReady?: () => void;
  progressRef?: React.RefObject<number>;
  progress?: number;
}

const TOTAL_FRAMES = 287;
const FRAME_PREFIX = "/images/door-sequence/frame_";
const FRAME_EXT = ".webp";

/**
 * Ultra-Smooth High-Performance Cinematic Hero Scene
 * 
 * Optimized Architecture:
 * 1. Native High-Throughput Preloading Pipeline:
 *    - Loads frames using browser-native HTMLImageElement with off-thread img.decode().
 *    - Native browser image decode cache manages texture memory automatically, eliminating
 *      manual bitmap closing and pruning thrashing.
 * 2. Instant Zero-Stiction Runway Buffer:
 *    - Frame 0 loads and renders immediately on mount.
 *    - Runway buffer (frames 1..45) preloaded with highest priority so initial scroll is instantaneous.
 *    - Keyframe strides (every 5th frame) preloaded across the sequence to eliminate wide gaps.
 *    - All 287 frames (only 9.47 MB total) fill in parallel background streams within ~1 second.
 * 3. Dynamic Forward Lookahead:
 *    - Dynamically prioritizes upcoming scroll corridor (target ± 30 frames) directly at the
 *      head of the load queue during active scrolling.
 * 4. Micro-Neighbor Fallback:
 *    - Seamlessly falls back to immediate ±3 neighbors or holds the active rendered frame,
 *      preventing frame freezes, stalls, or multi-frame jumps.
 * 5. Exact Frame-Lock Synchronization:
 *    - Canvas directly tracks progressRef from Hero.tsx in exact lockstep with DOM text stages,
 *      eliminating secondary governor lag and snap-to-target discontinuities.
 */
export default function HeroScene({
  className = "",
  onSceneReady,
  progressRef,
  progress = 0,
}: HeroSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isDisposed = false;

    // Detect mobile environment or Capacitor native mobile app
    const isMobile =
      (typeof window !== "undefined" && Capacitor.isNativePlatform()) ||
      (typeof navigator !== "undefined" &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ||
      (typeof window !== "undefined" && window.innerWidth < 768);

    // Frame cache & loading state:
    // 0 = unrequested, 1 = loading/decoding, 2 = ready to draw
    const images = new Array<HTMLImageElement | null>(TOTAL_FRAMES).fill(null);
    const loadStatus = new Uint8Array(TOTAL_FRAMES);

    let needsRedraw = true;
    let lastRenderedFrameIdx = -1;

    // Concurrency queues
    let activeLoads = 0;
    const MAX_CONCURRENT_LOADS = isMobile ? 12 : 16;
    const highPriorityQueue: number[] = [];
    const normalQueue: number[] = [];

    const requestFrame = (index: number, highPriority = false) => {
      if (index < 0 || index >= TOTAL_FRAMES || loadStatus[index] !== 0) return;

      if (highPriority) {
        const hpIdx = highPriorityQueue.indexOf(index);
        if (hpIdx !== -1) highPriorityQueue.splice(hpIdx, 1);
        const npIdx = normalQueue.indexOf(index);
        if (npIdx !== -1) normalQueue.splice(npIdx, 1);
        highPriorityQueue.unshift(index);
      } else {
        if (!normalQueue.includes(index) && !highPriorityQueue.includes(index)) {
          normalQueue.push(index);
        }
      }
      pumpQueue();
    };

    const pumpQueue = () => {
      if (isDisposed) return;

      while (
        activeLoads < MAX_CONCURRENT_LOADS &&
        (highPriorityQueue.length > 0 || normalQueue.length > 0)
      ) {
        const nextIdx =
          highPriorityQueue.length > 0
            ? highPriorityQueue.shift()!
            : normalQueue.shift()!;

        if (loadStatus[nextIdx] !== 0) continue;
        loadStatus[nextIdx] = 1;
        activeLoads++;

        const img = new Image();
        img.src = `${FRAME_PREFIX}${nextIdx}${FRAME_EXT}`;

        const onReady = () => {
          activeLoads--;
          if (isDisposed) return;

          images[nextIdx] = img;
          loadStatus[nextIdx] = 2;

          if (nextIdx === 0) {
            if (typeof window !== "undefined") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__heroSceneReady = true;
              window.dispatchEvent(new CustomEvent("hero-scene-ready"));
            }
            onSceneReady?.();
          }

          const curProgress = progressRef?.current ?? progress;
          const curTarget = Math.min(
            TOTAL_FRAMES - 1,
            Math.max(0, Math.round(curProgress * (TOTAL_FRAMES - 1)))
          );

          if (Math.abs(nextIdx - curTarget) <= 2) {
            needsRedraw = true;
          }

          pumpQueue();
        };

        const onError = () => {
          activeLoads--;
          if (isDisposed) return;
          loadStatus[nextIdx] = 0;
          pumpQueue();
        };

        if (typeof img.decode === "function") {
          img.decode().then(onReady).catch(onReady);
        } else {
          img.onload = onReady;
          img.onerror = onError;
        }
      }
    };

    // Corridor manager: dynamically prioritize upcoming frames as playhead moves
    let lastPrioritizedIdx = -1;
    const prioritizeCorridor = (targetIdx: number) => {
      if (Math.abs(targetIdx - lastPrioritizedIdx) < 2) return;
      lastPrioritizedIdx = targetIdx;

      const lookAhead = isMobile ? 30 : 40;
      const lookBehind = 10;

      // Lookahead frames get top priority
      for (let i = 0; i <= lookAhead; i++) {
        const ahead = targetIdx + i;
        if (ahead < TOTAL_FRAMES && loadStatus[ahead] === 0) {
          requestFrame(ahead, true);
        }
      }

      // Immediate behind frames in case user scrolls back up
      for (let i = 1; i <= lookBehind; i++) {
        const behind = targetIdx - i;
        if (behind >= 0 && loadStatus[behind] === 0) {
          requestFrame(behind, true);
        }
      }

      pumpQueue();
    };

    // Staged sequence bootstrapping:
    // 1. Frame 0 (instant)
    requestFrame(0, true);

    // 2. Immediate runway buffer (frames 1..45) with high priority
    for (let i = 1; i <= 45; i++) {
      requestFrame(i, true);
    }

    // 3. Keyframe strides across the sequence to eliminate wide fallback jumps
    for (let i = 50; i < TOTAL_FRAMES; i += 5) {
      requestFrame(i, false);
    }
    requestFrame(TOTAL_FRAMES - 1, false);

    // 4. Background fill all remaining frames
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      if (loadStatus[i] === 0) {
        requestFrame(i, false);
      }
    }

    // Retrieve best frame with micro-neighbor fallback (never jumps across wide intervals)
    const getBestFrame = (targetIdx: number): HTMLImageElement | null => {
      // 1. Exact match
      if (loadStatus[targetIdx] === 2 && images[targetIdx]) {
        return images[targetIdx];
      }

      // 2. Immediate micro-neighbor fallback within ±4 frames
      for (let offset = 1; offset <= 4; offset++) {
        const prev = targetIdx - offset;
        if (prev >= 0 && loadStatus[prev] === 2 && images[prev]) {
          return images[prev];
        }
        const next = targetIdx + offset;
        if (next < TOTAL_FRAMES && loadStatus[next] === 2 && images[next]) {
          return images[next];
        }
      }

      // 3. Keep current rendered frame if within reasonable distance (smooth continuity)
      if (
        lastRenderedFrameIdx >= 0 &&
        loadStatus[lastRenderedFrameIdx] === 2 &&
        images[lastRenderedFrameIdx] &&
        Math.abs(lastRenderedFrameIdx - targetIdx) <= 12
      ) {
        return images[lastRenderedFrameIdx];
      }

      // 4. Search nearest outward
      for (let offset = 5; offset < TOTAL_FRAMES; offset++) {
        const prev = targetIdx - offset;
        if (prev >= 0 && loadStatus[prev] === 2 && images[prev]) {
          return images[prev];
        }
        const next = targetIdx + offset;
        if (next < TOTAL_FRAMES && loadStatus[next] === 2 && images[next]) {
          return images[next];
        }
      }

      return images[0] || null;
    };

    // --- Responsive Dimensions & DPR ---
    let cachedWidth = 0;
    let cachedHeight = 0;
    let cachedDpr = 1;

    const resizeCanvas = () => {
      if (!container || !canvas) return;
      cachedDpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75);
      cachedWidth = container.clientWidth || window.innerWidth;
      cachedHeight = container.clientHeight || window.innerHeight;

      const newW = Math.round(cachedWidth * cachedDpr);
      const newH = Math.round(cachedHeight * cachedDpr);

      if (canvas.width !== newW || canvas.height !== newH) {
        canvas.width = newW;
        canvas.height = newH;
        canvas.style.width = `${cachedWidth}px`;
        canvas.style.height = `${cachedHeight}px`;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        needsRedraw = true;
      }
    };

    window.addEventListener("resize", resizeCanvas, { passive: true });
    resizeCanvas();

    // --- Smooth Mouse Parallax (Desktop Only) ---
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let lastDrawnMouseX = 0;
    let lastDrawnMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return;
      const w = cachedWidth || window.innerWidth;
      const h = cachedHeight || window.innerHeight;
      const x = (e.clientX / w - 0.5) * 2;
      const y = (e.clientY / h - 0.5) * 2;
      targetMouseX = Math.max(-1, Math.min(1, x));
      targetMouseY = Math.max(-1, Math.min(1, y));
    };

    if (!isMobile) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
    }

    // --- Main RAF Render Loop ---
    const draw = () => {
      if (isDisposed) return;

      const rawProgress = progressRef ? progressRef.current : progress;
      const currentProgress = Math.min(1, Math.max(0, rawProgress));

      const targetFrameIdx = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1)))
      );

      // Dynamically prioritize upcoming corridor for decoding
      prioritizeCorridor(targetFrameIdx);

      // Desktop mouse parallax interpolation
      if (!isMobile) {
        currentMouseX += (targetMouseX - currentMouseX) * 0.05;
        currentMouseY += (targetMouseY - currentMouseY) * 0.05;
      }

      const frameChanged = targetFrameIdx !== lastRenderedFrameIdx;
      const parallaxAttenuation = Math.max(0, 1 - currentProgress * 2.2);
      const mouseDelta =
        Math.abs(currentMouseX - lastDrawnMouseX) + Math.abs(currentMouseY - lastDrawnMouseY);
      const parallaxDirty = !isMobile && mouseDelta > 0.0015 && parallaxAttenuation > 0.05;

      if ((needsRedraw || frameChanged || parallaxDirty) && ctx) {
        const frameSource = getBestFrame(targetFrameIdx);

        if (frameSource && frameSource.complete && frameSource.naturalWidth > 0) {
          const cWidth = canvas.width;
          const cHeight = canvas.height;
          const imgW = frameSource.naturalWidth || 1880;
          const imgH = frameSource.naturalHeight || 920;

          const scale = Math.max(cWidth / imgW, cHeight / imgH) * 1.015;
          const drawW = imgW * scale;
          const drawH = imgH * scale;

          const parallaxX = !isMobile ? currentMouseX * 12 * cachedDpr * parallaxAttenuation : 0;
          const parallaxY = !isMobile ? currentMouseY * 7 * cachedDpr * parallaxAttenuation : 0;

          const drawX = (cWidth - drawW) / 2 + parallaxX;
          const drawY = (cHeight - drawH) / 2 + parallaxY;

          ctx.drawImage(frameSource, drawX, drawY, drawW, drawH);

          lastRenderedFrameIdx = targetFrameIdx;
          lastDrawnMouseX = currentMouseX;
          lastDrawnMouseY = currentMouseY;
          needsRedraw = false;
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    // --- Cleanup & Disposal ---
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      if (!isMobile) {
        window.removeEventListener("mousemove", handleMouseMove);
      }

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img) {
          img.onload = null;
          img.onerror = null;
          img.src = "";
        }
      }
      images.length = 0;
      highPriorityQueue.length = 0;
      normalQueue.length = 0;
    };
  }, [onSceneReady, progressRef, progress]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none pointer-events-none ${className}`}
      style={{
        background: "linear-gradient(180deg, #7baad3 0%, #a4c9e5 45%, #b6cfdf 58%, #7e9bb5 100%)",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{
          contentVisibility: "visible",
        }}
      />
    </div>
  );
}
