import React, { useEffect, useState } from "react";
import {
  getEntries,
  flushStudioEntries,
  type StudioEntry,
} from "./studio-storage";
export default function SavedStudioEntries() {
  const [entries, setEntries] = useState<StudioEntry[]>([]);
  useEffect(() => {
    const refresh = () => {
      getEntries().then(setEntries).catch(console.error);
    };
    refresh();
    window.addEventListener("atlas-studio-change", refresh);
    return () => window.removeEventListener("atlas-studio-change", refresh);
  }, []);
  return (
    <details
      className="max-w-3xl mx-auto mt-8 space-y-4"
      aria-label="Previous studio entries"
    >
      <summary>Previous Studio entries ({entries.length})</summary>
      <button
        className="px-4 py-2 rounded-xl border border-muted"
        onClick={() => void flushStudioEntries()}
      >
        Retry publishing
      </button>
      {entries.length === 0 ? (
        <p>No entries yet. Your work will be saved offline here.</p>
      ) : (
        entries.map((e) => (
          <article
            key={e.id}
            className="p-4 rounded-xl border border-muted space-y-2"
          >
            <p className="text-xs text-muted-foreground">
              {e.section} · {new Date(e.createdAt).toLocaleDateString()} ·{" "}
              {e.syncedAt
                ? "Published online"
                : "Saved locally · publishing pending"}
            </p>
            {e.syncError && <p role="status">{e.syncError}</p>}
            <h3 className="font-display text-xl">
              {e.fields.title || e.fields.name || e.fields.caption || e.section}
            </h3>
            {Object.entries(e.fields)
              .filter(
                ([k, v]) =>
                  v && !["title", "name", "coverImage", "url"].includes(k),
              )
              .map(([k, v]) => (
                <p key={k}>
                  <span className="text-muted-foreground">{k}: </span>
                  {v}
                </p>
              ))}
            {(e.fields.coverImage || e.fields.url) && (
              <img
                src={e.fields.coverImage || e.fields.url}
                alt={
                  e.fields.caption ||
                  e.fields.title ||
                  e.fields.name ||
                  "Saved image"
                }
                className="max-h-64 rounded-xl"
              />
            )}
          </article>
        ))
      )}
    </details>
  );
}
