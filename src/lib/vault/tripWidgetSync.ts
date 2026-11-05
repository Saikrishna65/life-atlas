import { Capacitor, registerPlugin } from "@capacitor/core";
import { TripRecord } from "./types";
import { getAllTrips, getLiveExpedition, isIndexedDBAvailable } from "./storage";

export interface TripWidgetData {
  tripId: string;
  title: string;
  status: "ACTIVE" | "PLANNING" | "COMPLETED" | "IDLE";
  statusLabel?: string;
  subtitle?: string;
  metric1Label?: string;
  metric1Value?: string;
  metric2Label?: string;
  metric2Value?: string;
  note?: string;
  targetRoute?: string;
}

interface ExpeditionPluginWithWidget {
  updateTripWidget(options: TripWidgetData): Promise<{ success: boolean }>;
}

export function syncTripWidget(data: TripWidgetData): void {
  if (typeof window === "undefined") return;
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("ExpeditionTracking")) {
      const plugin = registerPlugin<ExpeditionPluginWithWidget>("ExpeditionTracking");
      void plugin.updateTripWidget(data).catch(() => {});
    }
  } catch {
    // Non-native fallback
  }
}

/**
 * Derives the optimal home screen widget data from local Trip Vault records
 * and broadcasts it to the native Android home screen widget.
 */
export async function syncActiveTripToWidget(preferredTripId?: string): Promise<TripWidgetData | null> {
  if (!isIndexedDBAvailable()) return null;

  try {
    const allTrips = await getAllTrips();
    if (!allTrips || allTrips.length === 0) {
      const idleData: TripWidgetData = {
        tripId: "",
        title: "Atlas Trip Vault",
        status: "IDLE",
        statusLabel: "NO TRIPS",
        subtitle: "Private Offline Expeditions",
        metric1Label: "TRIPS",
        metric1Value: "0",
        metric2Label: "VAULT",
        metric2Value: "Ready",
        note: "Plan your next journey in Trip Vault",
        targetRoute: "/secret/vault",
      };
      syncTripWidget(idleData);
      return idleData;
    }

    // 1. Check for Active Trip
    let targetTrip: TripRecord | undefined;
    if (preferredTripId) {
      targetTrip = allTrips.find((t) => t.id === preferredTripId);
    }
    if (!targetTrip || targetTrip.status !== "ACTIVE") {
      targetTrip = allTrips.find((t) => t.status === "ACTIVE") || targetTrip;
    }

    if (targetTrip && targetTrip.status === "ACTIVE") {
      const session = await getLiveExpedition(targetTrip.id);
      const totalKm = session?.totalDistanceKm || 0;
      const activeLeg = session?.legs?.find((l) => l.id === session.activeLegId) ||
        (session?.legs && session.legs.length > 0 ? session.legs[session.legs.length - 1] : null);

      const subtitle = activeLeg?.title || targetTrip.destination || "Active Expedition";

      let altStr = "--";
      if (session?.currentElevationMeters != null && session.currentElevationMeters > 0) {
        altStr = `${Math.round(session.currentElevationMeters).toLocaleString()} m`;
      } else if (session?.legs) {
        for (let i = session.legs.length - 1; i >= 0; i--) {
          const crumbs = session.legs[i]?.coordinates;
          if (crumbs && crumbs.length > 0) {
            const last = crumbs[crumbs.length - 1];
            if (last.altitude != null && last.altitude > 0) {
              altStr = `${Math.round(last.altitude).toLocaleString()} m`;
              break;
            }
          }
        }
      }

      const activeData: TripWidgetData = {
        tripId: targetTrip.id,
        title: targetTrip.title,
        status: "ACTIVE",
        statusLabel: "ON THE ROAD",
        subtitle,
        metric1Label: "DISTANCE",
        metric1Value: `${totalKm.toFixed(1)} km`,
        metric2Label: "ALTITUDE",
        metric2Value: altStr,
        note: targetTrip.notes || `📍 Next: ${targetTrip.destination}`,
        targetRoute: `/secret/vault/${targetTrip.id}/tracking`,
      };
      syncTripWidget(activeData);
      return activeData;
    }

    // 2. Look for upcoming trip (status PLANNING or next departure)
    const upcomingTrips = allTrips
      .filter((t) => t.status === "PLANNING" || t.status === "ACTIVE")
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));

    const upcoming = upcomingTrips[0] || allTrips[0];

    const todayStr = new Date().toISOString().slice(0, 10);
    const startStr = upcoming.startDate ? upcoming.startDate.slice(0, 10) : "";

    let statusLabel = "UPCOMING";
    if (startStr) {
      if (startStr === todayStr) {
        statusLabel = "STARTS TODAY";
      } else {
        const diffMs = new Date(startStr).getTime() - new Date(todayStr).getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          statusLabel = "STARTS TOMORROW";
        } else if (diffDays > 1 && diffDays <= 7) {
          statusLabel = `IN ${diffDays} DAYS`;
        }
      }
    }

    let dateStr = startStr;
    try {
      if (startStr) {
        const d = new Date(startStr);
        dateStr = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
      }
    } catch {
      dateStr = startStr;
    }

    let durationStr = "Expedition";
    if (upcoming.startDate && upcoming.endDate) {
      const s = new Date(upcoming.startDate).getTime();
      const e = new Date(upcoming.endDate).getTime();
      const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      if (days > 0) durationStr = `${days} Days`;
    }

    const planningData: TripWidgetData = {
      tripId: upcoming.id,
      title: upcoming.title,
      status: upcoming.status === "COMPLETED" ? "COMPLETED" : "PLANNING",
      statusLabel: upcoming.status === "COMPLETED" ? "COMPLETED" : statusLabel,
      subtitle: upcoming.destination || "Upcoming Expedition",
      metric1Label: "START DATE",
      metric1Value: dateStr || "--",
      metric2Label: "DURATION",
      metric2Value: durationStr,
      note: upcoming.notes || `📍 Base: ${upcoming.destination}`,
      targetRoute: `/secret/vault/${upcoming.id}`,
    };

    syncTripWidget(planningData);
    return planningData;
  } catch (err) {
    console.error("Failed to sync trip to widget:", err);
    return null;
  }
}
