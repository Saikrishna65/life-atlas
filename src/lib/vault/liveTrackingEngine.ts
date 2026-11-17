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

/** GPS speeds enter this module in km/h. Thresholds reject fixes, never clamp a spike into a valid record. */
export const MAX_GPS_GAP_MS = 120_000;
export const speedLimit = (category: ExpeditionLegCategory = "OTHER") => ({ WALK:20, TREK:25, CYCLE:100, DRIVE:250, OTHER:400 })[category];
export function positionBreadcrumb(position: {timestamp:number;coords:Pick<GeolocationCoordinates,"latitude"|"longitude"|"accuracy"|"speed"|"altitude"|"altitudeAccuracy">}): BreadcrumbPoint {
  const c=position.coords;
  return { latitude:c.latitude, longitude:c.longitude, accuracy:c.accuracy,
    speed:Number.isFinite(c.speed) && c.speed !== null && c.speed >= 0 ? c.speed * 3.6 : null,
    altitude:c.altitude, altitudeAccuracy:c.altitudeAccuracy, timestamp:position.timestamp, qualityVersion:2 };
}
export function shouldRecordPoint(prevPoint: BreadcrumbPoint | undefined,newPoint: BreadcrumbPoint,category: ExpeditionLegCategory = "OTHER"): boolean {
  if (![newPoint.latitude,newPoint.longitude,newPoint.accuracy,newPoint.timestamp].every(Number.isFinite) ||
      Math.abs(newPoint.latitude)>90 || Math.abs(newPoint.longitude)>180 || newPoint.accuracy<0 || newPoint.accuracy>40 || newPoint.timestamp<=0) return false;
  if (!prevPoint) return true;
  const dt=newPoint.timestamp-prevPoint.timestamp;
  if(dt<=0)return false;
  if(dt>MAX_GPS_GAP_MS)return true; // Re-anchor, with a route gap; do not count an unknown journey.
  const distance=haversineDistanceMeters(prevPoint.latitude,prevPoint.longitude,newPoint.latitude,newPoint.longitude);
  if(distance/(dt/1000)*3.6>speedLimit(category))return false;
  return distance>=Math.max(3,Math.min(12,(prevPoint.accuracy+newPoint.accuracy)/4));
}
/** Accurate active time from a monotonic sequence of wall-clock observations, including delayed JS timers. */
export function advanceExpeditionClock(session:LiveExpeditionSession,now:number):LiveExpeditionSession {
  if(session.status!=="ACTIVE" || !Number.isFinite(now))return session;
  const seconds=session.lastClockAt ? Math.max(0,(now-session.lastClockAt)/1000) : 0;
  return {...session,lastClockAt:Math.max(now,session.lastClockAt??now),totalDurationSeconds:session.totalDurationSeconds+seconds,
    legs:session.legs.map(leg=>leg.id===session.activeLegId?{...leg,durationSeconds:leg.durationSeconds+seconds}:leg)};
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
    qualityVersion: 2,
    lastClockAt: Date.parse(now),
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
  session = advanceExpeditionClock(session, Date.now());
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
    lastClockAt: Date.now(),
    activeLegId: newLegId,
    legs: [...updatedLegs, newLeg],
  };
}

/**
 * Pauses the live tracking session
 */
export function pauseExpedition(session: LiveExpeditionSession): LiveExpeditionSession {
  session = advanceExpeditionClock(session, Date.now());
  const updatedLegs = session.legs.map((leg) => {
    if (leg.id === session.activeLegId && leg.status === "ACTIVE") {
      return { ...leg, status: "PAUSED" as const, nextPointStartsSegment:true,segmentStartedAt:Date.now() };
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
      return { ...leg, status: "ACTIVE" as const, segmentStartedAt:Date.now() };
    }
    return leg;
  });

  return {
    ...session,
    status: "ACTIVE",
    lastClockAt: Date.now(),
    legs: updatedLegs,
  };
}

/**
 * Ends and finalizes the expedition
 */
