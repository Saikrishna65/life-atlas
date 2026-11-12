import { memories } from "./memories";
import { reminders } from "./reminders";
import { transactions } from "./finance";
import type { Activity } from "./types";
export const activities: Activity[] = Array.from({ length: 108 }, (_, i) => {
  const kind = i % 3;
  const record =
    kind === 0
      ? memories[Math.floor(i / 3)]
      : kind === 1
        ? reminders[Math.floor(i / 3)]
        : transactions[Math.floor(i / 3)];
  return {
    id: `activity-${i + 1}`,
    date: record.date,
    module: ["Memories", "Planning", "Finance"][kind],
    title:
      kind === 0
        ? `Filed a sample moment: ${memories[Math.floor(i / 3)].title}`
        : kind === 1
          ? `Planned: ${reminders[Math.floor(i / 3)].title}`
          : `Recorded: ${transactions[Math.floor(i / 3)].description}`,
    recordId: record.id,
  };
});
