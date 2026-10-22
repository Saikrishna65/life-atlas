"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ItineraryDayRecord,
  ItineraryActivity,
  ActivityStatus,
  TripRecord,
  ID,
} from "./types";
import {
  getItinerariesForTrip,
  saveItineraryDay,
  deleteItineraryDay,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export function useItinerary(tripId: string) {
  const [days, setDays] = useState<ItineraryDayRecord[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDays = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getItinerariesForTrip(tripId);
      setDays(data);
      if (data.length > 0 && !data.some((d) => d.dayIndex === selectedDayIndex)) {
        setSelectedDayIndex(data[0].dayIndex);
      }
    } catch (err) {
      console.error("Failed to load itinerary days:", err);
      setError("Unable to load itinerary schedule from local storage.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId, selectedDayIndex]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getItinerariesForTrip(tripId);
        if (mounted) {
          setDays(data);
          if (data.length > 0) {
            setSelectedDayIndex(data[0].dayIndex);
          }
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed loading initial itinerary:", err);
          setError("Failed to load itinerary schedule.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  // Selected Day record
  const currentDay = useMemo(() => {
    return days.find((d) => d.dayIndex === selectedDayIndex) || days[0] || null;
  }, [days, selectedDayIndex]);

  // Auto-generate days from trip date range if days list is empty
  const generateDaysFromTrip = useCallback(
    async (trip: TripRecord): Promise<ItineraryDayRecord[]> => {
      const start = new Date(trip.startDate);
      const end = trip.endDate ? new Date(trip.endDate) : new Date(start);
      const diffTime = Math.max(0, end.getTime() - start.getTime());
      const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

      const createdDays: ItineraryDayRecord[] = [];
      const now = new Date().toISOString();

      // Distribute destination stops across days if available
      const stops = trip.destinations || [];
      let stopCursor = 0;
      let nightsInCurrentStop = 0;

      for (let i = 1; i <= totalDays; i++) {
        const dayDate = new Date(start);
        dayDate.setDate(dayDate.getDate() + (i - 1));

        let stopName = trip.destination;
        if (stops.length > 0 && stopCursor < stops.length) {
          const currentStop = stops[stopCursor];
          stopName = currentStop.name;
          nightsInCurrentStop++;
          if (nightsInCurrentStop >= (currentStop.stayNights || 1) && stopCursor < stops.length - 1) {
            stopCursor++;
            nightsInCurrentStop = 0;
          }
        }

        const isNightDeparture = (trip.departureSlot === "NIGHT" || trip.departureSlot === "OVERNIGHT") && i === 1;
        const isMorningReturn = (trip.returnSlot === "MORNING" || trip.returnSlot === "EARLY_MORNING") && i === totalDays && totalDays > 1;

        let title = `Day ${i} - ${stopName} Exploration`;
        let description = `Planned transit & scheduled activities for Day ${i}.`;

        if (isNightDeparture) {
          title = `Day 1 - Night Travel & Overnight Transit (En Route to ${stopName})`;
          description = `Overnight travel leg. Rest en route; arrival at destination scheduled for Day 2 morning.`;
        } else if (isMorningReturn) {
          title = `Day ${i} - Morning Return Transit & Expedition Wrap-up`;
          description = `Morning departure from ${stopName} and return transit. Unpack and archive expedition.`;
        } else if (i === 1) {
          title = `Day 1 - Launch & Departure (${stopName})`;
          description = `Departure & transit to ${stopName}. Check-in and settle in.`;
        } else if (i === totalDays) {
          title = `Day ${i} - Final Leg & Return`;
          description = `Final exploration day, packing, and return journey.`;
        }

        const intensity = isNightDeparture || isMorningReturn || i === 1 || i === totalDays ? "CHALLENGING" : "MODERATE";

        const newDay: ItineraryDayRecord = {
          id: `day_${trip.id}_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          tripId: trip.id,
          dayIndex: i,
          date: dayDate.toISOString().split("T")[0],
          title,
          description,
          intensity,
          activities: [],
          createdAt: now,
          updatedAt: now,
        };

        const saved = await saveItineraryDay(newDay);
        createdDays.push(saved);
      }

      setDays(createdDays);
      setSelectedDayIndex(1);
      notifyVaultChange();
      return createdDays;
    },
    []
  );

  // Add a single custom day
  const addDay = useCallback(
    async (
      dayData: Omit<ItineraryDayRecord, "id" | "tripId" | "dayIndex" | "createdAt" | "updatedAt"> & {
        dayIndex?: number;
      }
    ): Promise<ItineraryDayRecord> => {
      const nextIndex = dayData.dayIndex || (days.length > 0 ? Math.max(...days.map((d) => d.dayIndex)) + 1 : 1);
      const now = new Date().toISOString();

      const newDay: ItineraryDayRecord = {
        ...dayData,
        id: `itn-${tripId}-d${nextIndex}-${Math.random().toString(36).slice(2, 6)}`,
        tripId,
        dayIndex: nextIndex,
        activities: dayData.activities || [],
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveItineraryDay(newDay);
      setDays((prev) => [...prev, saved].sort((a, b) => a.dayIndex - b.dayIndex));
      setSelectedDayIndex(nextIndex);
      notifyVaultChange();
      return saved;
    },
    [tripId, days]
  );

  // Update day header details (title, weather note, intensity, description)
  const updateDay = useCallback(async (day: ItineraryDayRecord): Promise<ItineraryDayRecord> => {
    const saved = await saveItineraryDay(day);
    setDays((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
    notifyVaultChange();
    return saved;
  }, []);

  // Delete an entire day
  const removeDay = useCallback(
    async (dayId: ID): Promise<boolean> => {
      const success = await deleteItineraryDay(dayId);
      if (success) {
        setDays((prev) => {
          const remaining = prev.filter((d) => d.id !== dayId);
          if (remaining.length > 0 && !remaining.some((d) => d.dayIndex === selectedDayIndex)) {
            setSelectedDayIndex(remaining[0].dayIndex);
          }
          return remaining;
        });
        notifyVaultChange();
      }
      return success;
    },
    [selectedDayIndex]
  );

  // Add an activity to a day
  const addActivity = useCallback(
    async (
      dayId: ID,
      activity: Omit<ItineraryActivity, "id"> & { id?: ID }
    ): Promise<ItineraryDayRecord> => {
      const targetDay = days.find((d) => d.id === dayId);
      if (!targetDay) throw new Error(`Day with ID '${dayId}' not found.`);

      const newActivity: ItineraryActivity = {
        ...activity,
        id: activity.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };

      const updatedDay: ItineraryDayRecord = {
        ...targetDay,
        activities: [...targetDay.activities, newActivity],
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveItineraryDay(updatedDay);
      setDays((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      notifyVaultChange();
      return saved;
    },
    [days]
  );

  // Update an existing activity
  const updateActivity = useCallback(
    async (dayId: ID, updatedActivity: ItineraryActivity): Promise<ItineraryDayRecord> => {
      const targetDay = days.find((d) => d.id === dayId);
      if (!targetDay) throw new Error(`Day with ID '${dayId}' not found.`);

      const updatedDay: ItineraryDayRecord = {
        ...targetDay,
        activities: targetDay.activities.map((a) =>
          a.id === updatedActivity.id ? updatedActivity : a
        ),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveItineraryDay(updatedDay);
      setDays((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      notifyVaultChange();
      return saved;
    },
    [days]
  );

  // Delete an activity
  const deleteActivity = useCallback(
    async (dayId: ID, activityId: ID): Promise<ItineraryDayRecord> => {
      const targetDay = days.find((d) => d.id === dayId);
      if (!targetDay) throw new Error(`Day with ID '${dayId}' not found.`);

      const updatedDay: ItineraryDayRecord = {
        ...targetDay,
        activities: targetDay.activities.filter((a) => a.id !== activityId),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveItineraryDay(updatedDay);
      setDays((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      notifyVaultChange();
      return saved;
    },
    [days]
  );

  // Toggle activity status (PLANNED -> IN_PROGRESS -> COMPLETED -> SKIPPED)
  const toggleActivityStatus = useCallback(
    async (dayId: ID, activityId: ID, newStatus: ActivityStatus): Promise<ItineraryDayRecord> => {
      const targetDay = days.find((d) => d.id === dayId);
      if (!targetDay) throw new Error(`Day with ID '${dayId}' not found.`);

      const updatedDay: ItineraryDayRecord = {
        ...targetDay,
        activities: targetDay.activities.map((a) =>
          a.id === activityId ? { ...a, status: newStatus } : a
        ),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveItineraryDay(updatedDay);
      setDays((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      notifyVaultChange();
      return saved;
    },
    [days]
  );

  // Completion metrics
  const stats = useMemo(() => {
    let totalActivities = 0;
    let completedActivities = 0;

    days.forEach((day) => {
      day.activities.forEach((act) => {
        totalActivities++;
        if (act.status === "COMPLETED") completedActivities++;
      });
    });

    const currentDayTotal = currentDay?.activities.length || 0;
    const currentDayCompleted =
      currentDay?.activities.filter((a) => a.status === "COMPLETED").length || 0;

    const currentDayPercentage =
      currentDayTotal > 0 ? Math.round((currentDayCompleted / currentDayTotal) * 100) : 0;

    const tripPercentage =
      totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

    return {
      totalActivities,
      completedActivities,
      tripPercentage,
      currentDayTotal,
      currentDayCompleted,
      currentDayPercentage,
    };
  }, [days, currentDay]);

  return {
    days,
    currentDay,
    selectedDayIndex,
    setSelectedDayIndex,
    isLoading,
    error,
    refreshDays: loadDays,
    generateDaysFromTrip,
    addDay,
    updateDay,
    removeDay,
    addActivity,
    updateActivity,
    deleteActivity,
    toggleActivityStatus,
    stats,
  };
}