export function endExpedition(session: LiveExpeditionSession): LiveExpeditionSession {
  session = advanceExpeditionClock(session, Date.now());
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
  const lastPoint = currentLeg.coordinates.at(-1);
  if(!shouldRecordPoint(currentLeg.nextPointStartsSegment ? undefined : lastPoint,point,currentLeg.category))return session;
  const segmentStart=!lastPoint || !!currentLeg.nextPointStartsSegment || point.timestamp-lastPoint.timestamp>MAX_GPS_GAP_MS;
  // A resumed segment must still be newer than the old recording.
  if(lastPoint && point.timestamp<=lastPoint.timestamp)return session;
  const dt=!segmentStart && lastPoint ? (point.timestamp-lastPoint.timestamp)/1000 : 0;
  const meters=dt && lastPoint ? haversineDistanceMeters(lastPoint.latitude,lastPoint.longitude,point.latitude,point.longitude):0;
  const computed=dt?meters/dt*3.6:0;
  const reported=point.speed;
  const speed=dt && reported!==null && Number.isFinite(reported) && reported>=0 && reported<=speedLimit(currentLeg.category) && Math.abs(reported-computed)<=Math.max(8,computed*.6) ? reported : computed;
  const goodAltitude=point.altitude!==null && Number.isFinite(point.altitude) && point.altitude>=-500 && point.altitude<=9000 &&
    point.altitudeAccuracy!=null && Number.isFinite(point.altitudeAccuracy) && point.altitudeAccuracy>=0 && point.altitudeAccuracy<=25;
  const previousAltitude=!segmentStart ? currentLeg.filteredAltitude??lastPoint?.altitude : null;
  const plausibleAltitude=goodAltitude && (previousAltitude==null || Math.abs(point.altitude!-previousAltitude)<=Math.max(15,(currentLeg.altitudeTimestamp ? Math.max(0,(point.timestamp-currentLeg.altitudeTimestamp)/1000) : dt||1)*3 + (point.altitudeAccuracy??0)));
  const altitude=plausibleAltitude ? previousAltitude==null ? point.altitude! : dt>=30?point.altitude!:previousAltitude*.65+point.altitude!*.35 : null;
  const recorded:BreadcrumbPoint={...point,speed,altitude,segmentStart,qualityVersion:2};
  let anchor=segmentStart ? altitude??undefined : currentLeg.elevationAnchor??previousAltitude??altitude??undefined;
  let ascent=0;
  if(altitude!==null && anchor!==undefined && Math.abs(altitude-anchor)>=Math.max(3,point.altitudeAccuracy??0)) {
    ascent=Math.max(0,altitude-anchor);anchor=altitude;
  }
  const distanceKm=currentLeg.distanceKm+meters/1000;
  const moving=dt && computed>1 ? dt : 0;
  const maxElev=altitude===null?currentLeg.maxElevationMeters:Math.max(currentLeg.maxElevationMeters??altitude,altitude);
  const updatedLeg:ExpeditionLeg={...currentLeg,nextPointStartsSegment:false,elevationAnchor:anchor,
    filteredAltitude:altitude??(segmentStart?undefined:currentLeg.filteredAltitude),altitudeTimestamp:altitude!==null?point.timestamp:currentLeg.altitudeTimestamp,
    distanceKm, movingSeconds:currentLeg.movingSeconds+moving,
    elevationGainMeters:currentLeg.elevationGainMeters+ascent,
    maxSpeedKmh:Math.max(currentLeg.maxSpeedKmh,speed),
    avgSpeedKmh:(currentLeg.movingSeconds+moving)>0?distanceKm/((currentLeg.movingSeconds+moving)/3600):0,
    maxElevationMeters:maxElev,
    minElevationMeters:altitude===null?currentLeg.minElevationMeters:Math.min(currentLeg.minElevationMeters??altitude,altitude),
    startElevationMeters:currentLeg.startElevationMeters??altitude??undefined,
    coordinates:[...currentLeg.coordinates,recorded]};
  const legs=[...session.legs];legs[activeLegIndex]=updatedLeg;
  return {...session,qualityVersion:2,totalDistanceKm:session.totalDistanceKm+meters/1000,
    movingSeconds:session.movingSeconds+moving,elevationGainMeters:session.elevationGainMeters+ascent,
    maxElevationMeters:altitude===null?session.maxElevationMeters:Math.max(session.maxElevationMeters??altitude,altitude),
    currentSpeedKmh:speed,currentElevationMeters:altitude??undefined,currentLocation:recorded,legs};
}

/**
 * Formats duration in seconds to HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  seconds=Math.max(0,Math.floor(seconds));
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
  const features = session.legs.flatMap((leg) => {
    const segments: BreadcrumbPoint[][]=[];
    for(const point of leg.coordinates){if(point.segmentStart || !segments.length)segments.push([]);segments.at(-1)!.push(point);}
    return segments.filter(points=>points.length>1).map(points => ({
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
      coordinates: points.map((pt) => [
        pt.longitude,
        pt.latitude,
        pt.altitude ?? 0,
      ]),
    },
  }));
  });

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
