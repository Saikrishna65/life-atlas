export interface AtlasReminder {
  id: string;
  title: string;
  dueText?: string;
  triggerAtIso?: string;
  tripId?: string;
  completed: boolean;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY = "life_atlas_voice_reminders_v1";
const MAX_REMINDERS = 200;
let memoryFallback: AtlasReminder[] = [];

function readAll(): AtlasReminder[] {
  if (typeof window === "undefined") return [...memoryFallback];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AtlasReminder =>
        Boolean(item && typeof item.id === "string" && typeof item.title === "string")
    );
  } catch {
    return [];
  }
}

function writeAll(items: AtlasReminder[]) {
  const bounded = items.slice(0, MAX_REMINDERS);
  if (typeof window === "undefined") {
    memoryFallback = [...bounded];
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
}

export function clearRemindersForTest(): void {
  memoryFallback = [];
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function parseNaturalDueDate(
  phrase?: string,
  referenceTripStartIso?: string,
  now = new Date()
): { dueText: string; triggerAtIso: string } | null {
  const lower = (phrase ?? "").toLowerCase().trim();
  if (!lower) return null;

  if (
    (lower.includes("night before") || lower.includes("day before") || lower.includes("evening before")) &&
    referenceTripStartIso
  ) {
    const startMs = Date.parse(referenceTripStartIso);
    if (Number.isFinite(startMs)) {
      const target = new Date(startMs - 24 * 60 * 60 * 1000);
      target.setHours(lower.includes("morning") ? 9 : 20, 0, 0, 0);
      return {
        dueText: lower.includes("morning") ? "Morning before trip (9:00 AM)" : "Night before trip (8:00 PM)",
        triggerAtIso: target.toISOString(),
      };
    }
  }

  const inMinutes = lower.match(/\bin\s+(\d+)\s+minute/);
  if (inMinutes) {
    const d = new Date(now.getTime() + Number(inMinutes[1]) * 60_000);
    return { dueText: `In ${inMinutes[1]} min`, triggerAtIso: d.toISOString() };
  }

  const inHours = lower.match(/\bin\s+(\d+)\s+hour/);
  if (inHours) {
    const d = new Date(now.getTime() + Number(inHours[1]) * 3_600_000);
    return { dueText: `In ${inHours[1]} hr`, triggerAtIso: d.toISOString() };
  }

  if (lower.includes("tonight")) {
    const d = new Date(now);
    d.setHours(20, 0, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return { dueText: "Tonight at 8:00 PM", triggerAtIso: d.toISOString() };
  }

  if (lower.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    if (lower.includes("evening") || lower.includes("night")) d.setHours(19, 0, 0, 0);
    else if (lower.includes("afternoon")) d.setHours(14, 0, 0, 0);
    else d.setHours(9, 0, 0, 0);
    return {
      dueText: `Tomorrow (${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`,
      triggerAtIso: d.toISOString(),
    };
  }

  if (lower.includes("this weekend") || lower.includes("saturday")) {
    const d = new Date(now);
    const diff = (6 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(9, 0, 0, 0);
    return { dueText: "Saturday at 9:00 AM", triggerAtIso: d.toISOString() };
  }

  return null;
}

export function listReminders(includeCompleted = false): AtlasReminder[] {
  const all = readAll();
  return includeCompleted ? all : all.filter((r) => !r.completed);
}

export function createReminder(
  title: string,
  dueText?: string,
  options?: { triggerAtIso?: string; tripId?: string }
): AtlasReminder {
  const clean = title.trim().slice(0, 180);
  if (!clean) {
    throw new Error("Reminder title cannot be empty.");
  }
  const nowIso = new Date().toISOString();
  const item: AtlasReminder = {
    id: crypto.randomUUID(),
    title: clean,
    dueText: dueText?.trim().slice(0, 80) || undefined,
    triggerAtIso: options?.triggerAtIso,
    tripId: options?.tripId,
    completed: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const all = readAll();
  all.unshift(item);
  writeAll(all);
  return item;
}

export function updateReminder(
  id: string,
  patch: Partial<Pick<AtlasReminder, "title" | "dueText" | "triggerAtIso" | "completed">>
): AtlasReminder {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Reminder not found.");
  const nextTitle = patch.title !== undefined ? patch.title.trim().slice(0, 180) : all[idx].title;
  if (!nextTitle) throw new Error("Reminder title cannot be empty.");
  all[idx] = {
    ...all[idx],
    ...patch,
    title: nextTitle,
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  return all[idx];
}

export function completeReminder(id: string): AtlasReminder {
  return updateReminder(id, { completed: true });
}

export function deleteReminder(id: string): AtlasReminder | null {
  const all = readAll();
  const target = all.find((r) => r.id === id) ?? null;
  if (!target) return null;
  writeAll(all.filter((r) => r.id !== id));
  return target;
}

export function restoreReminder(snapshot: AtlasReminder): void {
  const all = readAll().filter((r) => r.id !== snapshot.id);
  all.unshift(snapshot);
  writeAll(all);
}

export function findReminderByQuery(query: string): AtlasReminder | null {
  const lower = query.trim().toLowerCase();
  if (!lower) return null;
  return (
    listReminders(false).find(
      (r) => r.title.toLowerCase().includes(lower) || r.id === query
    ) ?? null
  );
}
