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

    // Configure status bar for true fullscreen edge-to-edge display
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.hide().catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

    // Configure Android hardware back button
    const backButtonListener = CapApp.addListener("backButton", ({ canGoBack }) => {
      if (window.location.pathname === "/" || !canGoBack) {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    });

    return () => {
      backButtonListener.then((sub) => sub.remove()).catch(() => {});
    };
  }, []);

  return null;
}
