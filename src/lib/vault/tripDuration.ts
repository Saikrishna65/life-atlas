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

/**
 * Parses a date string (YYYY-MM-DD or ISO timestamp) into local midnight Date
 * avoiding timezone offset shifts.
 */
export function parseCalendarDate(dateStr?: string): Date {
  if (!dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
  const parts = clean.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Standard calculation for trip duration in calendar days and nights.
 * E.g., Nov 5 night departure to Nov 9 morning arrival is 5 calendar days, 4 nights.
 */
export function getTripDayCount(
  startDateStr?: string,
  endDateStr?: string
): { calendarDays: number; calendarNights: number; formatted: string } {
  if (!startDateStr) {
    return { calendarDays: 1, calendarNights: 0, formatted: "1 Day" };
  }
  const start = parseCalendarDate(startDateStr);
  const end = endDateStr ? parseCalendarDate(endDateStr) : parseCalendarDate(startDateStr);

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const calendarDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
  const calendarNights = Math.max(0, calendarDays - 1);
  const formatted =
    calendarNights > 0
      ? `${calendarDays} Days • ${calendarNights} ${calendarNights === 1 ? "Night" : "Nights"}`
      : `${calendarDays} Day`;

  return { calendarDays, calendarNights, formatted };
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

  const { calendarDays, calendarNights } = getTripDayCount(startDateStr, endDateStr);

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
  let depDesc = "night departure";
  if (departureSlot === "NIGHT" || departureSlot === "OVERNIGHT") depDesc = "night departure (overnight travel)";
  else if (departureSlot === "EVENING") depDesc = "evening transit";
  else if (departureSlot === "AFTERNOON") depDesc = "afternoon departure";
  else if (departureSlot === "MORNING") depDesc = "morning launch";

  let retDesc = "morning arrival";
  if (returnSlot === "EARLY_MORNING" || returnSlot === "MORNING") retDesc = "morning return";
  else if (returnSlot === "AFTERNOON") retDesc = "afternoon return";
  else if (returnSlot === "EVENING") retDesc = "evening return";
  else if (returnSlot === "NIGHT") retDesc = "late night return";

  const explanation = `${calendarDays} Days, ${calendarNights} Nights total. Departing ${depDesc} with ${retDesc} provides ${effectiveDays} dedicated destination days plus travel legs.`;

  return {
    calendarDays,
    calendarNights,
    effectiveDays,
    transitDaysCount,
    summaryTitle: `${calendarDays} Days (${calendarNights} Nights) • ${effectiveDays} Dest. Days`,
    badgeLabel: `${calendarDays} Days • ${calendarNights}N`,
    explanation,
  };
}
