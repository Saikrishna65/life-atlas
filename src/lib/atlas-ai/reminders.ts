export interface AtlasReminder {
  id: string;
  title: string;
  dueText?: string;
  completed: boolean;
  createdAt: string;
}

const STORAGE_KEY = "life_atlas_voice_reminders_v1";
const MAX_REMINDERS = 200;

function readAll(): AtlasReminder[] {
  if (typeof window === "undefined") return [];
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
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_REMINDERS)));
}

export function listReminders(includeCompleted = false): AtlasReminder[] {
  const all = readAll();
  return includeCompleted ? all : all.filter((r) => !r.completed);
}

export function createReminder(title: string, dueText?: string): AtlasReminder {
  const clean = title.trim().slice(0, 180);
  if (!clean) {
    throw new Error("Reminder title cannot be empty.");
  }
  const item: AtlasReminder = {
    id: crypto.randomUUID(),
    title: clean,
    dueText: dueText?.trim().slice(0, 80) || undefined,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.unshift(item);
  writeAll(all);
  return item;
}

export function completeReminder(id: string): AtlasReminder {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Reminder not found.");
  all[idx] = { ...all[idx], completed: true };
  writeAll(all);
  return all[idx];
}

export function deleteReminder(id: string): void {
  const all = readAll().filter((r) => r.id !== id);
  writeAll(all);
}
