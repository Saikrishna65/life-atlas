"use client";
import { useCallback, useState } from "react";
// Only small UI choices; never datasets, media, credentials or persisted backups.
const choices = new Map<string, string>();
export function useSessionView(key: string, initial: string) {
  const [value, setValue] = useState(() =>
    typeof window === "undefined" ? initial : (choices.get(key) ?? initial),
  );
  const update = useCallback(
    (next: string) => {
      choices.delete(key);
      if (next.length <= 256) choices.set(key, next);
      if (choices.size > 32) choices.delete(choices.keys().next().value!);
      setValue(next);
    },
    [key],
  );
  return [value, update] as const;
}
