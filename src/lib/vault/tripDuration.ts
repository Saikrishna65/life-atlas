import { DepartureTravelSlot, ReturnTravelSlot } from "./types";

export interface TripDurationBreakdown {
  calendarDays: number;
  calendarNights: number;
  effectiveDays: number;
  transitDaysCount: number;
  summaryTitle: string;
  badgeLabel: string;
  explanation: string;
}

export function computeTripDuration(
  startDateStr?: string,
  endDateStr?: string,
  departureSlot: DepartureTravelSlot = "NIGHT",
  returnSlot: ReturnTravelSlot = "MORNING",
  manualEffectiveDays?: number
): TripDurationBreakdown {
  if (!startDateStr) {
    return {
      calendarDays: 1,
      calendarNights: 0,
      effectiveDays: 1,
      transitDaysCount: 0,
      summaryTitle: "1 Day Journey",
      badgeLabel: "1 Day",
      explanation: "Single-day expedition",
    };
  }

  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);

  // Strip time for exact midnight-to-midnight day comparison
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const calendarDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
  const calendarNights = Math.max(0, calendarDays - 1);

  if (calendarDays === 1) {
    const isNightOnly = departureSlot === "NIGHT" || departureSlot === "OVERNIGHT";
    return {
      calendarDays: 1,
      calendarNights: 0,
      effectiveDays: manualEffectiveDays !== undefined ? manualEffectiveDays : isNightOnly ? 0.5 : 1,
      transitDaysCount: 0,
      summaryTitle: "1 Day Journey",
      badgeLabel: "1 Day",
      explanation: "Single calendar day exploration",
    };
  }

  // Calculate day contributions
  // Departure Day active score
  let departureActive = 1.0;
  if (departureSlot === "NIGHT" || departureSlot === "OVERNIGHT") {
    departureActive = 0.0; // En route overnight; no sightseeing day on departure date
  } else if (departureSlot === "EVENING") {
    departureActive = 0.5; // Half-day before departing
  } else if (departureSlot === "AFTERNOON") {
    departureActive = 0.5;
  } else {
    departureActive = 1.0; // Morning departure
  }

  // Return Day active score
  let returnActive = 1.0;
  if (returnSlot === "EARLY_MORNING" || returnSlot === "MORNING") {
    returnActive = 0.0; // Early/morning departure back; no exploration
  } else if (returnSlot === "AFTERNOON") {
    returnActive = 0.5; // Half-day exploration before flight/train
  } else {
    returnActive = 1.0; // Evening/Night return gives full day at destination
  }

  // Intermediate full destination days
  const intermediateDays = Math.max(0, calendarDays - 2);
  const calculatedEffective = intermediateDays + departureActive + returnActive;
  const effectiveDays =
    manualEffectiveDays !== undefined ? manualEffectiveDays : Math.max(0.5, calculatedEffective);

  const transitDaysCount = Math.max(0, calendarDays - Math.floor(effectiveDays));

  // Formulate friendly human-readable explanation
  let depDesc = "travel";
  if (departureSlot === "NIGHT" || departureSlot === "OVERNIGHT") depDesc = "night travel / overnight departure";
  else if (departureSlot === "EVENING") depDesc = "evening transit";
  else if (departureSlot === "MORNING") depDesc = "morning launch";

  let retDesc = "return";
  if (returnSlot === "EARLY_MORNING" || returnSlot === "MORNING") retDesc = "morning return";
  else if (returnSlot === "NIGHT") retDesc = "late night return";

  const explanation = `${
    departureSlot === "NIGHT" || departureSlot === "OVERNIGHT" ? "Departing night" : "Departing " + departureSlot.toLowerCase()
  } with ${
    returnSlot === "MORNING" || returnSlot === "EARLY_MORNING" ? "morning return" : returnSlot.toLowerCase() + " return"
  } yields ~${effectiveDays} active exploration days at your destination across a ${calendarDays}-day span.`;

  return {
    calendarDays,
    calendarNights,
    effectiveDays,
    transitDaysCount,
    summaryTitle: `${effectiveDays} Destination Days (${calendarDays} Calendar Days)`,
    badgeLabel: `${effectiveDays} Dest. Days`,
    explanation,
  };
}
