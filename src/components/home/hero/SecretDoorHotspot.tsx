"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  authenticateWithDevice,
  triggerHaptic,
  grantSecretAccess,
  revokeSecretAccess,
} from "@/lib/deviceAuth";

interface SecretDoorHotspotProps {
  progressRef?: React.RefObject<number>;
}

export default function SecretDoorHotspot({ progressRef }: SecretDoorHotspotProps) {
  const router = useRouter();
  const hotspotRef = useRef<HTMLDivElement>(null);
  const [doorStyle, setDoorStyle] = useState<React.CSSProperties>({ display: "none" });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const isTriggeringRef = useRef(false);
  const tapHistoryRef = useRef<number[]>([]);
  const [parallax, setParallax] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Prefetch /secret route immediately so entrance is instantaneous
  useEffect(() => {
    router.prefetch("/secret");
  }, [router]);

  // Synchronize precise pixel bounding box of the door matching HeroScene's cover scaling
  useEffect(() => {
    const isMobile =
      (typeof window !== "undefined" && Capacitor.isNativePlatform()) ||
      (typeof navigator !== "undefined" &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ||
      (typeof window !== "undefined" && window.innerWidth < 768);

    const updateDoorBounds = () => {
      const parent = hotspotRef.current?.parentElement;
      const W = parent?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1920);
      const H = parent?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 1080);

      // Source image dimensions in HeroScene: 1880 x 920
      const imgW = 1880;
      const imgH = 920;
      const cssScale = Math.max(W / imgW, H / imgH) * 1.015;
      const drawW = imgW * cssScale;
      const drawH = imgH * cssScale;
      const drawX = (W - drawW) / 2;
      const drawY = (H - drawH) / 2;

      // Exact door coordinates detected in frame_0.webp (1880 x 920):
      // Left: 822px, Right: 1063px (width: 241px, center: 942.5px)
      // Top: 250px, Bottom: 750px (height: 500px, resting at water line)
      const left = drawX + 822 * cssScale;
      const top = drawY + 250 * cssScale;
      const width = 241 * cssScale;
      const height = 500 * cssScale;

      setDoorStyle({
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 35, // High z-index so headline text never blocks it
        cursor: "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        WebkitUserSelect: "none",
      });
    };

    updateDoorBounds();
    window.addEventListener("resize", updateDoorBounds, { passive: true });

    // Desktop mouse parallax matching HeroScene
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      targetMouseX = Math.max(-1, Math.min(1, (e.clientX / w - 0.5) * 2));
      targetMouseY = Math.max(-1, Math.min(1, (e.clientY / h - 0.5) * 2));
    };

    const tickParallax = () => {
      if (!isMobile) {
        currentMouseX += (targetMouseX - currentMouseX) * 0.05;
        currentMouseY += (targetMouseY - currentMouseY) * 0.05;
        const progress = progressRef?.current || 0;
        const parallaxAttenuation = Math.max(0, 1 - progress * 2.2);
        setParallax({
          x: currentMouseX * 12 * parallaxAttenuation,
          y: currentMouseY * 7 * parallaxAttenuation,
        });
      }
      rafId = requestAnimationFrame(tickParallax);
    };

    if (!isMobile) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
      rafId = requestAnimationFrame(tickParallax);
    }

    return () => {
      window.removeEventListener("resize", updateDoorBounds);
      if (!isMobile) {
        window.removeEventListener("mousemove", handleMouseMove);
        cancelAnimationFrame(rafId);
      }
    };
  }, [progressRef]);

  // Always revoke previous secret access on home mount so returning to door locks it immediately
  useEffect(() => {
    revokeSecretAccess();
  }, []);

  // Successfully verified door sequence transition - ZERO artificial delay
  const executeUnlockNavigation = useCallback(() => {
    grantSecretAccess();
    setIsAuthenticating(false);
    isTriggeringRef.current = false;
    router.push("/secret");
  }, [router]);

  // Triggered when door is double-clicked or double-tapped
  const triggerDoorAuthentication = useCallback(async () => {
    if (isTriggeringRef.current) return;

    // Verify user is at the initial hero stage where the door is visible in front
    if (progressRef?.current && progressRef.current > 0.35) {
      return;
    }

    isTriggeringRef.current = true;
    setIsAuthenticating(true);
    triggerHaptic("tap");

    try {
      // Direct native biometric prompt (native Android BiometricPrompt bottom sheet)
      const authResult = await authenticateWithDevice();

      if (authResult.success) {
        // Biometric matched! Open immediately with zero delay
        executeUnlockNavigation();
        return;
      }

      // If user cancelled or failed native verification, simply reset state.
      setIsAuthenticating(false);
      isTriggeringRef.current = false;
      if (!authResult.cancelled) {
        triggerHaptic("error");
      }
    } catch (err) {
      console.warn("Authentication error:", err);
      setIsAuthenticating(false);
      isTriggeringRef.current = false;
    }
  }, [progressRef, executeUnlockNavigation]);

  // Robust double-click and double-tap detection:
  // Detects two taps/clicks within 550ms anywhere on the door hotspot
  const registerDoorTap = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    const history = tapHistoryRef.current;

    // Keep only taps occurring within the last 550ms
    const recent = history.filter((t) => now - t < 550);
    recent.push(now);
    tapHistoryRef.current = recent;

    if (recent.length >= 2) {
      // Double-click / double-tap detected!
      tapHistoryRef.current = [];
      triggerDoorAuthentication();
    }
  }, [triggerDoorAuthentication]);

  // Desktop double-click native browser event fallback
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    tapHistoryRef.current = [];
    triggerDoorAuthentication();
  };

  return (
    <div
      ref={hotspotRef}
      role="button"
      tabIndex={-1}
      aria-label="Private Atlas Entrance - Double Click or Tap to Authenticate"
      onPointerDown={registerDoorTap}
      onDoubleClick={handleDoubleClick}
      style={{
        ...doorStyle,
        transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
        outline: "none",
        WebkitTapHighlightColor: "transparent",
        WebkitTouchCallout: "none",
        border: "none",
        background: "transparent",
        boxShadow: "none",
      }}
      className="outline-none focus:outline-none focus:ring-0 active:outline-none ring-0 border-0 bg-transparent select-none cursor-pointer"
    />
  );
}