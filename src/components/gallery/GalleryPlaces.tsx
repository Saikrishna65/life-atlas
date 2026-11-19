"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import TripMapPicker from "@/components/studio/TripMapPicker";
import { savePastTrip } from "@/lib/studio/store";
import {
  MapPin,
  ScanLine,
  Check,
  Plus,
  Undo2,
  CloudUpload,
  Download,
  ImageIcon,
  X,
  GitMerge,
} from "lucide-react";
import { R2, systemAction, storageError } from "@/lib/r2/native";
import {
  readPlaces,
  changePlaces,
  undoPlaces,
} from "@/lib/gallery/place-store";
import {
  emptyPlaces,
  suggestPlaces,
  placeVisits,
  movePlaceMedia,
  mergePlaces,
  validGeo,
  type PlaceLibrary,
  type SavedPlace,
  type GeoPoint,
  type PinPrecision,
  type PlaceMedia,
} from "@/lib/gallery/places";
import {
  scanPlaceLibrary,
  backupPlaces,
  restorePlaces,
  addSavedPlaceToTrip,
} from "@/lib/gallery/place-actions";
import { deviceAsset } from "@/lib/gallery/model";
import { useTripVault } from "@/lib/vault/useTripVault";
import GalleryThumbnail from "./GalleryThumbnail";
import TripMediaViewer from "@/components/media/TripMediaViewer";
import { gallerySource } from "@/lib/gallery/actions";
import type { StorageSummary, CloudObject } from "@/lib/r2/types";
import "./places.css";
const ReviewMap = dynamic(() => import("./PlaceReviewMap"), {
  ssr: false,
  loading: () => (
    <div className="gp-map-placeholder">Opening location review…</div>
  ),
});
export default function GalleryPlaces() {
  const { trips } = useTripVault();
  const [summary, setSummary] = useState<StorageSummary>();
  const [privatePreview, setPrivatePreview] = useState<{
    id: string;
    url: string;
  }>();
  const previewToken = useRef("");
  const [library, setLibrary] = useState<PlaceLibrary>(emptyPlaces),
    [mode, setMode] = useState<"suggestions" | "saved" | "unassigned" | "all">(
      "suggestions",
    ),
    [active, setActive] = useState(""),
    [radius, setRadius] = useState(200),
    [name, setName] = useState(""),
    [anchor, setAnchor] = useState<GeoPoint>(),
    [precision, setPrecision] = useState<PinPrecision>("approximate"),
    [selected, setSelected] = useState<string[]>([]),
    [target, setTarget] = useState(""),
    [trip, setTrip] = useState(""),
    [newTripName, setNewTripName] = useState(""),
    [newTripPin, setNewTripPin] = useState<GeoPoint>(),
    [visit, setVisit] = useState(""),
    [visitName, setVisitName] = useState(""),
    [mergeTarget, setMergeTarget] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [backups, setBackups] = useState<CloudObject[]>([]),
    [backupCursor, setBackupCursor] = useState(""),
    [showBackup, setShowBackup] = useState(false),
    [viewer, setViewer] = useState(""),
    [draftMembers, setDraftMembers] = useState<string[]>([]);
  const cancel = useRef(false),
    alive = useRef(true),
    busyRef = useRef(false);
  const closeViewer = useCallback(() => {
    setViewer("");
    setPrivatePreview(undefined);
    const token = previewToken.current;
    previewToken.current = "";
    if (token) void R2.releaseGalleryPreview({ token }).catch(() => {});
  }, []);
  useEffect(() => {
    alive.current = true;
    void R2.getConfigurationSummary()
      .then((value) => {
        if (alive.current) setSummary(value);
      })
      .catch(() => {});
    void readPlaces()
      .then((value) => {
        if (alive.current) setLibrary(value);
      })
      .catch((e) => setError(String(e)));
    return () => {
      alive.current = false;
      cancel.current = true;
    };
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) closeViewer();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      const token = previewToken.current;
      if (token) void R2.releaseGalleryPreview({ token }).catch(() => {});
    };
  }, [closeViewer]);
  const cloudReference = (m: PlaceMedia, config = summary) =>
    m.cloud?.find(
      (c) =>
        config?.[c.slot].configured && config[c.slot].storageScope === c.scope,
    );
  const mediaUrl = (m: PlaceMedia) => {
    if (m.device) return gallerySource(m.device.uri);
    if (privatePreview?.id === m.id) return privatePreview.url;
    const copy = cloudReference(m);
    const base = summary?.public.publicBaseUrl;
    return copy?.slot === "public" && base
      ? base.replace(/\/$/, "") +
          "/" +
          copy.key.split("/").map(encodeURIComponent).join("/")
      : undefined;
  };
  async function openMedia(m: PlaceMedia) {
    closeViewer();
    if (m.device) {
      setViewer(m.id);
      return;
    }
    const config = await R2.getConfigurationSummary();
    if (!alive.current) return;
    setSummary(config);
    const copy = cloudReference(m, config);
    if (!copy)
      throw Error(
        "Reconnect the original, or configure the bucket that contains its saved cloud copy.",
      );
    if (copy.slot === "private") {
      const preview = await systemAction(() =>
        R2.openGalleryCloudPreview({ key: copy.key }),
      );
      if (!alive.current) {
        await R2.releaseGalleryPreview({ token: preview.token });
        return;
      }
      previewToken.current = preview.token;
      setPrivatePreview({ id: m.id, url: gallerySource(preview.path) });
    } else if (!config.public.publicBaseUrl)
      throw Error("Configure the public media base URL to open this copy.");
    setViewer(m.id);
  }
  const suggestions = useMemo(
    () => suggestPlaces(library.media, library.places, radius, library.ignored),
    [library, radius],
  );
  const saved = library.places.find((p) => p.id === active),
    suggestion = suggestions.find((p) => p.id === active),
    memberIds = saved?.members || suggestion?.members || draftMembers;
  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);
  const members = useMemo(
    () => library.media.filter((m) => memberSet.has(m.id)),
    [library.media, memberSet],
  );
  const visits = useMemo(
    () => (saved ? placeVisits(saved, library.media) : []),
    [saved, library.media],
  );
  const assigned = useMemo(
    () => new Set(library.places.flatMap((p) => p.members)),
    [library.places],
  );
  const visible = useMemo(() => {
    const visitMembers = visit
      ? new Set(visits.find((v) => v.id === visit)?.members || [])
      : null;
    return library.media
      .filter(
        (m) =>
          (mode === "all" ||
            (mode === "unassigned" && !assigned.has(m.id)) ||
            (mode !== "unassigned" && memberSet.has(m.id))) &&
          (!visitMembers || visitMembers.has(m.id)) &&
          (!query.trim() ||
            m.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
      )
      .sort((a, b) => a.capturedAt - b.capturedAt || a.id.localeCompare(b.id));
  }, [library.media, mode, assigned, memberSet, visit, visits, query]);
  const shown = visible.slice(0, page * 60),
    chosen = new Set(selected);
  const viewerItems = visible
    .filter((m) => mediaUrl(m))
    .map((m) => ({
      id: m.id,
      url: mediaUrl(m)!,
      kind: m.kind,
      place: saved && mode === "saved" ? saved.name : "Location review",
      category: m.device ? "Original on phone" : "Recorded cloud original",
      width: m.device?.width,
      height: m.device?.height,
    }));
  async function run(task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    cancel.current = false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error && !("code" in e) ? e.message : storageError(e),
        );
    } finally {
      busyRef.current = false;
      if (alive.current) {
        setBusy(false);
        setProgress("");
        setLibrary(await readPlaces());
      }
    }
  }
  function showPlace(id: string) {
    setActive(id);
    setSelected([]);
    setVisit("");
    setPage(1);
    setDraftMembers([]);
    const p = library.places.find((p) => p.id === id),
      s = suggestions.find((s) => s.id === id);
    setName(p?.name || "");
    setAnchor(p?.anchor || s?.anchor);
    setPrecision(p?.precision || "approximate");
    if (p) setRadius(p.radius);
  }
  async function savePlace() {
    if (!name.trim() || name.trim().length > 54)
      throw Error("Give this place a name of 1–54 characters.");
    if (anchor && !validGeo(anchor)) throw Error("Choose valid coordinates.");
    const id = saved?.id || suggestion?.nearPlaceId || crypto.randomUUID();
    const current = library.places.find((p) => p.id === id);
    if (
      library.places.some(
        (p) =>
          p.id !== id &&
          p.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
      )
    )
      throw Error(
        "A place already has this name. Merge the collections, or choose a distinct name.",
      );
    let next = movePlaceMedia(
      library,
      memberIds,
      id === current?.id ? id : undefined,
    );
    const record: SavedPlace = {
      id,
      name: name.trim(),
      anchor,
      radius,
      precision,
      members: [...new Set([...(current?.members || []), ...memberIds])],
      excluded: (current?.excluded || []).filter(
        (id) => !memberIds.includes(id),
      ),
      visitNames: current?.visitNames || {},
      confirmedAt: new Date().toISOString(),
      tripLinks: current?.tripLinks,
    };
    next = {
      ...next,
      places: [...next.places.filter((p) => p.id !== id), record],
      ignored: next.ignored.filter((id) => !memberIds.includes(id)),
    };
    setLibrary(await changePlaces(() => next));
    setMode("saved");
    setActive(id);
    setDraftMembers([]);
    setNotice(
      "Place confirmed locally. Originals are unchanged. Use Add/update in trip when ready.",
    );
  }
  function newFromSelection() {
    if (!selected.length) return;
    setDraftMembers(selected);
    setActive("draft");
    setMode("suggestions");
    setName("");
    setAnchor(library.media.find((m) => chosen.has(m.id) && m.gps)?.gps);
    setPrecision("approximate");
    setVisit("");
    setPage(1);
  }
  return (
    <section className="gallery-places" aria-label="Places organizer">
      <header className="gp-heading">
        <div>
          <span className="pg-eyebrow">THE PLACES IN MY FRAMES</span>
          <h2>
            A place.
            <br />
            <em>A thousand little moments.</em>
          </h2>
          <p>Saved GPS suggests the collection. I decide what belongs.</p>
        </div>
        <div className="gp-tools">
          <button
            className="pg-primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const access = await R2.getGalleryAccess();
                if (access.status === "denied")
                  throw Error(
                    "Allow photo and video access above before scanning.",
                  );
                setLibrary(
                  await scanPlaceLibrary(
                    (n, text) => setProgress(`${text} · ${n} files`),
                    () => cancel.current,
                  ),
                );
                setNotice(
                  cancel.current
                    ? "Scan stopped. Completed batches are saved."
                    : `Scan complete. ${access.status === "limited" ? "Only Android-approved media was accessible." : ""}`,
                );
              })
            }
          >
            <ScanLine size={17} />{" "}
            {library.media.length
              ? "Scan new / changed photos"
              : "Find places in my photos"}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setLibrary(await undoPlaces());
                setActive("");
                setSelected([]);
                setNotice(
                  "Last place edit undone. Cloud backups and website posts are unchanged.",
                );
              })
            }
          >
            <Undo2 size={16} /> Undo edit
          </button>
          <button
            disabled={busy}
            aria-expanded={showBackup}
            onClick={() => setShowBackup(!showBackup)}
          >
            <CloudUpload size={16} /> Recovery & cloud catalog
          </button>
        </div>
      </header>
      {busy && (
        <div className="gp-progress" role="status">
          <span>{progress || "Saving place records…"}</span>
          <button
            onClick={() => {
              cancel.current = true;
              setProgress(
                "Stopping after the current operation. Completed work is saved.",
              );
            }}
          >
            Stop after current operation
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="pg-error">
          {error}
          <button aria-label="Dismiss place error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="pg-notice">
          {notice}
          <button
            aria-label="Dismiss place notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </p>
      )}
      {showBackup && (
        <section className="gp-recovery">
          <h3>My organization, recoverable.</h3>
          <p>
            Encrypted place names, memberships, capture locations and file
            identities in the private bucket. Photos and videos are not copied
            by this backup. Configure and verify your recovery kit in Cloud
            Storage first.
          </p>
          <div className="gp-actions">
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await backupPlaces(
                    (n, text) => setProgress(`${text} · ${n} files`),
                    () => cancel.current,
                  );
                  setNotice(
                    `Encrypted catalog saved as a new snapshot (${result.size.toLocaleString()} bytes). ${result.unmatched ? `${result.unmatched} unavailable originals need manual reconnection; their place records are saved. ` : ""}Keep your recovery kit independently safe.`,
                  );
                })
              }
            >
              <CloudUpload size={16} /> Save encrypted snapshot
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const page = await systemAction(() =>
                    R2.listPlaceBackups({ cursor: "" }),
                  );
                  setBackups(
                    page.objects.sort((a, b) =>
                      b.modifiedAt.localeCompare(a.modifiedAt),
                    ),
                  );
                  setBackupCursor(page.complete ? "" : page.cursor);
                })
              }
            >
              <Download size={16} /> Find cloud snapshots
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (
                    !confirm(
                      "Read accessible original files to match their exact bytes with restored place records? Nothing is uploaded.",
                    )
                  )
                    return;
                  setLibrary(
                    await scanPlaceLibrary(
                      (n, text) => setProgress(`${text} · ${n} files`),
                      () => cancel.current,
                      true,
                    ),
                  );
                  setNotice(
                    "Exact-file reconnection finished. Unavailable files remain in their saved places.",
                  );
                })
              }
            >
              Reconnect restored photos
            </button>
          </div>
          <p className="pg-muted">
            After reinstalling: restore the same private encryption key using
            its recovery kit, find a snapshot, merge it, then reconnect photos.
            Matching uses a keyed exact-file fingerprint, including photos
            without GPS. Originals copied with altered bytes need manual
            reassignment.
          </p>
          {backups.map((b) => (
            <div className="gp-snapshot" key={b.key}>
              <span>
                {new Date(b.modifiedAt).toLocaleString()} ·{" "}
                {(b.size / 1024).toFixed(0)} KB
              </span>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (
                      !confirm(
                        "Merge this encrypted snapshot into your local places? Existing local names and assignments take priority.",
                      )
                    )
                      return;
                    setLibrary(await restorePlaces(b.key));
                    setNotice(
                      "Snapshot merged. Reconnect restored photos to attach available originals on this phone.",
                    );
                  })
                }
              >
                Merge snapshot
              </button>
            </div>
          ))}
          {backupCursor && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await systemAction(() =>
                    R2.listPlaceBackups({ cursor: backupCursor }),
                  );
                  setBackups((old) =>
                    [
                      ...new Map(
                        [...old, ...next.objects].map((b) => [b.key, b]),
                      ).values(),
                    ].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
                  );
                  setBackupCursor(next.complete ? "" : next.cursor);
                })
              }
            >
              Older snapshots
            </button>
          )}
        </section>
      )}
      <div className="gp-overview">
        <span>{library.media.length.toLocaleString()} scanned</span>
        <span>{library.places.length} confirmed places</span>
        <span>
          {library.media.filter((m) => !assigned.has(m.id)).length} unassigned
        </span>
        <span>
          {library.media.filter((m) => !m.gps).length} without readable GPS
        </span>
      </div>
      <nav className="gp-modes" aria-label="Place collections">
        {(["suggestions", "saved", "unassigned", "all"] as const).map((m) => (
          <button
            key={m}
            aria-pressed={mode === m}
            disabled={busy}
            onClick={() => {
              setMode(m);
              setSelected([]);
              setPage(1);
              setVisit("");
            }}
          >
            {m === "suggestions"
              ? `Suggested (${suggestions.length})`
              : m === "saved"
                ? "Confirmed places"
                : m === "all"
                  ? "All scanned media"
                  : "Unassigned"}
          </button>
        ))}
      </nav>
      <div className="gp-layout">
        <aside className="gp-index">
          <label>
            Grouping radius <strong>{radius} m</strong>
            <input
              aria-label="Grouping radius"
              type="range"
              min={25}
              max={5000}
              step={25}
              value={radius}
              disabled={busy}
              onChange={(e) => {
                setRadius(Number(e.target.value));
                if (mode === "suggestions") {
                  setActive("");
                  setDraftMembers([]);
                }
              }}
            />
          </label>
          <p className="pg-muted">
            Each suggestion stays within this radius of its first GPS point.
            Photos never become an invented travel route.
          </p>
          {mode === "suggestions"
            ? suggestions.map((s, i) => (
                <button
                  key={s.id}
                  className="gp-place-link"
                  aria-pressed={active === s.id}
                  disabled={busy}
                  onClick={() => {
                    showPlace(s.id);
                    if (s.nearPlaceId)
                      setName(
                        library.places.find((p) => p.id === s.nearPlaceId)
                          ?.name || "",
                      );
                  }}
                >
                  <MapPin size={18} />
                  <span>
                    {s.nearPlaceId
                      ? `More near ${library.places.find((p) => p.id === s.nearPlaceId)?.name}`
                      : `Suggested place ${i + 1}`}
                    <small>
                      {s.members.length} photos & videos ·{" "}
                      {s.anchor.latitude.toFixed(3)},{" "}
                      {s.anchor.longitude.toFixed(3)}
                    </small>
                  </span>
                </button>
              ))
            : library.places.map((p) => (
                <button
                  key={p.id}
                  className="gp-place-link"
                  disabled={busy}
                  aria-pressed={active === p.id && mode === "saved"}
                  onClick={() => {
                    setMode("saved");
                    showPlace(p.id);
                  }}
                >
                  <MapPin size={18} />
                  <span>
                    {p.name}
                    <small>
                      {p.members.length} frames ·{" "}
                      {placeVisits(p, library.media).length} visits
                    </small>
                  </span>
                </button>
              ))}
          {!library.media.length && (
            <p className="gp-empty">
              Start a scan to read the locations saved by your camera. Nothing
              uploads automatically.
            </p>
          )}
        </aside>
        <div className="gp-review">
          {(saved || suggestion || draftMembers.length > 0) &&
            mode !== "all" &&
            mode !== "unassigned" && (
              <>
                <div className="gp-edit-head">
                  <label>
                    Place name
                    <input
                      aria-label="Place name"
                      maxLength={54}
                      value={name}
                      disabled={busy}
                      placeholder="Tungnath, the lake, the campsite…"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <button
                    className="pg-primary"
                    disabled={busy}
                    onClick={() => void run(savePlace)}
                  >
                    <Check size={16} />{" "}
                    {saved ? "Save place changes" : "Confirm this place"}
                  </button>
                  {suggestion && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setLibrary(
                            await changePlaces((old) => ({
                              ...old,
                              ignored: [
                                ...new Set([
                                  ...old.ignored,
                                  ...suggestion.members,
                                ]),
                              ],
                            })),
                          );
                          setActive("");
                          setNotice(
                            "Suggestion dismissed. Its photos remain in Unassigned for manual grouping.",
                          );
                        })
                      }
                    >
                      Keep unassigned
                    </button>
                  )}
                </div>
                <ReviewMap
                  anchor={anchor}
                  radius={radius}
                  media={members}
                  onPin={(point) => {
                    if (!busy) setAnchor(point);
                  }}
                />
                <div className="gp-coordinates">
                  <label>
                    Latitude
                    <input
                      aria-label="Place latitude"
                      type="number"
                      step="any"
                      value={anchor?.latitude ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        setAnchor({
                          latitude: Number(e.target.value),
                          longitude: anchor?.longitude ?? 0,
                        })
                      }
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      aria-label="Place longitude"
                      type="number"
                      step="any"
                      value={anchor?.longitude ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        setAnchor({
                          latitude: anchor?.latitude ?? 0,
                          longitude: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <button disabled={busy} onClick={() => setAnchor(undefined)}>
                    Remove pin
                  </button>
                  <label>
                    Public trip-map pin
                    <select
                      aria-label="Public pin precision"
                      value={precision}
                      disabled={busy}
                      onChange={(e) =>
                        setPrecision(e.target.value as PinPrecision)
                      }
                    >
                      <option value="approximate">
                        Approximate · about 1 km
                      </option>
                      <option value="exact">Exact chosen place pin</option>
                      <option value="hidden">Hide pin</option>
                    </select>
                  </label>
                </div>
                <p className="pg-muted">
                  GPS stays on the original. This controls the place pin shared
                  on a trip map. Public original files can still contain their
                  original EXIF; use sanitized derivatives when that information
                  must stay private.
                </p>
                {saved?.tripLinks?.length ? (
                  <p className="pg-muted">
                    Trip references:{" "}
                    {saved.tripLinks.map((t) => t.title).join(" · ")}. Trip
                    copies are independent; use Creator Studio to remove
                    previously added trip media.
                  </p>
                ) : null}
                {saved && (
                  <div className="gp-trip-tools">
                    <label>
                      Visit
                      <select
                        aria-label="Place visit"
                        value={visit}
                        disabled={busy}
                        onChange={(e) => {
                          setVisit(e.target.value);
                          setVisitName(saved.visitNames[e.target.value] || "");
                          setPage(1);
                          setSelected([]);
                        }}
                      >
                        <option value="">All visits</option>
                        {visits.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title} · {v.members.length} frames
                          </option>
                        ))}
                      </select>
                    </label>
                    {visit && (
                      <>
                        <label>
                          Visit name
                          <input
                            value={visitName}
                            maxLength={80}
                            disabled={busy}
                            onChange={(e) => setVisitName(e.target.value)}
                          />
                        </label>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              setLibrary(
                                await changePlaces((old) => ({
                                  ...old,
                                  places: old.places.map((p) =>
                                    p.id === saved.id
                                      ? {
                                          ...p,
                                          visitNames: {
                                            ...p.visitNames,
                                            [visit]:
                                              visitName.trim() ||
                                              new Date(
                                                visits.find(
                                                  (v) => v.id === visit,
                                                )!.from,
                                              ).toLocaleDateString(),
                                          },
                                        }
                                      : p,
                                  ),
                                })),
                              );
                            })
                          }
                        >
                          Save visit name
                        </button>
                      </>
                    )}
                    <label>
                      Trip
                      <select
                        aria-label="Destination trip"
                        value={trip}
                        disabled={busy}
                        onChange={(e) => {
                          setTrip(e.target.value);
                          if (e.target.value === "new") {
                            setNewTripName(name);
                            setNewTripPin(anchor);
                          }
                        }}
                      >
                        <option value="">Choose a trip</option>
                        {trips.map((t) => (
                          <option value={t.id} key={t.id}>
                            {t.title}
                          </option>
                        ))}
                        <option value="new">+ Create a trip</option>
                      </select>
                    </label>
                    {trip === "new" && (
                      <div className="gp-new-trip">
                        <label>
                          Trip title
                          <input
                            aria-label="New trip title"
                            maxLength={140}
                            value={newTripName}
                            disabled={busy}
                            onChange={(e) => setNewTripName(e.target.value)}
                          />
                        </label>
                        <TripMapPicker
                          value={newTripPin}
                          onChange={setNewTripPin}
                        />
                      </div>
                    )}
                    <button
                      disabled={busy || !trip}
                      onClick={() =>
                        void run(async () => {
                          await savePlace();
                          const current = await readPlaces(),
                            place = current.places.find(
                              (p) => p.id === saved.id,
                            )!;
                          let tripId = trip;
                          if (trip === "new") {
                            if (!newTripName.trim() || !newTripPin)
                              throw Error(
                                "Add a trip title and choose its main map pin.",
                              );
                            const created = await savePastTrip({
                              title: newTripName,
                              destination: newTripName,
                              startDate: "",
                              endDate: "",
                              mapLocation: newTripPin,
                            });
                            tripId = created.id;
                            setTrip(tripId);
                          }
                          await addSavedPlaceToTrip(
                            place,
                            current,
                            tripId,
                            visit
                              ? visits.find((v) => v.id === visit)?.members
                              : place.members,
                          );
                          setNotice(
                            "Place and originals added to the trip locally. Creator Studio handles upload and website review. The globe keeps the trip’s main pin.",
                          );
                        })
                      }
                    >
                      <Plus size={16} /> Add/update in trip
                    </button>
                    <Link href="/secret/studio">
                      Review in Creator Studio ↗
                    </Link>
                    <label>
                      Merge into
                      <select
                        aria-label="Merge target"
                        value={mergeTarget}
                        disabled={busy}
                        onChange={(e) => setMergeTarget(e.target.value)}
                      >
                        <option value="">Choose another place</option>
                        {library.places
                          .filter((p) => p.id !== saved.id)
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
                        void run(async () => {
                          if (
                            !confirm(
                              "Merge these places? You can undo the local edit. Published trips stay unchanged until updated.",
                            )
                          )
                            return;
                          setLibrary(
                            await changePlaces((old) =>
                              mergePlaces(old, saved.id, mergeTarget),
                            ),
                          );
                          setActive("");
                          setNotice("Places merged.");
                        })
                      }
                    >
                      <GitMerge size={16} /> Merge
                    </button>
                  </div>
                )}
              </>
            )}
          <div className="gp-media-toolbar">
            <label>
              Find a photo
              <input
                type="search"
                aria-label="Find place media"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <button
              disabled={busy || !shown.length}
              onClick={() =>
                setSelected([
                  ...new Set([...selected, ...shown.map((m) => m.id)]),
                ])
              }
            >
              Select shown
            </button>
            <button disabled={!selected.length} onClick={() => setSelected([])}>
              Clear selection
            </button>
            <span>
              {visible.length} frames · {selected.length} selected
            </span>
          </div>
          {!!selected.length && (
            <div className="gp-bulk">
              <select
                aria-label="Move selected to place"
                disabled={busy}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose a confirmed place</option>
                {library.places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !target}
                onClick={() =>
                  void run(async () => {
                    setLibrary(
                      await changePlaces((old) =>
                        movePlaceMedia(old, selected, target),
                      ),
                    );
                    setSelected([]);
                    setNotice(
                      "Selected photos moved. Original GPS is unchanged.",
                    );
                  })
                }
              >
                Move selected
              </button>
              <button disabled={busy} onClick={newFromSelection}>
                Create / split into a new place
              </button>
              {saved && mode === "saved" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setLibrary(
                        await changePlaces((old) =>
                          movePlaceMedia(old, selected),
                        ),
                      );
                      setSelected([]);
                      setNotice(
                        "Removed from the place. Find these photos in Unassigned.",
                      );
                    })
                  }
                >
                  Remove from place
                </button>
              )}
            </div>
          )}
          <div className="gp-photo-grid">
            {shown.map((m) => (
              <article
                key={m.id}
                className={chosen.has(m.id) ? "is-selected" : ""}
              >
                <button
                  className="gp-photo"
                  aria-label={`Preview ${m.name}`}
                  onClick={() => void run(() => openMedia(m))}
                >
                  {m.device ? (
                    <GalleryThumbnail asset={deviceAsset(m.device, [])} />
                  ) : (
                    <span className="gp-detached">
                      <ImageIcon />
                      {m.cloud?.length
                        ? "Cloud reference saved"
                        : "Reconnect original"}
                    </span>
                  )}
                </button>
                <button
                  className="gp-pick"
                  aria-label={`Select ${m.name}`}
                  aria-pressed={chosen.has(m.id)}
                  disabled={busy}
                  onClick={() =>
                    setSelected((old) =>
                      old.includes(m.id)
                        ? old.filter((id) => id !== m.id)
                        : [...old, m.id],
                    )
                  }
                >
                  {chosen.has(m.id) ? <Check size={15} /> : <Plus size={15} />}
                </button>
                <div>
                  <span>{m.name}</span>
                  <small>
                    {m.gps
                      ? "Camera GPS"
                      : assigned.has(m.id)
                        ? "Manually assigned · no GPS"
                        : "No readable GPS"}{" "}
                    · {new Date(m.capturedAt).toLocaleDateString()}
                  </small>
                </div>
                {saved && memberSet.has(m.id) && (
                  <button
                    aria-label={`Remove ${m.name} from place`}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setLibrary(
                          await changePlaces((old) =>
                            movePlaceMedia(old, [m.id]),
                          ),
                        );
                      })
                    }
                  >
                    <X size={14} /> Remove
                  </button>
                )}
              </article>
            ))}
          </div>
          {visible.length > shown.length && (
            <button disabled={busy} onClick={() => setPage((n) => n + 1)}>
              Show next 60
            </button>
          )}
          {!visible.length && (
            <div className="gp-empty">
              {mode === "unassigned"
                ? "No unassigned photos in this scan."
                : "Choose a place, or select photos from All scanned media to create one manually."}
            </div>
          )}
        </div>
      </div>
      {viewer && viewerItems.some((m) => m.id === viewer) && (
        <TripMediaViewer
          items={viewerItems}
          selected={viewer}
          onSelect={setViewer}
          onClose={closeViewer}
        />
      )}
    </section>
  );
}
