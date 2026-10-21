"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Fingerprint, Sparkles } from "lucide-react";
import DeviceAuthModal from "@/components/auth/DeviceAuthModal";
import {
  authenticateWithDevice,
  triggerHaptic,
  playBiometricAudio,
  grantSecretAccess,
  isSecretAccessGranted,
} from "@/lib/deviceAuth";

interface SecretDoorHotspotProps {
  progressRef?: React.RefObject<number>;
}

export default function SecretDoorHotspot({ progressRef }: SecretDoorHotspotProps) {
  const router = useRouter();
  const hotspotRef = useRef<HTMLDivElement>(null);
  const [doorStyle, setDoorStyle] = useState<React.CSSProperties>({ display: "none" });
  const [isOpening, setIsOpening] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const isTriggeringRef = useRef(false);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const [parallax, setParallax] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Prefetch /secret route immediately so entrance feels instantaneous
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
        zIndex: 15,
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

  // Successfully verified door sequence transition
  const executeUnlockNavigation = useCallback(() => {
    grantSecretAccess();
    setIsOpening(true);
    setIsAuthenticating(false);
    setIsAuthModalOpen(false);

    // Magical golden portal glow before entering private sanctuary
    setTimeout(() => {
      router.push("/secret");
      setTimeout(() => {
        setIsOpening(false);
        isTriggeringRef.current = false;
      }, 800);
    }, 380);
  }, [router]);

  // Auto safety timeout: ensures isAuthenticating never hangs indefinitely
  useEffect(() => {
    if (isAuthenticating) {
      const timer = setTimeout(() => {
        setIsAuthenticating(false);
        setIsAuthModalOpen(true);
        isTriggeringRef.current = false;
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticating]);

  // Triggered when door is double-tapped or double-clicked
  const triggerDoorAuthentication = useCallback(async () => {
    if (isTriggeringRef.current || isOpening) return;

    // Verify user is at the initial hero stage where the door is visible in front
    if (progressRef?.current && progressRef.current > 0.18) {
      return;
    }

    // 0. If user already authenticated this session, unlock immediately!
    if (isSecretAccessGranted()) {
      executeUnlockNavigation();
      return;
    }

    isTriggeringRef.current = true;
    setIsAuthenticating(true);
    triggerHaptic("tap");
    playBiometricAudio("scan");

    try {
      // 1. Direct biometric verification (native Capacitor Android prompt or responsive web scan)
      const authResult = await authenticateWithDevice();

      if (authResult.success) {
        // Biometric matched! Open the secret door and transition to Private Atlas
        executeUnlockNavigation();
        return;
      }

      // 2. If prompt was cancelled or unavailable, open Guardian Modal with PIN fallback
      setIsAuthenticating(false);
      setIsAuthModalOpen(true);
      isTriggeringRef.current = false;
    } catch (err) {
      console.warn("Authentication error:", err);
      setIsAuthenticating(false);
      setIsAuthModalOpen(true);
      isTriggeringRef.current = false;
    }
  }, [progressRef, isOpening, executeUnlockNavigation]);

  // Modal close handler
  const handleModalClose = useCallback(() => {
    setIsAuthModalOpen(false);
    setIsAuthenticating(false);
    isTriggeringRef.current = false;
  }, []);

  // Pointer event handler for instant double-tap detection on touch devices & mice
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only respond to primary click/touch
    if (e.button !== 0 && e.button !== -1) return;

    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;
    const dist = Math.hypot(e.clientX - lastTapRef.current.x, e.clientY - lastTapRef.current.y);

    // Check if click/tap falls specifically on the door
    const rect = hotspotRef.current?.getBoundingClientRect();
    if (!rect) return;

    const isInsideDoor =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!isInsideDoor) {
      lastTapRef.current = { time: 0, x: 0, y: 0 };
      return;
    }

    // Double tap within 420ms and within 32px
    if (timeDiff > 40 && timeDiff < 420 && dist < 32) {
      e.preventDefault();
      e.stopPropagation();
      lastTapRef.current = { time: 0, x: 0, y: 0 };
      triggerDoorAuthentication();
      return;
    }

    lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
  };

  // Reset tap timer if finger dragged/scrolled
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!lastTapRef.current.time) return;
    const dist = Math.hypot(e.clientX - lastTapRef.current.x, e.clientY - lastTapRef.current.y);
    if (dist > 20) {
      lastTapRef.current = { time: 0, x: 0, y: 0 };
    }
  };

  // Desktop double-click native event fallback
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerDoorAuthentication();
  };

  return (
    <>
      <div
        ref={hotspotRef}
        role="button"
        tabIndex={0}
        aria-label="Private Atlas Entrance - Double Tap to Authenticate"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onDoubleClick={handleDoubleClick}
        style={{
          ...doorStyle,
          transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
          transition: "transform 0.08s ease-out, box-shadow 0.25s ease-out, opacity 0.25s ease-out",
        }}
        className={`rounded-sm select-none ${
          isOpening
            ? "ring-2 ring-amber-300 shadow-[0_0_60px_rgba(255,230,150,0.8)] bg-amber-100/20"
            : isAuthenticating
            ? "ring-2 ring-cyan-400/80 shadow-[0_0_40px_rgba(34,211,238,0.5)] bg-cyan-950/20 cursor-pointer"
            : "bg-transparent active:bg-white/[0.04]"
        }`}
      >
        {/* Subtle Biometric Lock Indicator on the door surface during scan */}
        {isAuthenticating && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsAuthenticating(false);
              setIsAuthModalOpen(true);
              isTriggeringRef.current = false;
            }}
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto"
            title="Tap to enter PIN"
          >
            <div className="p-3.5 rounded-full bg-neutral-950/80 backdrop-blur-md border border-cyan-400/60 shadow-[0_0_30px_rgba(34,211,238,0.6)] animate-pulse">
              <Fingerprint className="w-8 h-8 text-cyan-300" />
            </div>
            <span className="mt-2 text-[10px] font-mono tracking-widest uppercase text-cyan-300 font-semibold bg-black/70 px-2.5 py-0.5 rounded-full border border-cyan-400/30">
              Scanning... Tap for PIN
            </span>
          </div>
        )}

        {/* Subtle door edge shimmer when opening */}
        {isOpening && (
          <div
            className="absolute inset-0 pointer-events-none rounded-sm border-2 border-amber-300 animate-pulse bg-gradient-to-b from-amber-200/40 via-amber-100/20 to-amber-300/50 flex flex-col items-center justify-center"
            aria-hidden="true"
          >
            <div className="p-3 rounded-full bg-amber-400/30 backdrop-blur-md border border-amber-300 shadow-[0_0_35px_rgba(251,191,36,0.9)] animate-bounce">
              <Sparkles className="w-7 h-7 text-amber-200" />
            </div>
          </div>
        )}
      </div>

      {/* Guardian Biometric / PIN Authentication Modal */}
      <DeviceAuthModal
        isOpen={isAuthModalOpen}
        onSuccess={executeUnlockNavigation}
        onClose={handleModalClose}
      />
    </>
  );
}