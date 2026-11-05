import {
  BreadcrumbPoint,
  ExpeditionLeg,
  ExpeditionLegCategory,
  LiveExpeditionSession,
  ID,
} from "./types";

/**
 * Calculates geodesic distance between two GPS coordinates using the Haversine formula (WGS84 spherical approximation)
 * Returns distance in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Filters out jitter, multipath noise, and stationary drift:
 * - Rejects points with poor GPS accuracy (> 35 meters)
 * - Rejects points where displacement < 5 meters unless speed > 1 m/s (3.6 km/h)
 * - Rejects unrealistic teleportation speed spikes (> 220 km/h)
 */
export function shouldRecordPoint(
  prevPoint: BreadcrumbPoint | undefined,
  newPoint: BreadcrumbPoint
): boolean {
  if (newPoint.accuracy > 40) {
    return false;
  }
  if (!prevPoint) {
    return true;
  }

  const distMeters = haversineDistanceMeters(
    prevPoint.latitude,
    prevPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  const timeDeltaSec = Math.max(0.1, (newPoint.timestamp - prevPoint.timestamp) / 1000);
  const computedSpeedKmh = (distMeters / timeDeltaSec) * 3.6;

  // Filter impossible velocity spikes
  if (computedSpeedKmh > 220) {
    return false;
  }

  // Filter stationary jitter if phone is resting in pocket or table (< 4 meters)
  const isMoving = (newPoint.speed ?? 0) > 1.2 || computedSpeedKmh > 1.5;
  if (distMeters < 4 && !isMoving) {
    return false;
  }

  return true;
}

/**
 * Creates an empty idle expedition session for a trip
 */
export function createDefaultExpedition(tripId: ID): LiveExpeditionSession {
  return {
    tripId,
    status: "IDLE",
    totalDistanceKm: 0,
    totalDurationSeconds: 0,
    movingSeconds: 0,
    elevationGainMeters: 0,
    legs: [],
  };
}

/**
 * Initializes and starts a new expedition session or continues an existing one
 */
export function startExpedition(
  tripId: ID,
  legTitle = "Full Expedition",
  legCategory: ExpeditionLegCategory = "TREK"
): LiveExpeditionSession {
  const now = new Date().toISOString();
  const firstLegId = "leg_" + Math.random().toString(36).slice(2, 10);
  const firstLeg: ExpeditionLeg = {
    id: firstLegId,
    tripId,
    title: legTitle,
    category: legCategory,
    startedAt: now,
    status: "ACTIVE",
    distanceKm: 0,
    durationSeconds: 0,
    movingSeconds: 0,
    maxSpeedKmh: 0,
    avgSpeedKmh: 0,
    elevationGainMeters: 0,
    coordinates: [],
  };

  return {
    tripId,
    status: "ACTIVE",
    startedAt: now,
    totalDistanceKm: 0,
    totalDurationSeconds: 0,
    movingSeconds: 0,
    elevationGainMeters: 0,
    activeLegId: firstLegId,
    legs: [firstLeg],
  };
}

/**
 * Starts a new sub-track / leg (e.g. starting a specific trek or summit climb within the trip)
 */
export function startNewLeg(
  session: LiveExpeditionSession,
  title: string,
  category: ExpeditionLegCategory = "TREK"
): LiveExpeditionSession {
  const now = new Date().toISOString();
  const newLegId = "leg_" + Math.random().toString(36).slice(2, 10);

  // Mark current active leg as COMPLETED or PAUSED
  const updatedLegs = session.legs.map((leg) => {
    if (leg.id === session.activeLegId && leg.status === "ACTIVE") {
      return { ...leg, status: "COMPLETED" as const, endedAt: now };
    }
    return leg;
  });

  const newLeg: ExpeditionLeg = {
    id: newLegId,
    tripId: session.tripId,
    title,
    category,
    startedAt: now,
    status: "ACTIVE",
    distanceKm: 0,
    durationSeconds: 0,
    movingSeconds: 0,
    maxSpeedKmh: 0,
    avgSpeedKmh: 0,
    elevationGainMeters: 0,
    coordinates: [],
  };

  return {
    ...session,
    status: "ACTIVE",
    activeLegId: newLegId,
    legs: [...updatedLegs, newLeg],
  };
}

/**
 * Pauses the live tracking session
 */
export function pauseExpedition(session: LiveExpeditionSession): LiveExpeditionSession {
  const now = new Date().toISOString();
  const updatedLegs = session.legs.map((leg) => {
    if (leg.id === session.activeLegId && leg.status === "ACTIVE") {
      return { ...leg, status: "PAUSED" as const };
    }
    return leg;
  });

  return {
    ...session,
    status: "PAUSED",
    currentSpeedKmh: 0,
    legs: updatedLegs,
  };
}

/**
 * Resumes tracking from paused state
 */
export function resumeExpedition(session: LiveExpeditionSession): LiveExpeditionSession {
  const updatedLegs = session.legs.map((leg) => {
    if (leg.id === session.activeLegId && leg.status === "PAUSED") {
      return { ...leg, status: "ACTIVE" as const };
    }
    return leg;
  });

  return {
    ...session,
    status: "ACTIVE",
    legs: updatedLegs,
  };
}

/**
 * Ends and finalizes the expedition
 */
export function endExpedition(session: LiveExpeditionSession): LiveExpeditionSession {
  const now = new Date().toISOString();
  const updatedLegs = session.legs.map((leg) => {
    if (leg.status === "ACTIVE" || leg.status === "PAUSED") {
      return { ...leg, status: "COMPLETED" as const, endedAt: now };
    }
    return leg;
  });

  return {
    ...session,
    status: "COMPLETED",
    endedAt: now,
    activeLegId: undefined,
    currentSpeedKmh: 0,
    legs: updatedLegs,
  };
}

/**
 * Adds a new verified GPS breadcrumb point to the active leg and updates master stats
 */
export function addBreadcrumbToExpedition(
  session: LiveExpeditionSession,
  point: BreadcrumbPoint
): LiveExpeditionSession {
  if (session.status !== "ACTIVE" || !session.activeLegId) {
    return session;
  }

  const activeLegIndex = session.legs.findIndex((l) => l.id === session.activeLegId);
  if (activeLegIndex < 0) {
    return session;
  }

  const currentLeg = session.legs[activeLegIndex];
  const lastPoint = currentLeg.coordinates[currentLeg.coordinates.length - 1];

  let addedDistanceKm = 0;
  let addedElevationGainMeters = 0;

  if (lastPoint) {
    const distMeters = haversineDistanceMeters(
      lastPoint.latitude,
      lastPoint.longitude,
      point.latitude,
      point.longitude
    );
    addedDistanceKm = distMeters / 1000;

    if (
      point.altitude != null &&
      lastPoint.altitude != null &&
      point.altitude > lastPoint.altitude
    ) {
      const diff = point.altitude - lastPoint.altitude;
      if (diff > 1.0 && diff < 2000) {
        addedElevationGainMeters = diff;
      }
    }
  }

  const speedKmh = point.speed != null && point.speed >= 0 ? point.speed * 3.6 : 0;
  const isMoving = speedKmh > 1.0;

  // Leg stat updates
  const updatedCoords = [...currentLeg.coordinates, point];
  const legDistanceKm = currentLeg.distanceKm + addedDistanceKm;
  const legElevationGain = currentLeg.elevationGainMeters + addedElevationGainMeters;
  const legMaxSpeed = Math.max(currentLeg.maxSpeedKmh, speedKmh);
  const legMaxElev =
    point.altitude != null
      ? Math.max(currentLeg.maxElevationMeters ?? point.altitude, point.altitude)
      : currentLeg.maxElevationMeters;
  const legMinElev =
    point.altitude != null
      ? Math.min(currentLeg.minElevationMeters ?? point.altitude, point.altitude)
      : currentLeg.minElevationMeters;

  const updatedLeg: ExpeditionLeg = {
    ...currentLeg,
    distanceKm: Number(legDistanceKm.toFixed(3)),
    elevationGainMeters: Math.round(legElevationGain),
    maxSpeedKmh: Math.round(legMaxSpeed),
    maxElevationMeters: legMaxElev ? Math.round(legMaxElev) : undefined,
    minElevationMeters: legMinElev ? Math.round(legMinElev) : undefined,
    startElevationMeters: currentLeg.startElevationMeters ?? (point.altitude ? Math.round(point.altitude) : undefined),
    movingSeconds: isMoving ? currentLeg.movingSeconds + 3 : currentLeg.movingSeconds,
    coordinates: updatedCoords,
  };

  const updatedLegs = [...session.legs];
  updatedLegs[activeLegIndex] = updatedLeg;

  // Master session stats
  const totalDistance = Number((session.totalDistanceKm + addedDistanceKm).toFixed(3));
  const totalElevationGain = Math.round(session.elevationGainMeters + addedElevationGainMeters);
  const maxSessionElev =
    point.altitude != null
      ? Math.max(session.maxElevationMeters ?? point.altitude, point.altitude)
      : session.maxElevationMeters;

  return {
    ...session,
    totalDistanceKm: totalDistance,
    elevationGainMeters: totalElevationGain,
    maxElevationMeters: maxSessionElev ? Math.round(maxSessionElev) : undefined,
    currentSpeedKmh: Math.round(speedKmh),
    currentElevationMeters: point.altitude ? Math.round(point.altitude) : undefined,
    currentLocation: point,
    legs: updatedLegs,
  };
}

/**
 * Formats duration in seconds to HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Converts live expedition session into standard GeoJSON FeatureCollection
 */
export function exportExpeditionToGeoJson(session: LiveExpeditionSession): object {
  const features = session.legs.map((leg) => ({
    type: "Feature",
    properties: {
      legId: leg.id,
      title: leg.title,
      category: leg.category,
      distanceKm: leg.distanceKm,
      elevationGainMeters: leg.elevationGainMeters,
      startedAt: leg.startedAt,
      endedAt: leg.endedAt,
    },
    geometry: {
      type: "LineString",
      coordinates: leg.coordinates.map((pt) => [
        pt.longitude,
        pt.latitude,
        pt.altitude ?? 0,
      ]),
    },
  }));

  return {
    type: "FeatureCollection",
    properties: {
      tripId: session.tripId,
      totalDistanceKm: session.totalDistanceKm,
      elevationGainMeters: session.elevationGainMeters,
      maxElevationMeters: session.maxElevationMeters,
    },
    features,
  };
}
