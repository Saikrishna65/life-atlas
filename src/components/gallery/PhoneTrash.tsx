"use client";
import { useState } from "react";
import { R2, bytes, storageError, systemAction } from "@/lib/r2/native";
type Item = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};
export default function PhoneTrash({ androidSdk }: { androidSdk: number }) {
  const [items, setItems] = useState<Item[]>([]),
    [cursor, setCursor] = useState("0:external"),
    [complete, setComplete] = useState(false),
    [opened, setOpened] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string[]>([]);
  async function load(append = false) {
    setBusy(true);
    setError("");
    try {
      const result = await R2.getDeviceTrash({
        cursor: append ? cursor : "0:external",
      });
      setItems((old) => (append ? [...old, ...result.items] : result.items));
      setCursor(result.cursor);
      setComplete(result.complete);
      setOpened(true);
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    setBusy(true);
    setError("");
    try {
      const result = await systemAction(() =>
        R2.trashDeviceMedia({ ids: selected, trashed: false }),
      );
      if (result.approved) {
        setSelected([]);
        await load();
      }
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gl-panel">
      <h2>Phone trash</h2>
      <p>
        Separate from cloud trash. Android controls which deleted phone files
        Atlas can see and how long they remain recoverable. Restoring here
        changes only the phone copy.
      </p>
      {androidSdk < 30 ? (
        <p>Phone trash requires Android 11 or later.</p>
      ) : (
        <>
          <button disabled={busy} onClick={() => void load()}>
            {opened ? "Refresh phone trash" : "View accessible phone trash"}
          </button>
          {error && (
            <p role="alert" className="gl-error">
              {error}
            </p>
          )}
          {opened && !items.length && <p>No accessible trashed phone files.</p>}
          {items.map((item) => (
            <label className="gl-check" key={item.id}>
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.includes(item.id)}
                onChange={(e) =>
                  setSelected((old) =>
                    e.target.checked
                      ? [...old, item.id].slice(0, 100)
                      : old.filter((id) => id !== item.id),
                  )
                }
              />
              <span>
                {item.name}
                <small>
                  {bytes(item.size)}
                  {item.expiresAt > 0 &&
                    ` · Android expiry ${new Date(item.expiresAt).toLocaleDateString()}`}
                </small>
              </span>
            </label>
          ))}
          {selected.length > 0 && (
            <button disabled={busy} onClick={() => void restore()}>
              Restore {selected.length} phone files…
            </button>
          )}
          {opened && !complete && (
            <button disabled={busy} onClick={() => void load(true)}>
              Load more phone trash
            </button>
          )}
        </>
      )}
    </section>
  );
}
