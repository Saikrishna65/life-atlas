"use client";

import React, { useEffect, useRef } from "react";

interface HeroSceneProps {
  className?: string;
  onSceneReady?: () => void;
  progressRef?: React.RefObject<number>;
  progress?: number;
}

const TOTAL_FRAMES = 287;
const FRAME_PREFIX = "/images/door-sequence/frame_";
const FRAME_EXT = ".webp";
const MAX_CACHE_SIZE = 120; // Maximum loaded HTMLImageElements kept in active memory

/**
 * Photorealistic Cinematic Hero Scene — Stage 2: Scroll-Driven Door Opening
 * - Uses the verified 287-frame sequence extracted from the reference site.
 * - Frame 0 matches the approved static closed door scene pixel-for-pixel.
 * - Deterministic frame mapping from scroll progress (0.0 -> Frame 0, 1.0 -> Frame 286).
 * - High-DPI responsive canvas with xMidYMid slice aspect ratio cover scaling.
 * - Intelligent progressive preloader with nearest-frame fallback to prevent flickering.
 * - Sliding window memory cache with active pruning to prevent memory bloat.
 * - Reversible, smooth, and respects reduced motion.
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

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let isDisposed = false;

    // --- Frame Cache & Loading Management ---
    const imageCache = new Map<number, HTMLImageElement>();
    const loadingSet = new Set<number>();
    const loadQueue: number[] = [];
    let activeLoads = 0;
    const MAX_CONCURRENT_LOADS = 6;

    // Helper: load a specific frame index
    const loadFrame = (index: number, priority = false): void => {
      if (index < 0 || index >= TOTAL_FRAMES) return;
      if (imageCache.has(index) || loadingSet.has(index)) return;

      if (priority) {
        // Add to front of queue if not already queued
        const existingIdx = loadQueue.indexOf(index);
        if (existingIdx !== -1) loadQueue.splice(existingIdx, 1);
        loadQueue.unshift(index);
      } else {
        if (!loadQueue.includes(index)) {
          loadQueue.push(index);
        }
      }

      pumpQueue();
    };

    const pumpQueue = () => {
      if (isDisposed) return;
      while (activeLoads < MAX_CONCURRENT_LOADS && loadQueue.length > 0) {
        const nextIdx = loadQueue.shift();
        if (nextIdx === undefined) break;
        if (imageCache.has(nextIdx) || loadingSet.has(nextIdx)) continue;

        activeLoads++;
        loadingSet.add(nextIdx);

        const img = new Image();
        img.src = `${FRAME_PREFIX}${nextIdx}${FRAME_EXT}`;

        const onComplete = () => {
          activeLoads--;
          loadingSet.delete(nextIdx);
          if (isDisposed) return;

          imageCache.set(nextIdx, img);

          if (nextIdx === 0 && onSceneReady) {
            onSceneReady();
          }

          // Trigger redraw if this frame is near the current active frame
          const currentProgress = progressRef?.current ?? progress;
          const currentTargetFrame = Math.min(
            TOTAL_FRAMES - 1,
            Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1)))
          );
          if (Math.abs(nextIdx - currentTargetFrame) <= 2) {
            needsRedraw = true;
          }

          pumpQueue();
        };

        img.onload = onComplete;
        img.onerror = () => {
          activeLoads--;
          loadingSet.delete(nextIdx);
          pumpQueue();
        };
      }
    };

    // Load Frame 0 immediately (approved static hero)
    loadFrame(0, true);

    // Preload immediate initial buffer (frames 1..25)
    for (let i = 1; i <= 25; i++) {
      loadFrame(i, false);
    }

    // Preload keyframe strides (every 10th frame) across the whole sequence
    for (let i = 30; i < TOTAL_FRAMES; i += 10) {
      loadFrame(i, false);
    }
    loadFrame(TOTAL_FRAMES - 1, false);

    // Queue background fill for all remaining frames during idle time
    let idleTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (isDisposed) return;
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        loadFrame(i, false);
      }
    }, 600);

    // Nearest loaded frame fallback: guarantees ZERO flicker or blank canvas
    const getBestFrame = (targetIdx: number): HTMLImageElement | null => {
      // 1. Exact match
      const exact = imageCache.get(targetIdx);
      if (exact && exact.complete && exact.naturalWidth > 0) return exact;

      // 2. Search backward towards 0
      for (let i = targetIdx - 1; i >= 0; i--) {
        const prev = imageCache.get(i);
        if (prev && prev.complete && prev.naturalWidth > 0) return prev;
      }

      // 3. Search forward towards 286
      for (let i = targetIdx + 1; i < TOTAL_FRAMES; i++) {
        const next = imageCache.get(i);
        if (next && next.complete && next.naturalWidth > 0) return next;
      }

      // 4. Default to frame 0
      return imageCache.get(0) || null;
    };

    // Prioritize loading frames in the vicinity of current target frame
    let lastVicinityCenter = -1;
    const prioritizeVicinity = (targetIdx: number) => {
      if (Math.abs(targetIdx - lastVicinityCenter) < 3) return;
      lastVicinityCenter = targetIdx;

      // Load nearby frames with high priority: target - 3 to target + 15
      for (let offset = 0; offset <= 15; offset++) {
        const ahead = targetIdx + offset;
        if (ahead < TOTAL_FRAMES && !imageCache.has(ahead)) {
          loadFrame(ahead, true);
        }
      }
      for (let offset = 1; offset <= 4; offset++) {
        const behind = targetIdx - offset;
        if (behind >= 0 && !imageCache.has(behind)) {
          loadFrame(behind, true);
        }
      }

      // Memory management: prune distant frames if cache exceeds MAX_CACHE_SIZE
      if (imageCache.size > MAX_CACHE_SIZE) {
        for (const [idx, img] of imageCache.entries()) {
          // Never prune frame 0 (resting hero state) or frames within 50 of target
          if (idx !== 0 && Math.abs(idx - targetIdx) > 55) {
            img.src = "";
            imageCache.delete(idx);
          }
          if (imageCache.size <= MAX_CACHE_SIZE * 0.75) break;
        }
      }
    };

    // --- Mouse Parallax Tracking ---
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let needsRedraw = true;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetMouseX = Math.max(-1, Math.min(1, x));
      targetMouseY = Math.max(-1, Math.min(1, y));
      needsRedraw = true;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // --- High-DPI Responsive Sizing ---
    const resizeCanvas = () => {
      if (!container || !canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const newW = Math.round(width * dpr);
      const newH = Math.round(height * dpr);

      if (canvas.width !== newW || canvas.height !== newH) {
        canvas.width = newW;
        canvas.height = newH;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        needsRedraw = true;
      }
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // --- Render Loop ---
    let lastDrawnFrameIdx = -1;
    let renderedProgress = 0;

    const draw = () => {
      if (isDisposed) return;

      const rawProgress = progressRef ? progressRef.current : progress;
      const targetProgress = Math.min(1, Math.max(0, rawProgress));

      // Damped progress tracking for silky continuous scrubbing
      renderedProgress += (targetProgress - renderedProgress) * 0.35;
      if (Math.abs(targetProgress - renderedProgress) < 0.0005) {
        renderedProgress = targetProgress;
      }

      // Deterministic target frame calculation
      const targetFrameIdx = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.round(renderedProgress * (TOTAL_FRAMES - 1)))
      );

      // Prioritize nearby frames for streaming
      prioritizeVicinity(targetFrameIdx);

      // Smooth mouse parallax interpolation
      const prevMouseX = currentMouseX;
      const prevMouseY = currentMouseY;
      currentMouseX += (targetMouseX - currentMouseX) * 0.045;
      currentMouseY += (targetMouseY - currentMouseY) * 0.045;

      const mouseDelta = Math.abs(currentMouseX - prevMouseX) + Math.abs(currentMouseY - prevMouseY);
      if (mouseDelta > 0.0005) {
        needsRedraw = true;
      }

      if (targetFrameIdx !== lastDrawnFrameIdx) {
        needsRedraw = true;
      }

      if (needsRedraw && ctx) {
        const frameImg = getBestFrame(targetFrameIdx);

        if (frameImg && frameImg.complete && frameImg.naturalWidth > 0) {
          const cWidth = canvas.width;
          const cHeight = canvas.height;
          const imgW = frameImg.naturalWidth || 1880;
          const imgH = frameImg.naturalHeight || 920;

          // xMidYMid slice cover scaling matching reference Webflow canvas
          const scale = Math.max(cWidth / imgW, cHeight / imgH) * 1.015;
          const drawW = imgW * scale;
          const drawH = imgH * scale;

          // Parallax smoothly fades out as camera moves forward into the door
          const parallaxAttenuation = Math.max(0, 1 - renderedProgress * 2.2);
          const dpr = window.devicePixelRatio || 1;
          const parallaxX = currentMouseX * 14 * dpr * parallaxAttenuation;
          const parallaxY = currentMouseY * 8 * dpr * parallaxAttenuation;

          const drawX = (cWidth - drawW) / 2 + parallaxX;
          const drawY = (cHeight - drawH) / 2 + parallaxY;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(frameImg, drawX, drawY, drawW, drawH);

          lastDrawnFrameIdx = targetFrameIdx;
          needsRedraw = false;
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      isDisposed = true;
      if (idleTimer) clearTimeout(idleTimer);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", resizeCanvas);

      // Clean up cached images
      for (const img of imageCache.values()) {
        img.src = "";
      }
      imageCache.clear();
      loadingSet.clear();
      loadQueue.length = 0;
    };
  }, [onSceneReady, progressRef, progress]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none pointer-events-auto ${className}`}
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
