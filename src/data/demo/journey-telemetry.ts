/** Fictional telemetry for public previews, never measured trips or geographic facts.
 * Fields: distance km, highest recorded sample altitude m, ascent m, moving hours,
 * maximum speed km/h. Elapsed time spans the example itinerary and includes stops.
 */
const seeds: [number, number, number, number, number][] = [
  [86.4, 3980, 1420, 14.4, 46],
  [934, 420, 560, 25.5, 88],
  [1028, 1840, 2150, 32, 76],
  [1152, 610, 740, 29, 94],
  [142, 2860, 1380, 18.2, 51],
  [76, 2240, 910, 15.5, 42],
  [108, 2460, 1180, 17.6, 48],
  [518, 4420, 2890, 34.5, 57],
  [164, 4120, 1270, 22.1, 54],
  [82, 1760, 390, 14.8, 41],
  [1286, 720, 1010, 33.6, 96],
  [64, 540, 420, 17.2, 38],
  [612, 1760, 1920, 24.4, 78],
  [694, 110, 360, 23.8, 82],
  [638, 460, 680, 21.5, 182],
  [246, 1120, 1340, 19.3, 118],
  [58, 310, 630, 16.7, 43],
  [218, 1240, 1710, 23.2, 58],
  [426, 2940, 2650, 27.4, 136],
  [762, 980, 1360, 31.6, 88],
  [44, 185, 720, 14.1, 36],
  [132, 1420, 840, 18.6, 63],
  [354, 740, 1580, 25.7, 72],
  [846, 3160, 3240, 41.2, 68],
];

export function sampleJourneyTelemetry(id: string, durationDays: number) {
  const index = Number(id.replace("exp-", "")) - 1;
  const seed = seeds[index];
  if (!seed) return null;
  const [distanceKm, highestMeters, ascentMeters, movingHours, maxSpeedKmh] = seed;
  return {
    example: true as const, distanceKm, highestMeters, ascentMeters,
    movingSeconds: Math.round(movingHours * 3600),
    elapsedSeconds: Math.round((durationDays * 24 - 10) * 3600),
    maxSpeedKmh,
  };
}
