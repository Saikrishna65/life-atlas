"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Navigation, Mountain, Compass, MapPin, TrendingUp, Clock } from "lucide-react";
import { LiveExpeditionSession, WaypointRecord, BreadcrumbPoint } from "@/lib/vault/types";

// Dynamically import the map component with SSR disabled
const ExpeditionMapInner = dynamic(
  () => import("@/components/trip-vault/ExpeditionMapInner"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[380px] rounded-3xl bg-slate-900 flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
        <span className="font-mono uppercase tracking-wider text-[11px]">
          Loading Topographic Expedition Visualizer…
        </span>
      </div>
    ),
  }
);

interface PublicTripRouteMapProps {
  tripTitle: string;
  destination: string;
  totalDistanceKm?: number | null;
  elevationGainMeters?: number | null;
  maxElevationMeters?: number | null;
  routeData?: any;
  tripPlaces?: Array<{
    place: {
      id: string;
      name: string;
      latitude?: number | null;
      longitude?: number | null;
      description?: string | null;
      city?: string | null;
      region?: string | null;
    };
  }>;
}

export default function PublicTripRouteMap({
  tripTitle,
  destination,
  totalDistanceKm,
  elevationGainMeters,
  maxElevationMeters,
  routeData,
  tripPlaces = [],
}: PublicTripRouteMapProps) {
  // Check if we have real recorded GPS session data from the Trip Vault
  const hasRecordedSession =
    routeData &&
    Array.isArray(routeData.legs) &&
    routeData.legs.some((l: any) => l.coordinates && l.coordinates.length > 0);

  // If no recorded GPS legs, but tripPlaces with coordinates exist, synthesize an expedition session
  const session: LiveExpeditionSession | null = useMemo(() => {
    if (hasRecordedSession) {
      return routeData as LiveExpeditionSession;
    }

    // Filter places with valid latitude & longitude
    const validPlaces = tripPlaces
      .map((tp) => tp.place)
      .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number");

    if (validPlaces.length === 0) {
      return null;
    }

    const coordinates: BreadcrumbPoint[] = validPlaces.map((p) => ({
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      altitude: null,
      speed: null,
      accuracy: 10,
      timestamp: Date.now(),
    }));

    return {
      tripId: "public-trip",
      status: "COMPLETED" as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalDistanceKm: totalDistanceKm || 0,
      totalDurationSeconds: 0,
      movingSeconds: 0,
      elevationGainMeters: elevationGainMeters || 0,
      maxElevationMeters: maxElevationMeters || undefined,
      legs: [
        {
          id: "public-leg-1",
          tripId: "public-trip",
          title: `Route through ${destination}`,
          category: "TREK" as const,
          status: "COMPLETED" as const,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: 0,
          movingSeconds: 0,
          maxSpeedKmh: 0,
          avgSpeedKmh: 0,
          distanceKm: totalDistanceKm || 0,
          elevationGainMeters: elevationGainMeters || 0,
          coordinates,
        },
      ],
    };
  }, [hasRecordedSession, routeData, tripPlaces, totalDistanceKm, elevationGainMeters, maxElevationMeters, destination]);

  const waypoints: WaypointRecord[] = useMemo(() => {
    return tripPlaces
      .filter(
        (tp) =>
          typeof tp.place.latitude === "number" &&
          typeof tp.place.longitude === "number"
      )
      .map((tp, idx) => ({
        id: tp.place.id,
        tripId: "public-trip",
        title: tp.place.name,
        category: "VIEWPOINT",
        latitude: tp.place.latitude as number,
        longitude: tp.place.longitude as number,
        notes: tp.place.description || undefined,
        createdAt: new Date().toISOString(),
      }));
  }, [tripPlaces]);

  if (!session) {
    return null;
  }

  const displayDistance =
    totalDistanceKm || session.totalDistanceKm || (hasRecordedSession ? routeData.totalDistanceKm : null);
  const displayElevationGain =
    elevationGainMeters || session.elevationGainMeters || (hasRecordedSession ? routeData.elevationGainMeters : null);
  const displayMaxElevation =
    maxElevationMeters || session.maxElevationMeters || (hasRecordedSession ? routeData.maxElevationMeters : null);

  return (
    <section className="py-20 px-6 max-w-7xl mx-auto border-t border-muted/30">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono text-xs uppercase tracking-widest mb-3">
            <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
            <span>Interactive Expedition Map & Satellite Telemetry</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight">
            The Traced Route
          </h2>
          <p className="font-body text-sm text-muted-foreground max-w-2xl mt-2 leading-relaxed">
            Every road, mountain trail, and waypoint traveled during the expedition across{" "}
            <span className="text-foreground font-semibold">{destination}</span>.
          </p>
        </div>

        {/* Telemetry Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayDistance != null && Number(displayDistance) > 0 && (
            <div className="p-3.5 rounded-2xl bg-surface border border-muted shadow-xs">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-sky-500" />
                Distance
              </span>
              <strong className="text-xl font-bold font-mono text-foreground block mt-1">
                {Number(displayDistance).toFixed(1)}{" "}
                <small className="text-xs font-normal text-muted-foreground">km</small>
              </strong>
            </div>
          )}

          {displayElevationGain != null && Number(displayElevationGain) > 0 && (
            <div className="p-3.5 rounded-2xl bg-surface border border-muted shadow-xs">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                Total Ascent
              </span>
              <strong className="text-xl font-bold font-mono text-foreground block mt-1">
                +{Math.round(Number(displayElevationGain))}{" "}
                <small className="text-xs font-normal text-muted-foreground">m</small>
              </strong>
            </div>
          )}

          {displayMaxElevation != null && Number(displayMaxElevation) > 0 && (
            <div className="p-3.5 rounded-2xl bg-surface border border-muted shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5 text-indigo-400" />
                Peak Summit
              </span>
              <strong className="text-xl font-bold font-mono text-foreground block mt-1">
                {Math.round(Number(displayMaxElevation))}{" "}
                <small className="text-xs font-normal text-muted-foreground">m</small>
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Luxury Map Container */}
      <div className="w-full h-[400px] sm:h-[500px] md:h-[580px] rounded-3xl overflow-hidden border border-muted/50 shadow-2xl relative">
        <ExpeditionMapInner
          session={session}
          selectedLegId="ALL"
          waypoints={waypoints}
          defaultStyle="VOYAGER"
          interactive={true}
        />
      </div>

      {/* Checkpoints Legend */}
      {waypoints.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-muted/20 text-xs">
          <span className="font-mono text-muted-foreground text-[11px] uppercase tracking-wider mr-2">
            Expedition Waypoints:
          </span>
          {waypoints.map((wp, idx) => (
            <span
              key={wp.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-muted text-foreground text-[11px] font-medium"
            >
              <span className="w-4 h-4 rounded-full bg-sky-500/15 text-sky-500 font-bold text-[10px] grid place-items-center">
                {idx + 1}
              </span>
              <span>{wp.title}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
