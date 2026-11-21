"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  Images,
  RefreshCw,
  Settings2,
  Users,
  Sparkles,
} from "lucide-react";
import { useGalleryBack } from "@/lib/gallery/navigation";
import { R2, storageError } from "@/lib/r2/native";
import { gallerySource } from "@/lib/gallery/actions";
import type {
  CollectionKind,
  CollectionPage,
  SmartCollection,
  CollectionMediaPage,
  PeopleFacePage,
  CollectionEdit,
} from "@/lib/gallery/collections";
import { Modal } from "@/components/world/primitives";
import GalleryCollectionCover from "./GalleryCollectionCover";
import { cachedThumbnail } from "./GalleryThumbnail";
import GalleryAlbumPicker from "./GalleryAlbumPicker";
import PhotoViewer from "./PhotoViewer";
import "./smart-collections.css";

const pages = new Map<CollectionKind, CollectionPage>();
export default function GallerySmartCollections({
  mode,
  revision,
  onSettings,
  onOpen,
  onChanged,
}: {
  mode: CollectionKind;
  revision: number;
  onSettings: (feature?: "people" | "similar") => void;
  onOpen: (collection: SmartCollection) => void;
  onChanged: () => void;
}) {
  const [page, setPage] = useState<CollectionPage | undefined>(pages.get(mode));
  const [collections, setCollections] = useState<SmartCollection[]>(
    pages.get(mode)?.collections || [],
  );
  const [loading, setLoading] = useState(!pages.has(mode)),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [epoch, setEpoch] = useState(0),
    [selected, setSelected] = useState<SmartCollection>();
  const [review, setReview] = useState<CollectionMediaPage>(),
    [people, setPeople] = useState<PeopleFacePage>();
  const [reviewCursor, setReviewCursor] = useState(""),
    [pastPages, setPastPages] = useState<string[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false),
    [name, setName] = useState("");
  const [viewer, setViewer] = useState("");
  const [confirm, setConfirm] = useState<"forget-people" | "reset-similar">();
  const [peopleSelecting, setPeopleSelecting] = useState(false),
    [peopleSelection, setPeopleSelection] = useState<string[]>([]),
    [bulkTarget, setBulkTarget] = useState("");
  useGalleryBack(
    peopleSelecting,
    () => {
      setPeopleSelecting(false);
      setPeopleSelection([]);
    },
    70,
  );
  const [showMatches, setShowMatches] = useState(false),
    [matchNames, setMatchNames] = useState<Record<string, string>>({});
  const [newAlbum, setNewAlbum] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  const [chosenFaces, setChosenFaces] = useState<string[]>([]),
    [moveName, setMoveName] = useState("");
  useGalleryBack(
    !!selected,
    () => {
      setSelected(undefined);
      setViewer("");
    },
    80,
  );
  useGalleryBack(!!confirm, () => setConfirm(undefined), 90);
  const request = useRef(0),
    sentinel = useRef<HTMLDivElement>(null);
  const load = useCallback(
    async (cursor = "", append = false) => {
      const generation = ++request.current;
      setLoading(true);
      setError("");
      try {
        const result = await R2.getGalleryCollections({ kind: mode, cursor });
        if (generation !== request.current) return;
        if (!cursor) pages.set(mode, result);
        setPage(result);
        setCollections((old) =>
          append
            ? [
                ...new Map(
                  [...old, ...result.collections].map((c) => [c.id, c]),
                ).values(),
              ]
            : result.collections,
        );
      } catch (e) {
        if (generation === request.current) setError(storageError(e));
      } finally {
        if (generation === request.current) setLoading(false);
      }
    },
    [mode],
  );
  useEffect(() => {
    let alive = true;
    const counter = request;
    queueMicrotask(() => {
      if (alive) {
        setCollections(pages.get(mode)?.collections || []);
        setPage(pages.get(mode));
        void load();
      }
    });
    return () => {
      alive = false;
      counter.current++;
    };
  }, [load, revision, epoch, mode]);
  useEffect(() => {
    const refresh = () => {
      pages.delete(mode);
      void load();
    };
    window.addEventListener("atlas:gallery-analysis", refresh);
    return () => window.removeEventListener("atlas:gallery-analysis", refresh);
  }, [load, mode]);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !page?.cursor || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void load(page.cursor, true);
      },
      { rootMargin: "160px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [page?.cursor, loading, load]);
  const selectedKey = selected?.id;
  useEffect(() => {
    if (!selectedKey || mode === "memories" || mode === "albums") return;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setReviewLoading(true);
      setReview(undefined);
      setPeople(undefined);
      setError("");
      const next =
        mode === "people"
          ? R2.getGalleryPeopleFaces({ key: selectedKey, cursor: reviewCursor })
          : R2.getGalleryCollectionMedia({
              kind: mode,
              key: selectedKey,
              cursor: reviewCursor,
            });
      void next
        .then((value) => {
          if (!alive) return;
          if (mode === "people") setPeople(value as PeopleFacePage);
          else setReview(value as CollectionMediaPage);
        })
        .catch((e) => {
          if (alive) setError(storageError(e));
        })
        .finally(() => {
          if (alive) setReviewLoading(false);
        });
    });
    return () => {
      alive = false;
    };
  }, [selectedKey, mode, reviewCursor, epoch]);
  const act = async (
    edit: CollectionEdit | { action: "reset-similar" | "restore-memories" },
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await R2.editGalleryCollection(edit);
      if (edit.action === "merge-people-many") {
        setPeopleSelecting(false);
        setPeopleSelection([]);
      }
      pages.delete(mode);
      setConfirm(undefined);
      setViewer("");
      setNotice(
        edit.action === "pick"
          ? "Your pick is saved. Every original stays in your library."
          : edit.action === "name-person"
            ? "Name confirmed. It stays private."
            : edit.action === "forget-people"
              ? "Face data, names and the downloaded models have been removed."
              : "Collection updated. Your originals are unchanged.",
      );
      if (edit.action === "pick") {
        const value = await R2.getGalleryCollectionMedia({
          kind: "similar",
          key: edit.key,
          cursor: reviewCursor,
        });
        setReview(value);
        setSelected((old) => (old ? { ...old, pickedId: edit.mediaId } : old));
        setCollections((rows) =>
          rows.map((c) =>
            c.id === edit.key
              ? { ...c, pickedId: edit.mediaId, coverId: edit.mediaId }
              : c,
          ),
        );
      } else {
        if (edit.action !== "reference-face") setSelected(undefined);
        setEpoch((v) => v + 1);
      }
      if (edit.action === "forget-people") onChanged();
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  };
  const open = (collection: SmartCollection) => {
    if (mode === "memories" || mode === "albums") {
      onOpen(collection);
      return;
    }
    setReviewCursor("");
    setPastPages([]);
    setName(collection.confirmed ? collection.title : "");
    setMergeTarget("");
    setChosenFaces([]);
    setMoveName("");
    setSelected(collection);
  };
  const loadedMedia =
    mode === "people" ? people?.media || [] : review?.items || [];
  const next = mode === "people" ? people?.cursor : review?.cursor;
  const titles = {
    similar: "Similar photos",
    people: "People",
    memories: "Albums & memories",
    albums: "My albums",
  };
  return (
    <section
      className="gsmart"
      aria-label={
        mode === "similar"
          ? "Similar photo review"
          : mode === "people"
            ? "People collections"
            : "Smart albums and memories"
      }
    >
      <div className="gsmart-intro">
        <span>
          {mode === "similar" ? (
            <Images />
          ) : mode === "people" ? (
            <Users />
          ) : (
            <Heart />
          )}
        </span>
        <h2>{titles[mode]}</h2>
        <p>
          {mode === "similar"
            ? "Review nearby shots, keep your favorite pick and leave the rest of your library untouched."
            : mode === "people"
              ? "Suggested face groups can be mistaken. Review the photos and confirm names yourself. Nothing is shared publicly."
              : mode === "albums"
                ? "Albums you create. Your originals stay in their folders."
                : "Albums gather themselves from your camera dates and media types. Anniversaries appear when there is a real dated memory to revisit."}
        </p>
      </div>
      <div className="gsmart-tools">
        <button disabled={loading || busy} onClick={() => void load()}>
          <RefreshCw size={16} />
          Refresh
        </button>
        {(mode === "similar" || mode === "people") && (
          <button onClick={() => onSettings(mode)}>
            <Settings2 size={16} />
            Analysis settings
          </button>
        )}
        {mode === "people" && !page?.needsAnalysis && (
          <button disabled={busy} onClick={() => setConfirm("forget-people")}>
            Forget people data
          </button>
        )}
        {mode === "similar" && !page?.needsAnalysis && (
          <button disabled={busy} onClick={() => setConfirm("reset-similar")}>
            Reset reviews
          </button>
        )}
        {mode === "memories" && !!page?.hiddenMemories && (
          <button
            disabled={busy}
            onClick={() => void act({ action: "restore-memories" })}
          >
            Show hidden memories
          </button>
        )}
      </div>
      {error && !selected && (
        <p role="alert" className="gsmart-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="gsmart-notice">
          {notice}
        </p>
      )}
      {loading && !collections.length && (
        <div
          className={`gsmart-placeholder ${mode === "people" ? "is-people" : ""}`}
          role="status"
        >
          <span className="sr-only">Opening collections</span>
          {[0, 1, 2, 3].map((n) => (
            <i key={n} />
          ))}
        </div>
      )}
      {page?.needsAnalysis && (
        <div className="gsmart-empty">
          <h3>
            {mode === "people"
              ? "People grouping is your choice."
              : "Find your similar shots."}
          </h3>
          <p>
            {mode === "people"
              ? "Enable private face analysis, review suggested groups and add names when you're ready. The optional models are about 10.1 MB."
              : "Enable small on-device fingerprints. No extra model is needed."}
          </p>
          <button
            onClick={() => onSettings(mode === "people" ? "people" : "similar")}
          >
            {mode === "people"
              ? "Set up people grouping"
              : "Find similar photos"}
          </button>
        </div>
      )}
      {!loading && page && !page.needsAnalysis && !collections.length && (
        <div className="gsmart-empty">
          <h3>
            {mode === "albums"
              ? "Make it yours."
              : mode === "memories"
                ? "Your next look back will be here."
                : "Nothing to review yet."}
          </h3>
          <p>
            {mode === "albums"
              ? "Create an album, then add photos or videos from your phone. Originals stay in their folders."
              : mode === "memories"
                ? "Photos with saved camera dates will appear in dated albums. Videos and screenshot albums appear when available."
                : mode === "people"
                  ? "Clear, larger faces work best. Let analysis finish, then refresh. Small or unclear faces may not be grouped."
                  : "Let photo analysis finish, then refresh. These suggestions are deliberately conservative."}
          </p>
          {(mode === "similar" || mode === "people") && (
            <button onClick={() => onSettings(mode)}>Check analysis</button>
          )}
        </div>
      )}
      {mode === "people" && !page?.needsAnalysis && (
        <p className="gsmart-hint">
          Names and corrections stay private. Encrypted recovery is available in
          analysis settings.
        </p>
      )}
      {page?.partial && (
        <p className="gsmart-hint">
          This collection is large. Limit analysis to selected albums for a more
          complete review.
        </p>
      )}
      {mode === "people" && !page?.needsAnalysis && (
        <div className="gsmart-bulk">
          <button
            onClick={() => {
              setPeopleSelecting((v) => !v);
              setPeopleSelection([]);
            }}
          >
            {peopleSelecting ? "Done" : "Select people"}
          </button>
          {peopleSelecting && (
            <>
              <span>{peopleSelection.length} selected</span>
              <label>
                These are the same person as
                <select
                  aria-label="Person for selected groups"
                  value={bulkTarget}
                  onChange={(e) => setBulkTarget(e.target.value)}
                >
                  <option value="">Choose a named person</option>
                  {collections
                    .filter((p) => p.confirmed)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </label>
              <button
                disabled={
                  busy ||
                  !bulkTarget ||
                  !peopleSelection.some((id) => id !== bulkTarget)
                }
                onClick={() =>
                  void act({
                    action: "merge-people-many",
                    keys: peopleSelection,
                    personId: bulkTarget,
                  })
                }
              >
                Merge selected groups
              </button>
              {!collections.some((p) => p.confirmed) && (
                <p>
                  Name one group first, then select other groups to merge into
                  it.
                </p>
              )}
            </>
          )}
        </div>
      )}
      {mode === "people" && (
        <div className="gsmart-tools">
          {page?.canUndoPeople && (
            <button
              disabled={busy}
              onClick={() => void act({ action: "undo-people" })}
            >
              Undo last people change
            </button>
          )}
          {!!page?.hiddenPeople && (
            <button
              disabled={busy}
              onClick={() => void act({ action: "restore-people" })}
            >
              Show hidden people
            </button>
          )}
        </div>
      )}
      {mode === "people" && !!page?.matches?.length && (
        <div className="gsmart-matches">
          <button
            onClick={() => setShowMatches((v) => !v)}
            aria-expanded={showMatches}
          >
            Review possible matches · {page.matches.length}
          </button>
          {showMatches &&
            page.matches.map((pair, pairIndex) => (
              <article key={pair.id}>
                <h3>Could these be the same person?</h3>
                <div className="gsmart-match-pair">
                  <div>
                    <GalleryCollectionCover faceId={pair.leftFace} />
                    <span>{pair.leftName}</span>
                  </div>
                  <div>
                    <GalleryCollectionCover faceId={pair.rightFace} />
                    <span>{pair.rightName}</span>
                  </div>
                </div>
                <label>
                  Confirm a name
                  <input
                    aria-label={`Name for match ${pairIndex + 1}`}
                    value={
                      matchNames[pair.id] ??
                      (pair.leftName !== "Unnamed person"
                        ? pair.leftName
                        : pair.rightName !== "Unnamed person"
                          ? pair.rightName
                          : "")
                    }
                    onChange={(e) =>
                      setMatchNames((v) => ({
                        ...v,
                        [pair.id]: e.target.value,
                      }))
                    }
                    maxLength={80}
                  />
                </label>
                <button
                  disabled={
                    busy ||
                    !(
                      matchNames[pair.id] ??
                      (pair.leftName !== "Unnamed person"
                        ? pair.leftName
                        : pair.rightName !== "Unnamed person"
                          ? pair.rightName
                          : "")
                    ).trim()
                  }
                  onClick={() =>
                    void act({
                      action: "confirm-people-pair",
                      keys: [pair.left, pair.right],
                      name:
                        matchNames[pair.id] ??
                        (pair.leftName !== "Unnamed person"
                          ? pair.leftName
                          : pair.rightName),
                    })
                  }
                >
                  Same person · merge
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void act({ action: "reject-people-match", key: pair.id })
                  }
                >
                  Different people
                </button>
              </article>
            ))}
          <p>
            These are suggestions. Nothing merges without your confirmation.
          </p>
        </div>
      )}
      {mode === "albums" && (
        <div>
          <button onClick={() => setNewAlbum(true)}>Create album</button>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void R2.editGalleryAlbum({ action: "restore-hidden" })
                .then(() => {
                  pages.delete("albums");
                  setEpoch((v) => v + 1);
                })
                .catch((e) => setError(storageError(e)))
                .finally(() => setBusy(false));
            }}
          >
            Restore hidden albums
          </button>
          <p className="gsmart-hint">
            Hiding a custom album removes its collection card. Its photos remain
            in Photos.
          </p>
        </div>
      )}
      {newAlbum && (
        <GalleryAlbumPicker
          ids={[]}
          onClose={() => setNewAlbum(false)}
          onSaved={() => {
            setNewAlbum(false);
            pages.delete("albums");
            setEpoch((v) => v + 1);
          }}
        />
      )}
      <div className={`gsmart-grid${mode === "people" ? " is-people" : ""}`}>
        {collections.map((collection) => (
          <article
            key={collection.id}
            className={collection.kind === "memory" ? "is-memory" : ""}
          >
            <button
              className="gsmart-card"
              aria-label={`${peopleSelecting ? "Select" : "Open"} ${collection.title}`}
              aria-pressed={
                peopleSelecting
                  ? peopleSelection.includes(collection.id)
                  : undefined
              }
              onClick={() =>
                peopleSelecting
                  ? setPeopleSelection((ids) =>
                      ids.includes(collection.id)
                        ? ids.filter((id) => id !== collection.id)
                        : [...ids, collection.id],
                    )
                  : open(collection)
              }
            >
              {peopleSelecting && (
                <span className="gsmart-selected-mark">
                  {peopleSelection.includes(collection.id) ? "✓" : "○"}
                </span>
              )}
              <GalleryCollectionCover
                mediaId={collection.coverId}
                faceId={collection.faceId}
              />
              <span className="gsmart-card-caption">
                <strong>{collection.title}</strong>
                <small>
                  {collection.count.toLocaleString()}{" "}
                  {collection.kind === "album" || collection.kind === "memory"
                    ? collection.count === 1
                      ? "item"
                      : "items"
                    : collection.count === 1
                      ? "photo"
                      : "photos"}
                </small>
                <span>{collection.subtitle}</span>
              </span>
            </button>
            {mode === "albums" && (
              <div className="gsmart-album-controls">
                <button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void R2.editGalleryAlbum({
                      action: "hide",
                      id: collection.id,
                    })
                      .then(() => {
                        pages.delete("albums");
                        setEpoch((v) => v + 1);
                      })
                      .catch((e) => setError(storageError(e)))
                      .finally(() => setBusy(false));
                  }}
                >
                  Hide album
                </button>
                <button
                  aria-label={`Rename ${collection.title}`}
                  onClick={() => {
                    const name = prompt("Album name", collection.title);
                    if (name?.trim())
                      void R2.editGalleryAlbum({
                        action: "rename",
                        id: collection.id,
                        name,
                      })
                        .then(() => {
                          pages.delete(mode);
                          setEpoch((v) => v + 1);
                        })
                        .catch((e) => setError(storageError(e)));
                  }}
                >
                  Rename
                </button>
                <button
                  aria-label={`Move ${collection.title} earlier`}
                  onClick={() =>
                    void R2.editGalleryAlbum({
                      action: "move",
                      id: collection.id,
                      direction: -1,
                    })
                      .then(() => {
                        pages.delete(mode);
                        setEpoch((v) => v + 1);
                      })
                      .catch((e) => setError(storageError(e)))
                  }
                >
                  ↑
                </button>
                <button
                  aria-label={`Move ${collection.title} later`}
                  onClick={() =>
                    void R2.editGalleryAlbum({
                      action: "move",
                      id: collection.id,
                      direction: 1,
                    })
                      .then(() => {
                        pages.delete(mode);
                        setEpoch((v) => v + 1);
                      })
                      .catch((e) => setError(storageError(e)))
                  }
                >
                  ↓
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this album? Your photos and videos remain.",
                      )
                    )
                      void R2.editGalleryAlbum({
                        action: "delete",
                        id: collection.id,
                      })
                        .then(() => {
                          pages.delete(mode);
                          setEpoch((v) => v + 1);
                        })
                        .catch((e) => setError(storageError(e)));
                  }}
                >
                  Delete album
                </button>
              </div>
            )}
            {collection.kind === "memory" && (
              <button
                className="gsmart-hide"
                disabled={busy}
                onClick={() =>
                  void act({ action: "hide-memory", key: collection.id })
                }
              >
                Hide this memory
              </button>
            )}
          </article>
        ))}
      </div>
      <div ref={sentinel} aria-hidden="true" />
      {loading && collections.length > 0 && (
        <p role="status">Loading more collections…</p>
      )}
      {selected && (
        <Modal
          title={
            mode === "people" ? "Review this person" : "Compare similar photos"
          }
          onClose={() => {
            setSelected(undefined);
            setViewer("");
          }}
          className="pg-dialog gsmart-dialog"
        >
          <h2>{selected.title}</h2>
          <p>
            {mode === "people"
              ? "Check every face before confirming a name. Use the menu under a face to move it, separate it or remove a wrong detection."
              : "The suggested pick compares clarity, lighting and resolution. Tap a photo to open it. Choosing a pick never deletes other shots."}
          </p>
          {error && (
            <p role="alert" className="gsmart-error">
              {error}
            </p>
          )}
          {mode === "people" && (
            <form
              className="gsmart-name"
              onSubmit={(e) => {
                e.preventDefault();
                void act({ action: "name-person", key: selected.id, name });
              }}
            >
              <label>
                <span>
                  {selected.confirmed ? "Their name" : "Name this person"}
                </span>
                <input
                  aria-label="Person name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="A name you choose"
                />
              </label>
              <button disabled={busy || !name.trim()} type="submit">
                {selected.confirmed ? "Save name" : "Confirm name & group"}
              </button>
            </form>
          )}
          {mode === "people" &&
            selected.suggestedPersonId &&
            people?.people.some((p) => p.id === selected.suggestedPersonId) && (
              <button
                className="gsmart-primary"
                disabled={busy}
                onClick={() =>
                  void act({
                    action: "confirm-person-match",
                    key: selected.id,
                    personId: selected.suggestedPersonId!,
                  })
                }
              >
                Yes, add these photos to{" "}
                {
                  people.people.find((p) => p.id === selected.suggestedPersonId)
                    ?.name
                }
              </button>
            )}
          {mode === "people" && chosenFaces.length > 0 && (
            <section className="gsmart-face-selection">
              <strong>{chosenFaces.length} faces selected</strong>
              <label>
                Move to
                <select
                  aria-label="Move selected faces to"
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                >
                  <option value="">A new person</option>
                  {people?.people
                    .filter((p) => p.id !== selected.id)
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              {!mergeTarget && (
                <label>
                  Name
                  <input
                    aria-label="New person name"
                    value={moveName}
                    onChange={(e) => setMoveName(e.target.value)}
                    maxLength={80}
                  />
                </label>
              )}
              <button
                disabled={busy || (!mergeTarget && !moveName.trim())}
                onClick={() =>
                  void act({
                    action: "move-faces",
                    key: selected.id,
                    faceIds: chosenFaces,
                    personId: mergeTarget || undefined,
                    name: moveName || undefined,
                  })
                }
              >
                Move selected faces
              </button>
              <button onClick={() => setChosenFaces([])}>
                Clear face selection
              </button>
            </section>
          )}
          {mode === "people" && selected.confirmed && (
            <p className="gsmart-hint">
              Choose up to eight clear reference photos from different angles.
              They help future match suggestions; names always come from you.
            </p>
          )}
          {mode === "people" && people && (
            <div className="gsmart-merge">
              <label>
                Same person as
                <select
                  aria-label="Merge with person"
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                >
                  <option value="">Choose a named person</option>
                  {people.people
                    .filter((p) => p.id !== selected.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                disabled={busy || !mergeTarget}
                onClick={() =>
                  void act({
                    action: "merge-people",
                    key: selected.id,
                    personId: mergeTarget,
                  })
                }
              >
                Merge into this person
              </button>
              <button
                disabled={busy || !mergeTarget}
                onClick={() =>
                  void act({
                    action: "never-people",
                    key: selected.id,
                    personId: mergeTarget,
                  })
                }
              >
                Never group these two people together
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void act({ action: "hide-person", key: selected.id })
                }
              >
                Hide from People
              </button>
            </div>
          )}
          <button onClick={() => onOpen(selected)} className="gsmart-view-all">
            Open photos
            <ArrowRight size={16} />
          </button>
          {reviewLoading && <p role="status">Opening photos…</p>}
          <div
            className={`gsmart-review${mode === "people" ? " is-faces" : ""}`}
          >
            {mode === "similar" &&
              review?.items.map((media) => (
                <article key={media.id}>
                  <button
                    className="gsmart-photo"
                    aria-label={`Inspect ${media.name}`}
                    onClick={() => setViewer(media.id)}
                  >
                    <GalleryCollectionCover mediaId={media.id} />
                  </button>
                  {media.id === review.bestId && (
                    <span className="gsmart-suggested">
                      <Sparkles size={13} />
                      Suggested pick
                    </span>
                  )}
                  <button
                    className="gsmart-pick"
                    aria-pressed={media.id === review.pickedId}
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action: "pick",
                        key: selected.id,
                        mediaId: media.id,
                      })
                    }
                  >
                    {media.id === review.pickedId ? (
                      <>
                        <Check size={15} />
                        Your pick
                      </>
                    ) : (
                      "Choose this photo"
                    )}
                  </button>
                  <button
                    className="gsmart-separate"
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action: "separate-photo",
                        key: selected.id,
                        mediaId: media.id,
                      })
                    }
                  >
                    Not similar · separate
                  </button>
                </article>
              ))}
            {mode === "people" &&
              people?.faces.map((face, faceIndex) => (
                <article key={face.id}>
                  <label className="gsmart-face-check">
                    <input
                      type="checkbox"
                      aria-label={`Select face ${faceIndex + 1}`}
                      checked={chosenFaces.includes(face.id)}
                      onChange={() =>
                        setChosenFaces((v) =>
                          v.includes(face.id)
                            ? v.filter((id) => id !== face.id)
                            : [...v, face.id],
                        )
                      }
                    />
                    Select
                  </label>
                  {selected.confirmed && (
                    <label className="gsmart-face-check">
                      <input
                        type="checkbox"
                        aria-label={`Use face ${faceIndex + 1} as reference`}
                        disabled={busy}
                        checked={!!face.reference}
                        onChange={() =>
                          void act({
                            action: "reference-face",
                            key: selected.id,
                            faceId: face.id,
                          })
                        }
                      />
                      Reference photo
                    </label>
                  )}
                  <button
                    className="gsmart-photo"
                    aria-label="Open photo"
                    onClick={() => setViewer(face.mediaId)}
                  >
                    <GalleryCollectionCover faceId={face.id} />
                  </button>
                  <button
                    disabled={busy}
                    className="gsmart-cover-choice"
                    onClick={() =>
                      void act({
                        action: "person-cover",
                        key: selected.id,
                        faceId: face.id,
                      })
                    }
                  >
                    Use as cover
                  </button>
                  <label className="gsmart-face-menu">
                    <span>Change group</span>
                    <select
                      value=""
                      disabled={busy}
                      aria-label={`Change group for face ${faceIndex + 1}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        void act(
                          v === "separate"
                            ? {
                                action: "separate-face",
                                key: selected.id,
                                faceId: face.id,
                              }
                            : v === "exclude"
                              ? {
                                  action: "exclude-face",
                                  key: selected.id,
                                  faceId: face.id,
                                }
                              : {
                                  action: "assign-face",
                                  key: selected.id,
                                  faceId: face.id,
                                  personId: v,
                                },
                        );
                      }}
                    >
                      <option value="">Choose…</option>
                      {people.people
                        .filter((p) => p.id !== selected.id)
                        .map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      <option value="separate">Separate person</option>
                      <option value="exclude">Not a face</option>
                    </select>
                  </label>
                </article>
              ))}
          </div>
          {(pastPages.length > 0 || next) && (
            <nav className="gsmart-paging" aria-label="Review pages">
              <button
                disabled={busy || reviewLoading || !pastPages.length}
                onClick={() => {
                  setReviewCursor(pastPages[pastPages.length - 1]);
                  setPastPages((v) => v.slice(0, -1));
                }}
              >
                <ArrowLeft size={16} />
                Previous photos
              </button>
              <button
                disabled={busy || reviewLoading || !next}
                onClick={() => {
                  setPastPages((v) => [...v, reviewCursor]);
                  setReviewCursor(next!);
                }}
              >
                Next photos
                <ArrowRight size={16} />
              </button>
            </nav>
          )}
          {mode === "similar" && (
            <button
              disabled={busy}
              onClick={() =>
                void act({ action: "dismiss-similar", key: selected.id })
              }
            >
              Dismiss this suggestion
            </button>
          )}
          {viewer && loadedMedia.some((m) => m.id === viewer) && (
            <PhotoViewer
              items={loadedMedia.map((m) => ({
                id: m.id,
                url: gallerySource(m.uri),
                poster: cachedThumbnail(m.id),
                kind: m.kind,
                place: m.album,
                category: "My private gallery",
                caption: m.name,
              }))}
              selected={viewer}
              onSelect={setViewer}
              onClose={() => setViewer("")}
            />
          )}
        </Modal>
      )}
      {confirm && (
        <Modal
          title={
            confirm === "forget-people"
              ? "Forget people data?"
              : "Reset photo reviews?"
          }
          onClose={() => setConfirm(undefined)}
          className="pg-dialog gsmart-dialog"
        >
          <h2>
            {confirm === "forget-people"
              ? "Keep the photos. Forget the faces."
              : "Start these reviews again?"}
          </h2>
          <p>
            {confirm === "forget-people"
              ? "This removes local face analysis, names and the small downloaded models. It stops people analysis. Your original photos, other analysis, trips and cloud files stay."
              : "This clears your picks and dismissed similar-photo suggestions. Existing fingerprints are reused. No photo is deleted."}
          </p>
          <button
            className="gsmart-primary"
            disabled={busy}
            onClick={() => void act({ action: confirm })}
          >
            {confirm === "forget-people"
              ? "Forget people data"
              : "Reset reviews"}
          </button>
          <button disabled={busy} onClick={() => setConfirm(undefined)}>
            Keep it
          </button>
        </Modal>
      )}
    </section>
  );
}
