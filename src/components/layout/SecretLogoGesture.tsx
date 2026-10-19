"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

interface SecretLogoGestureProps {
  className?: string;
  linkHoverClass?: string;
}

export default function SecretLogoGesture({
  className = "",
  linkHoverClass = "",
}: SecretLogoGestureProps) {
  const router = useRouter();
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  // Background prefetch for instant transition
  useEffect(() => {
    const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();
    const isDev = process.env.NODE_ENV === "development";
    if (isNative || isDev) {
      router.prefetch("/secret");
    }
  }, [router]);

  const checkEligibility = useCallback(() => {
    if (typeof window === "undefined") return false;
    return Capacitor.isNativePlatform() || process.env.NODE_ENV === "development";
  }, []);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activatedRef = useRef(false);

  const HOLD_DURATION = 1350; // 1.35s: comfortably within 1.2s - 1.5s requirement
  const MOVE_THRESHOLD = 18; // 18px touch tolerance before cancelling gesture

  const cancelHold = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const onHoldComplete = useCallback(() => {
    activatedRef.current = true;
    setIsHolding(false);
    setHoldProgress(100);

    // Subtle tactile haptic impulse on supported mobile hardware
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([35, 40, 35]);
      } catch {
        // Ignore haptic failure on unsupported devices
      }
    }

    // Smooth navigation into Private Atlas secret shell
    router.push("/secret");

    // Reset activation flag and progress indicator after transition
    setTimeout(() => {
      setHoldProgress(0);
      activatedRef.current = false;
    }, 800);
  }, [router]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!checkEligibility()) return;

    // Only respond to primary touch/button
    if (e.button !== 0) return;

    activatedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startTimeRef.current = Date.now();
    setIsHolding(true);
    setHoldProgress(0);

    timerRef.current = setTimeout(() => {
      onHoldComplete();
    }, HOLD_DURATION);

    const tick = () => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setHoldProgress(progress);

      if (elapsed < HOLD_DURATION) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isHolding) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);

    // Cancel if user drags or scrolls beyond threshold
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
      cancelHold();
    }
  };

  const handlePointerUp = () => {
    if (!isHolding) return;
    // Released early before threshold -> cancel gesture, allow standard click navigation
    cancelHold();
  };

  const handlePointerCancel = () => {
    if (!activatedRef.current) {
      cancelHold();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // If the hold completed and triggered the secret area, suppress standard link navigation to "/"
    if (activatedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const preventNativeCallout = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const touchStyles: React.CSSProperties = {
    touchAction: "none",
    WebkitTouchCallout: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <div
      className="relative inline-flex items-center select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={preventNativeCallout}
      style={touchStyles}
    >
      <Link
        href="/"
        onClick={handleClick}
        draggable={false}
        onDragStart={preventNativeCallout}
        onContextMenu={preventNativeCallout}
        className={`font-sans text-sm font-bold tracking-[0.2em] uppercase z-50 flex items-center gap-2 transition-all duration-200 select-none ${linkHoverClass} ${className} ${
          isHolding ? "opacity-90 brightness-110" : ""
        }`}
        aria-label="Life Atlas"
        style={touchStyles}
      >
        LIFE ATLAS
      </Link>

      {/* Subtle Luminous Progress Hairline (Restrained Feedback) */}
      {(isHolding || holdProgress > 0) && (
        <div
          className="absolute -bottom-1 left-0 right-0 h-[2px] bg-foreground/15 overflow-hidden pointer-events-none rounded-full"
          aria-hidden="true"
        >
          <div
            className="h-full bg-gradient-to-r from-accent/80 via-accent to-accent transition-all ease-linear shadow-[0_0_8px_rgba(31,79,216,0.35)]"
            style={{
              width: `${holdProgress}%`,
              transitionDuration: isHolding ? "50ms" : "200ms",
            }}
          />
        </div>
      )}
    </div>
  );
}
