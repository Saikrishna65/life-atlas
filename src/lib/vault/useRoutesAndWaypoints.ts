"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  WaypointRecord,
  WaypointCategory,
  RouteSegment,
  ID,
} from "./types";
import {
  getWaypointsForTrip,
  saveWaypoint,
  deleteWaypoint,
  getRouteSegmentsForTrip,
  saveRouteSegment,
  deleteRouteSegment,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export interface MountainPresetWaypoint {
  title: string;
  category: WaypointCategory;
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  notes?: string;
}

export interface RoutePresetSegment {
  fromStop: string;
  toStop: string;
  distanceKm: number;
  estimatedHours: number;
  terrainType: RouteSegment["terrainType"];
  roadCondition: RouteSegment["roadCondition"];
  highestElevationMeters?: number;
  passNames?: string[];
  advisoryNotes?: string;
}

export const MOUNTAIN_PRESET_WAYPOINTS: MountainPresetWaypoint[] = [
  {
    title: "Khardung La Pass",
    category: "PASS",
    latitude: 34.2787,
    longitude: 77.6047,
    elevationMeters: 5359,
    notes: "World famous mountain pass gateway to Nubra & Shyok Valleys. Limit stay to 15 mins to avoid AMS.",
  },
  {
    title: "Chang La Mountain Pass",
    category: "PASS",
    latitude: 34.0489,
    longitude: 77.9298,
    elevationMeters: 5360,
    notes: "Gateway pass to Pangong Tso lake. Steep ascent with loose gravel near summit.",
  },
  {
    title: "Baralacha La Pass",
    category: "PASS",
    latitude: 32.7567,
    longitude: 77.4208,
    elevationMeters: 4890,
    notes: "Connects Lahaul to Ladakh. Often snow-bound until early June with Suraj Tal lake nearby.",
  },
  {
    title: "Tanglang La Pass",
    category: "PASS",
    latitude: 33.5083,
    longitude: 77.7014,
    elevationMeters: 5328,
    notes: "Second highest pass on Manali-Leh Highway leading onto the Moore Plains.",
  },
  {
    title: "Tandi Indian Oil Petrol Pump",
    category: "FUEL_PUMP",
    latitude: 32.5539,
    longitude: 76.9744,
    elevationMeters: 2850,
    notes: "CRITICAL: Last petrol pump before Karu (365 km stretch with zero fuel stations). Top up tank and cans.",
  },
  {
    title: "Karu IOCL Fuel & Air Station",
    category: "FUEL_PUMP",
    latitude: 33.9217,
    longitude: 77.7471,
    elevationMeters: 3500,
    notes: "Major fuel replenishment junction before climbing Chang La or entering Leh town.",
  },
  {
    title: "Gata Loops (21 Hairpin Bends)",
    category: "VIEWPOINT",
    latitude: 32.9691,
    longitude: 77.5672,
    elevationMeters: 4190,
    notes: "Legendary 21 hairpin bends climbing from 4,190m to Nakee La pass. Ghost of Gata Loops shrine at hairpin 19.",
  },
  {
    title: "Pangong Tso Shoreline",
    category: "VIEWPOINT",
    latitude: 33.7595,
    longitude: 78.6674,
    elevationMeters: 4225,
    notes: "High-altitude endorheic saltwater lake changing shades of azure, turquoise, and emerald with sunlight.",
  },
  {
    title: "Keylong Motorcycle Workshop",
    category: "MECHANIC",
    latitude: 32.5714,
    longitude: 77.0322,
    elevationMeters: 3080,
    notes: "Reliable Royal Enfield & adventure motorcycle mechanics for brake pad and chain adjustments.",
  },
  {
    title: "Sarchu Military First Aid Post",
    category: "MEDICAL",
    latitude: 32.9097,
    longitude: 77.5833,
    elevationMeters: 4290,
    notes: "Indian Army medical post with emergency oxygen cylinders and high altitude sickness treatment.",
  },
  {
    title: "North Pullu Permit Checkpost",
    category: "CHECKPOST",
    latitude: 34.2274,
    longitude: 77.5843,
    elevationMeters: 4660,
    notes: "Inner Line Permit (ILP) inspection checkpost before descending into Nubra Valley.",
  },
  {
    title: "Pagal Nallah Water Crossing",
    category: "HAZARD",
    latitude: 32.7121,
    longitude: 77.3822,
    elevationMeters: 4400,
    notes: "Rapid afternoon glacier melt stream. Cross strictly before 11:00 AM before water levels surge.",
  },
];

export const MOUNTAIN_PRESET_SEGMENTS: RoutePresetSegment[] = [
  {
    fromStop: "Manali",
    toStop: "Jispa",
    distanceKm: 138,
    estimatedHours: 4.5,
    terrainType: "MOUNTAIN_TWISTIES",
    roadCondition: "PAVED_GOOD",
    highestElevationMeters: 3120,
    passNames: ["Atal Tunnel (3,048m)"],
    advisoryNotes: "Scenic paved road through Atal Tunnel. Fuel up at Tandi pump just before Keylong.",
  },
  {
    fromStop: "Jispa",
    toStop: "Sarchu",
    distanceKm: 85,
    estimatedHours: 4.0,
    terrainType: "HIGH_ALTITUDE_PASS",
    roadCondition: "GRAVEL_UNPAVED",
    highestElevationMeters: 4890,
    passNames: ["Baralacha La (4,890m)"],
    advisoryNotes: "Rough terrain with water crossings at Zingzingbar and Bharatpur tent colony.",
  },
  {
    fromStop: "Sarchu",
    toStop: "Leh",
    distanceKm: 250,
    estimatedHours: 7.5,
    terrainType: "HIGH_ALTITUDE_PASS",
    roadCondition: "POTHOLES",
    highestElevationMeters: 5328,
    passNames: ["Nakee La (4,739m)", "Lachung La (5,059m)", "Tanglang La (5,328m)"],
    advisoryNotes: "Ascend Gata Loops, cross the flat 40km Moore Plains, and climb Tanglang La before descending to Upshi.",
  },
  {
    fromStop: "Leh",
    toStop: "Nubra Valley (Hunder)",
    distanceKm: 125,
    estimatedHours: 5.0,
    terrainType: "HIGH_ALTITUDE_PASS",
    roadCondition: "EXTREME",
    highestElevationMeters: 5359,
    passNames: ["Khardung La (5,359m)"],
    advisoryNotes: "Steep climb with unpaved rocks near Khardung La top. Carry offline maps and physical permits.",
  },
  {
    fromStop: "Nubra Valley",
    toStop: "Pangong Tso (Spangmik)",
    distanceKm: 165,
    estimatedHours: 6.0,
    terrainType: "OFF_ROAD_TRAIL",
    roadCondition: "WATER_CROSSING",
    highestElevationMeters: 4225,
    passNames: [],
    advisoryNotes: "Direct route via Shyok River. Watch for landslides and rapid river stream crossings at Agham.",
  },
];

export function useRoutesAndWaypoints(tripId: string) {
  const [waypoints, setWaypoints] = useState<WaypointRecord[]>([]);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const [wpData, segData] = await Promise.all([
        getWaypointsForTrip(tripId),
        getRouteSegmentsForTrip(tripId),
      ]);
      setWaypoints(wpData);
      setRouteSegments(segData);
    } catch (err) {
      console.error("Failed loading routes and waypoints:", err);
      setError("Unable to load offline routes and GPS waypoints.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const [wpData, segData] = await Promise.all([
          getWaypointsForTrip(tripId),
          getRouteSegmentsForTrip(tripId),
        ]);
        if (mounted) {
          setWaypoints(wpData);
          setRouteSegments(segData);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial waypoints load:", err);
          setError("Failed to load waypoints.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    const handleVaultChange = () => {
      loadData();
    };

    window.addEventListener("vault-storage-change", handleVaultChange);
    return () => {
      mounted = false;
      window.removeEventListener("vault-storage-change", handleVaultChange);
    };
  }, [tripId, loadData]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalWaypoints = waypoints.length;
    const passesCount = waypoints.filter((w) => w.category === "PASS").length;
    const fuelPumpsCount = waypoints.filter((w) => w.category === "FUEL_PUMP").length;
    const hazardsCount = waypoints.filter((w) => w.category === "HAZARD").length;

    let maxElevation = 0;
    for (const w of waypoints) {
      if (w.elevationMeters && w.elevationMeters > maxElevation) {
        maxElevation = w.elevationMeters;
      }
    }
    for (const s of routeSegments) {
      if (s.highestElevationMeters && s.highestElevationMeters > maxElevation) {
        maxElevation = s.highestElevationMeters;
      }
    }

    const totalRouteKm = routeSegments.reduce((sum, s) => sum + (s.distanceKm || 0), 0);
    const totalEstHours = routeSegments.reduce((sum, s) => sum + (s.estimatedHours || 0), 0);

    return {
      totalWaypoints,
      passesCount,
      fuelPumpsCount,
      hazardsCount,
      maxElevation,
      totalRouteKm,
      totalEstHours,
      segmentsCount: routeSegments.length,
    };
  }, [waypoints, routeSegments]);

  // Actions: Waypoints
  const addWaypoint = useCallback(
    async (
      record: Omit<WaypointRecord, "id" | "tripId" | "createdAt">
    ): Promise<WaypointRecord> => {
      const newWp: WaypointRecord = {
        ...record,
        id: `wp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tripId,
        createdAt: new Date().toISOString(),
      };
      const saved = await saveWaypoint(tripId, newWp);
      notifyVaultChange();
      await loadData();
      return saved;
    },
    [tripId, loadData]
  );

  const updateWp = useCallback(
    async (wp: WaypointRecord): Promise<WaypointRecord> => {
      const saved = await saveWaypoint(tripId, wp);
      notifyVaultChange();
      await loadData();
      return saved;
    },
    [tripId, loadData]
  );

  const removeWp = useCallback(
    async (id: ID) => {
      await deleteWaypoint(tripId, id);
      notifyVaultChange();
      await loadData();
    },
    [tripId, loadData]
  );

  // Actions: Route Segments
  const addRouteSegment = useCallback(
    async (
      record: Omit<RouteSegment, "id" | "tripId" | "createdAt">
    ): Promise<RouteSegment> => {
      const newSeg: RouteSegment = {
        ...record,
        id: `seg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tripId,
        createdAt: new Date().toISOString(),
      };
      const saved = await saveRouteSegment(tripId, newSeg);
      notifyVaultChange();
      await loadData();
      return saved;
    },
    [tripId, loadData]
  );

  const updateSeg = useCallback(
    async (seg: RouteSegment): Promise<RouteSegment> => {
      const saved = await saveRouteSegment(tripId, seg);
      notifyVaultChange();
      await loadData();
      return saved;
    },
    [tripId, loadData]
  );

  const removeSeg = useCallback(
    async (id: ID) => {
      await deleteRouteSegment(tripId, id);
      notifyVaultChange();
      await loadData();
    },
    [tripId, loadData]
  );

  // Seed mountain presets
  const seedMountainPresets = useCallback(async (): Promise<{ waypointsCount: number; segmentsCount: number }> => {
    let wpCount = 0;
    let segCount = 0;

    for (const preset of MOUNTAIN_PRESET_WAYPOINTS) {
      const exists = waypoints.some((w) => w.title.toLowerCase() === preset.title.toLowerCase());
      if (!exists) {
        await saveWaypoint(tripId, {
          id: `wp-preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          tripId,
          title: preset.title,
          category: preset.category,
          latitude: preset.latitude,
          longitude: preset.longitude,
          elevationMeters: preset.elevationMeters,
          notes: preset.notes,
          createdAt: new Date().toISOString(),
        });
        wpCount++;
      }
    }

    for (let i = 0; i < MOUNTAIN_PRESET_SEGMENTS.length; i++) {
      const preset = MOUNTAIN_PRESET_SEGMENTS[i];
      const exists = routeSegments.some(
        (s) => s.fromStop.toLowerCase() === preset.fromStop.toLowerCase() && s.toStop.toLowerCase() === preset.toStop.toLowerCase()
      );
      if (!exists) {
        await saveRouteSegment(tripId, {
          id: `seg-preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          tripId,
          fromStop: preset.fromStop,
          toStop: preset.toStop,
          distanceKm: preset.distanceKm,
          estimatedHours: preset.estimatedHours,
          terrainType: preset.terrainType,
          roadCondition: preset.roadCondition,
          highestElevationMeters: preset.highestElevationMeters,
          passNames: preset.passNames,
          advisoryNotes: preset.advisoryNotes,
          orderIndex: i,
          createdAt: new Date().toISOString(),
        });
        segCount++;
      }
    }

    if (wpCount > 0 || segCount > 0) {
      notifyVaultChange();
      await loadData();
    }

    return { waypointsCount: wpCount, segmentsCount: segCount };
  }, [tripId, waypoints, routeSegments, loadData]);

  // Generate Navigation URL
  const getNavigationUrl = (latitude: number, longitude: number, title?: string) => {
    const query = title
      ? `${latitude},${longitude}+(${encodeURIComponent(title)})`
      : `${latitude},${longitude}`;
    // Standard web fallback that triggers Google Maps app on Android
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  const getGeoUri = (latitude: number, longitude: number, title?: string) => {
    const encodedTitle = encodeURIComponent(title || "Waypoint");
    return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedTitle})`;
  };

  return {
    waypoints,
    routeSegments,
    stats,
    isLoading,
    error,
    addWaypoint,
    updateWaypoint: updateWp,
    removeWaypoint: removeWp,
    addRouteSegment,
    updateRouteSegment: updateSeg,
    removeRouteSegment: removeSeg,
    seedMountainPresets,
    getNavigationUrl,
    getGeoUri,
    refresh: loadData,
  };
}
