"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import YouTubeShareModal from "@/components/music/YouTubeShareModal";
import { isSecretAccessGranted } from "@/lib/deviceAuth";

export default function GlobalYouTubeShareHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");

  const handleOpenShare = useCallback((url: string = "") => {
    setTargetUrl(url);
    setIsModalOpen(false);
    setTimeout(() => {
      setIsModalOpen(true);
    }, 10);
    // Navigate to Music Vault if not already on /secret/music
    if (pathname && !pathname.startsWith("/secret/music")) {
      router.push("/secret/music");
    }
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __openYouTubeModal?: (url?: string) => void }).__openYouTubeModal = handleOpenShare;
    }
  }, [handleOpenShare]);

  const checkPendingShare = useCallback(() => {
    if (typeof window === "undefined") return;

    // Only proceed to open the YouTube modal if secret vault authentication is active
    if (!isSecretAccessGranted()) return;

    // 1. Check localStorage for pending shared URL from native Android share intent
    const pendingUrl = localStorage.getItem("pending_youtube_share_url");
    if (pendingUrl) {
      localStorage.removeItem("pending_youtube_share_url");
      handleOpenShare(pendingUrl);
      return;
    }

    // 2. Check URL query parameters (e.g. /secret?youtube_url=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const queryUrl = params.get("youtube_url") || params.get("share_url") || params.get("yt");
      if (queryUrl) {
        // Strip the query parameters cleanly so they don't re-trigger on subsequent navigations
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("youtube_url");
        newUrl.searchParams.delete("share_url");
        newUrl.searchParams.delete("yt");
        newUrl.searchParams.delete("require_auth");
        window.history.replaceState({}, "", newUrl.toString());

        handleOpenShare(queryUrl);
      }
    } catch (e) {
      console.warn("Error parsing URL search params:", e);
    }
  }, [handleOpenShare]);

  useEffect(() => {
    // Check pending share on mount
    checkPendingShare();

    // When the vault is unlocked via biometric fingerprint, check for queued share URLs
    const handleVaultUnlocked = () => {
      setTimeout(checkPendingShare, 120);
    };

    // Listen for direct custom event from Android native BridgeActivity or MusicNav buttons
    const handleCustomShareEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ url?: string; requireAuth?: boolean }>;
      const sharedUrl = customEvent?.detail?.url;
      if (typeof sharedUrl === "string" && sharedUrl.trim().length > 0) {
        if (!isSecretAccessGranted()) {
          localStorage.setItem("pending_youtube_share_url", sharedUrl.trim());
        } else {
          handleOpenShare(sharedUrl.trim());
        }
      } else {
        // Open blank modal for manual input
        handleOpenShare("");
      }
    };

    window.addEventListener("vault-unlocked", handleVaultUnlocked);
    window.addEventListener("lifeatlas_youtube_share", handleCustomShareEvent);

    return () => {
      window.removeEventListener("vault-unlocked", handleVaultUnlocked);
      window.removeEventListener("lifeatlas_youtube_share", handleCustomShareEvent);
    };
  }, [checkPendingShare, handleOpenShare]);

  return (
    <YouTubeShareModal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        setTargetUrl("");
      }}
      initialUrl={targetUrl}
      onSuccess={() => {
        window.dispatchEvent(new CustomEvent("lifeatlas_tracks_updated"));
      }}
    />
  );
}

