import { createReminder, deleteReminder, listReminders } from "./reminders";
import { deleteTrack, savePlaylist, saveTrack } from "../music/storage";
import type { MusicPlaylist, MusicTrack } from "../music/types";
import { deleteTripCascade, getTrip, saveItineraryDay, saveTrip } from "../vault/storage";
import type { ItineraryDayRecord, TripRecord } from "../vault/types";

export const DEMO_IDS = {
  trips: ["demo-trip-kasol", "demo-trip-gokarna"],
  tracks: ["demo-track-breeze", "demo-track-forest"],
  playlist: "demo-playlist-chill",
  account: "demo-acc-wallet",
  transactions: ["demo-txn-coffee", "demo-txn-rail", "demo-txn-book"],
};

function createToneWavBlob(freqHz: number, durationSec = 2.0): Blob {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, i / 800, (numSamples - i) / 800);
    const sample = Math.sin(2 * Math.PI * freqHz * t) * 0.22 * env;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function isoDateOffset(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function seedAtlasDemoData(): Promise<{
  tripsSeeded: number;
  tracksSeeded: number;
  financeSeeded: boolean;
  remindersSeeded: number;
}> {
  const nowIso = new Date().toISOString();

  // 1. Seed Atlas Trips (2 upcoming trips + itinerary days)
  const kasolStart = isoDateOffset(5);
  const kasolEnd = isoDateOffset(8);
  const kasolTrip: TripRecord = {
    id: "demo-trip-kasol",
    title: "Kasol Weekend Escape",
    subtitle: "Peaceful Parvati Valley stay",
    destination: "Kasol, Himachal",
    startDate: kasolStart,
    endDate: kasolEnd,
    status: "PLANNING",
    travelStyle: "BACKPACKING",
    budgetTotal: 8000,
    currency: "INR",
    notes: "Pack warm fleece, power bank, and offline trail map.",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const gokarnaStart = isoDateOffset(20);
  const gokarnaEnd = isoDateOffset(23);
  const gokarnaTrip: TripRecord = {
    id: "demo-trip-gokarna",
    title: "Gokarna Beach Retreat",
    subtitle: "Quiet coastal coves",
    destination: "Gokarna, Karnataka",
    startDate: gokarnaStart,
    endDate: gokarnaEnd,
    status: "PLANNING",
    travelStyle: "BACKPACKING",
    budgetTotal: 12000,
    currency: "INR",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await saveTrip(kasolTrip);
  await saveTrip(gokarnaTrip);

  const kasolDays: ItineraryDayRecord[] = [
    {
      id: "demo-day-kasol-1",
      tripId: kasolTrip.id,
      dayIndex: 1,
      date: kasolStart,
      title: "Arrival by Parvati River",
      intensity: "RELAXED",
      activities: [
        { id: "a1", timeSlot: "AFTERNOON", title: "Riverside homestay check-in", status: "PLANNED" },
        { id: "a2", timeSlot: "EVENING", title: "Evening cafe walk", status: "PLANNED" },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "demo-day-kasol-2",
      tripId: kasolTrip.id,
      dayIndex: 2,
      date: isoDateOffset(6),
      title: "Chalal Forest Walk",
      intensity: "MODERATE",
      activities: [
        { id: "a3", timeSlot: "MORNING", title: "Pine trail walk to Chalal", status: "PLANNED" },
        { id: "a4", timeSlot: "AFTERNOON", title: "Riverside lunch", status: "PLANNED" },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "demo-day-kasol-3",
      tripId: kasolTrip.id,
      dayIndex: 3,
      date: isoDateOffset(7),
      title: "Tosh Village Excursion",
      intensity: "MODERATE",
      activities: [
        { id: "a5", timeSlot: "MORNING", title: "Mountain valley overlook", status: "PLANNED" },
        { id: "a6", timeSlot: "EVENING", title: "Return night coach", status: "PLANNED" },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
  for (const d of kasolDays) await saveItineraryDay(d);

  await saveItineraryDay({
    id: "demo-day-gokarna-1",
    tripId: gokarnaTrip.id,
    dayIndex: 1,
    date: gokarnaStart,
    title: "Kudle & Om Beach Trail",
    intensity: "RELAXED",
    activities: [
      { id: "g1", timeSlot: "EVENING", title: "Sunset cliffs walk", status: "PLANNED" },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  // 2. Seed Atlas Music (2 offline playable WAV tracks + Chill playlist)
  const track1: MusicTrack = {
    id: "demo-track-breeze",
    title: "Mountain Breeze",
    artist: "Atlas Ambient",
    album: "Offline Demo",
    genre: "Ambient",
    duration: 2,
    format: "audio/wav",
    size: 64044,
    audioBlob: createToneWavBlob(432, 2.0),
    source: "DOWNLOADED",
    downloadStatus: "DOWNLOADED",
    isFavorite: true,
    playCount: 0,
    addedAt: Date.now(),
  };
  const track2: MusicTrack = {
    id: "demo-track-forest",
    title: "Parvati Rain",
    artist: "Atlas Ambient",
    album: "Offline Demo",
    genre: "Lo-Fi",
    duration: 2,
    format: "audio/wav",
    size: 64044,
    audioBlob: createToneWavBlob(528, 2.0),
    source: "DOWNLOADED",
    downloadStatus: "DOWNLOADED",
    isFavorite: false,
    playCount: 0,
    addedAt: Date.now() - 1000,
  };
  await saveTrack(track1);
  await saveTrack(track2);

  const playlist: MusicPlaylist = {
    id: DEMO_IDS.playlist,
    title: "Chill Demo Mix",
    description: "Offline demo tracks for Atlas voice tests",
    trackIds: [track1.id, track2.id],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await savePlaylist(playlist, false);

  // 3. Seed Atlas Finance (1 active account, default categories, 2 expenses)
  let financeSeeded = false;
  try {
    const { IndexedDBUnitOfWork } = await import("../finance/storage/indexeddb/unitOfWork");
    const { TransactionService } = await import("../finance/application/transactionService");
    const uow = new IndexedDBUnitOfWork();
    await uow.categories.seedDefaults();
    const existingAcc = await uow.accounts.getById(DEMO_IDS.account);
    if (!existingAcc) {
      await uow.accounts.save({
        id: DEMO_IDS.account,
        name: "Everyday Wallet",
        accountType: "bank",
        currency: "INR",
        openingBalancePaise: 1500000,
        openingBalanceDate: nowIso,
        currentBalancePaise: 1500000,
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso,
        version: 1,
      });
      const cats = await uow.categories.getAll();
      const foodCat = cats.find((c) => c.type === "expense" && /food|dining/i.test(c.name)) ?? cats.find((c) => c.type === "expense");
      const txSvc = new TransactionService(uow);
      await txSvc.recordTransaction({
        accountId: DEMO_IDS.account,
        amountPaise: 32000,
        description: "Demo Cafe Coffee & Snacks",
        direction: "outflow",
        categoryId: foodCat?.id,
        source: "manual",
        status: "posted",
      });
      await txSvc.recordTransaction({
        accountId: DEMO_IDS.account,
        amountPaise: 145000,
        description: "Demo Bus Booking",
        direction: "outflow",
        categoryId: foodCat?.id,
        source: "manual",
        status: "posted",
      });
    }
    financeSeeded = true;
  } catch {
    financeSeeded = false;
  }

  // 4. Seed 2 Reminders
  const existingRem = listReminders(true);
  let remindersSeeded = 0;
  if (!existingRem.some((r) => r.title === "Check power bank battery")) {
    createReminder("Check power bank battery", "Tonight");
    remindersSeeded++;
  }
  if (!existingRem.some((r) => r.title === "Confirm homestay check-in time")) {
    createReminder("Confirm homestay check-in time", "Tomorrow", { tripId: kasolTrip.id });
    remindersSeeded++;
  }

  return { tripsSeeded: 2, tracksSeeded: 2, financeSeeded, remindersSeeded };
}

export async function clearAtlasDemoData(): Promise<void> {
  for (const tripId of DEMO_IDS.trips) {
    if (await getTrip(tripId)) {
      await deleteTripCascade(tripId);
    }
  }
  for (const trackId of DEMO_IDS.tracks) {
    await deleteTrack(trackId, false).catch(() => {});
  }
  for (const rem of listReminders(true)) {
    if (
      rem.title === "Check power bank battery" ||
      rem.title === "Confirm homestay check-in time" ||
      rem.tripId === "demo-trip-kasol" ||
      rem.tripId === "demo-trip-gokarna"
    ) {
      deleteReminder(rem.id);
    }
  }
}
