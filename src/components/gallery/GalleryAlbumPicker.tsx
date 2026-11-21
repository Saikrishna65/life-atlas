"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/world/primitives";
import { useGalleryBack } from "@/lib/gallery/navigation";
import { R2, storageError } from "@/lib/r2/native";
import type { SmartCollection } from "@/lib/gallery/collections";
export default function GalleryAlbumPicker({
  ids,
  onClose,
  onSaved,
}: {
  ids: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [albums, setAlbums] = useState<SmartCollection[]>([]),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useGalleryBack(true, onClose, 105);
  useEffect(() => {
    let alive = true;
    void (async () => {
      let cursor = "";
      const values: SmartCollection[] = [];
      do {
        const page = await R2.getGalleryCollections({ kind: "albums", cursor });
        values.push(...page.collections);
        if (alive) setAlbums([...values]);
        cursor = page.complete ? "" : page.cursor;
      } while (cursor && alive);
    })().catch((e) => {
      if (alive) setError(storageError(e));
    });
    return () => {
      alive = false;
    };
  }, []);
  const save = async (id?: string) => {
    setBusy(true);
    setError("");
    try {
      await R2.editGalleryAlbum(
        id ? { action: "add", id, ids } : { action: "create", name, ids },
      );
      window.dispatchEvent(new Event("atlas:gallery-analysis"));
      onSaved();
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={ids.length ? "Add to album" : "Create album"}
      className="pg-dialog gsmart-dialog"
      onClose={onClose}
    >
      <p>
        Albums organise your photos and videos without moving or duplicating
        originals.
      </p>
      <label className="gsmart-album-name">
        New album name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          aria-label="Album name"
          placeholder="A weekend to remember"
        />
      </label>
      <button disabled={busy || !name.trim()} onClick={() => void save()}>
        Create album{ids.length ? " & add selection" : ""}
      </button>
      {ids.length > 0 && albums.length > 0 && (
        <>
          <h3>Or choose an album</h3>
          <div className="gsmart-album-choices">
            {albums.map((a) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => void save(a.id)}
              >
                {a.title}
                <small>{a.count} items</small>
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
