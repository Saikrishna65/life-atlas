import type { Reminder } from "./types";
const tasks = [
  ["Check train tickets", "Travel"],
  ["Refill the travel first-aid pouch", "Travel"],
  ["Review the weekly budget", "Finance"],
  ["Call home before departure", "Personal"],
  ["Back up the photo selection", "Memories"],
  ["Choose three priorities for Monday", "Planning"],
  ["Check local trail conditions", "Travel"],
  ["Read one chapter without my phone", "Personal"],
  ["Review recurring subscriptions", "Finance"],
  ["Finish the route sketch", "Planning"],
  ["Add captions to the travel journal", "Memories"],
  ["Pack the rain layer", "Travel"],
  ["Put a little aside for the next trip", "Finance"],
  ["Leave an hour unplanned", "Planning"],
  ["Send a thank-you note to the host", "Personal"],
  ["Save offline booking details", "Travel"],
];
export const reminders: Reminder[] = Array.from({ length: 4 }, (_, week) =>
  tasks.map(([title, category], i) => ({
    id: `reminder-${week * 16 + i + 1}`,
    title,
    date: new Date(Date.UTC(2026, 10, 13 + week * 7 + (i % 7)))
      .toISOString()
      .slice(0, 10),
    time: ["08:30", "12:00", "18:00", "20:30"][i % 4],
    category,
    completed: (week * 16 + i) % 5 === 0,
    ...(category === "Travel"
      ? { expeditionId: `exp-${((i + week) % 24) + 1}` }
      : {}),
  })),
).flat();
