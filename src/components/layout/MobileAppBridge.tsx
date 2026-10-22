"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";

export default function MobileAppBridge() {
  useEffect(() => {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
      return;
    }

    // Configure status bar for true edge-to-edge immersion without hiding bars
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

    // Android hardware & gesture back button listener
    const backButtonListener = CapApp.addListener("backButton", () => {
      if (window.location.pathname === "/") {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    });

    // In-app single-swipe from left edge detection
    let touchStartX = 0;
    let touchStartY = 0;
    let isEdgeSwipe = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      // Only capture swipes starting within 35px of the left edge
      if (touch.clientX <= 35) {
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isEdgeSwipe = true;
      } else {
        isEdgeSwipe = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEdgeSwipe) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = Math.abs(touch.clientY - touchStartY);

      // Horizontal rightward swipe from edge
      if (deltaX > 55 && deltaY < deltaX * 0.75) {
        if (window.location.pathname !== "/") {
          window.history.back();
        }
      }
      isEdgeSwipe = false;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      backButtonListener.then((sub) => sub.remove()).catch(() => {});
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  return null;
}
