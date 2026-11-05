"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BreadcrumbPoint,
  ExpeditionLeg,
  ExpeditionLegCategory,
  LiveExpeditionSession,
  ID,
} from "./types";
import {
  getLiveExpedition,
  saveLiveExpedition,
} from "./storage";
import {
  startExpedition,
  startNewLeg,
  pauseExpedition,
  resumeExpedition,
  endExpedition,
  addBreadcrumbToExpedition,
  shouldRecordPoint,
  exportExpeditionToGeoJson,
  formatDuration,
} from "./liveTrackingEngine";
import { notifyVaultChange } from "./useTripVault";
import { syncActiveTripToWidget } from "./tripWidgetSync";
import { triggerHaptic } from "@/lib/deviceAuth";

// Native Capacitor Plugins Bridge helper
function getCapacitorPlugins() {
  if (typeof window !== "undefined" && (window as any).Capacitor?.Plugins) {
    return (window as any).Capacitor.Plugins;
  }
  return null;
}

export function useLiveExpedition(tripId: ID) {
  const [session, setSession] = useState<LiveExpeditionSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const sessionRef = useRef<LiveExpeditionSession | null>(null);
  sessionRef.current = session;

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load session from IndexedDB
  const loadSession = useCallback(async () => {
    try {
      const data = await getLiveExpedition(tripId);
      setSession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load expedition session.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadSession();
    const handleVaultChange = () => loadSession();
    window.addEventListener("life_atlas_vault_change", handleVaultChange);
    return () => {
      window.removeEventListener("life_atlas_vault_change", handleVaultChange);
    };
  }, [loadSession]);

  // Persist session update helper
  const persist = useCallback(
    async (updated: LiveExpeditionSession) => {
      setSession(updated);
      try {
        await saveLiveExpedition(tripId, updated);
        notifyVaultChange();

        // Sync with Native Android Notification Service & Home Screen Widget
        const plugins = getCapacitorPlugins();
        if (plugins?.ExpeditionTracking && updated.status === "ACTIVE") {
          void plugins.ExpeditionTracking.updateStats({ distanceKm: updated.totalDistanceKm });
        }
        void syncActiveTripToWidget(tripId);
      } catch (err) {
        console.error("Failed to save expedition:", err);
      }
    },
    [tripId]
  );

  // Live stopwatch timer when tracking is ACTIVE
  useEffect(() => {
    if (session?.status === "ACTIVE") {
      timerRef.current = setInterval(() => {
        setSession((prev) => {
          if (!prev || prev.status !== "ACTIVE") return prev;
          const updatedLegs = prev.legs.map((leg) => {
            if (leg.id === prev.activeLegId && leg.status === "ACTIVE") {
              return { ...leg, durationSeconds: leg.durationSeconds + 1 };
            }
            return leg;
          });
          return {
            ...prev,
            totalDurationSeconds: prev.totalDurationSeconds + 1,
            legs: updatedLegs,
          };
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.status, session?.activeLegId]);

  // Geolocation Watcher
  useEffect(() => {
    if (session?.status === "ACTIVE" && typeof window !== "undefined" && "geolocation" in navigator) {
      const handlePosition = (pos: GeolocationPosition) => {
        const currentSession = sessionRef.current;
        if (!currentSession || currentSession.status !== "ACTIVE") return;

        const activeLeg = currentSession.legs.find((l) => l.id === currentSession.activeLegId);
        const prevPoint = activeLeg?.coordinates[activeLeg.coordinates.length - 1];

        const speedKmh =
          pos.coords.speed != null && pos.coords.speed >= 0
            ? pos.coords.speed * 3.6
            : null;

        const newPoint: BreadcrumbPoint = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude != null ? Math.round(pos.coords.altitude) : null,
          speed: speedKmh != null ? Math.round(speedKmh) : null,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp || Date.now(),
        };

        if (shouldRecordPoint(prevPoint, newPoint)) {
          const updated = addBreadcrumbToExpedition(currentSession, newPoint);
          void persist(updated);
        }
      };

      const handleError = (err: GeolocationPositionError) => {
        console.warn("GPS tracking warning:", err.message);
      };

      watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      });
    } else {
      if (watchIdRef.current !== null && typeof window !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null && typeof window !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [session?.status, session?.activeLegId, persist]);

  // Actions
  const start = useCallback(
    async (title = "Full Expedition", category: ExpeditionLegCategory = "TREK") => {
      triggerHaptic("tap");

      // Request native Android permission if available
      const plugins = getCapacitorPlugins();
      if (plugins?.AtlasPermissions) {
        try {
          await plugins.AtlasPermissions.requestLocationPermission();
        } catch (ignored) {}
      }

      if (plugins?.ExpeditionTracking) {
        try {
          await plugins.ExpeditionTracking.startTracking({ tripId, legTitle: title });
        } catch (ignored) {}
      }

      const newSession = startExpedition(tripId, title, category);
      await persist(newSession);
    },
    [tripId, persist]
  );

  const startLeg = useCallback(
    async (title: string, category: ExpeditionLegCategory = "TREK") => {
      triggerHaptic("tap");
      if (!session) return;
      const updated = startNewLeg(session, title, category);
      await persist(updated);
    },
    [session, persist]
  );

  const pause = useCallback(async () => {
    triggerHaptic("tap");
    if (!session) return;
    const updated = pauseExpedition(session);
    await persist(updated);
  }, [session, persist]);

  const resume = useCallback(async () => {
    triggerHaptic("tap");
    if (!session) return;
    const updated = resumeExpedition(session);
    await persist(updated);
  }, [session, persist]);

  const end = useCallback(async () => {
    triggerHaptic("success");
    if (!session) return;

    const plugins = getCapacitorPlugins();
    if (plugins?.ExpeditionTracking) {
      try {
        await plugins.ExpeditionTracking.stopTracking();
      } catch (ignored) {}
    }

    const updated = endExpedition(session);
    await persist(updated);
  }, [session, persist]);

  const activeLeg = useMemo(() => {
    if (!session || !session.activeLegId) return null;
    return session.legs.find((l) => l.id === session.activeLegId) ?? null;
  }, [session]);

  const geoJson = useMemo(() => {
    if (!session) return null;
    return exportExpeditionToGeoJson(session);
  }, [session]);

  const elapsedFormatted = useMemo(() => {
    return formatDuration(session?.totalDurationSeconds ?? 0);
  }, [session?.totalDurationSeconds]);

  return {
    session,
    isLoading,
    error,
    isTracking: session?.status === "ACTIVE",
    isPaused: session?.status === "PAUSED",
    isCompleted: session?.status === "COMPLETED",
    activeLeg,
    geoJson,
    elapsedFormatted,
    start,
    startLeg,
    pause,
    resume,
    end,
    refresh: loadSession,
  };
}
