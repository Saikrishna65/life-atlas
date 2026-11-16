package com.lifeatlas.app.wakeword

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OvernightTestManagerTest {

    @Test
    fun computeBatteryStats_calculatesDrainAndHourlyRateOverEightHours() {
        val (drainPct, drainPerHour) = OvernightTestManager.computeBatteryStats(
            startPct = 92,
            currentPct = 80,
            isChargingStart = false,
            isChargingEnd = false,
            durationMs = 8 * 3_600_000L
        )
        assertEquals(12, drainPct)
        assertEquals(1.5, drainPerHour, 0.001)
    }

    @Test
    fun computeBatteryStats_returnsZeroWhenChargingOrShortWindow() {
        val (chargingDrain, chargingRate) = OvernightTestManager.computeBatteryStats(
            startPct = 50,
            currentPct = 48,
            isChargingStart = true,
            isChargingEnd = false,
            durationMs = 4 * 3_600_000L
        )
        assertEquals(0, chargingDrain)
        assertEquals(0.0, chargingRate, 0.0001)

        val (shortDrain, shortRate) = OvernightTestManager.computeBatteryStats(
            startPct = 80,
            currentPct = 79,
            isChargingStart = false,
            isChargingEnd = false,
            durationMs = 60_000L // 1 minute (< 0.05h)
        )
        assertEquals(1, shortDrain)
        assertEquals(0.0, shortRate, 0.0001)
    }

    @Test
    fun findMonitoringGaps_flagsGapsExceedingTwentyFiveMinutes() {
        val elapsed = listOf(
            0L,
            15 * 60_000L,
            45 * 60_000L, // 30-min gap (> 25 min)
            60 * 60_000L
        )
        val wall = listOf(
            "2026-11-16T22:00:00Z",
            "2026-11-16T22:15:00Z",
            "2026-11-16T22:45:00Z",
            "2026-11-16T23:00:00Z"
        )
        val gaps = OvernightTestManager.findMonitoringGaps(elapsed, wall)
        assertEquals(1, gaps.size)
        assertEquals(30.0, gaps[0].gapMinutes, 0.01)
        assertEquals("2026-11-16T22:15:00Z", gaps[0].startAt)
        assertEquals("2026-11-16T22:45:00Z", gaps[0].endAt)
    }

    @Test
    fun clampTickDelta_acceptsRealisticTicksAndRejectsJumpsOrNegatives() {
        assertEquals(1000L, OvernightTestManager.clampTickDelta(5000L, 4000L))
        assertEquals(0L, OvernightTestManager.clampTickDelta(4000L, 4000L))
        assertEquals(0L, OvernightTestManager.clampTickDelta(3000L, 4000L))
        assertEquals(0L, OvernightTestManager.clampTickDelta(15000L, 4000L))
        assertTrue(OvernightTestManager.clampTickDelta(6000L, 4000L) == 2000L)
    }
}
