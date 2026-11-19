"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Aperture,
  ArrowLeft,
  Check,
  Cloud,
  CloudUpload,
  Film,
  Heart,
  ImageIcon,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  MapPin,
  MoreHorizontal,
} from "lucide-react";
import {
  R2,
  nativeR2Available,
  systemAction,
  storageError,
  bytes,
} from "@/lib/r2/native";
import type {
  StorageSummary,
  Transfer,
  CloudObject,
  BucketSlot,
} from "@/lib/r2/types";
import type {
  GalleryAccess,
  DeviceMedia,
  GalleryAsset,
  GalleryAssignment,
  StatusFilter,
} from "@/lib/gallery/types";
import {
  deviceAsset,
  cloudAsset,
  statusLabel,
  matchesStatus,
  assetAssignments,
  currentBucketTransfers,
  mediaStamp,
} from "@/lib/gallery/model";
import {
  galleryAssignments,
  readGalleryPreference,
  saveGalleryPreference,
} from "@/lib/gallery/store";
import { gallerySource } from "@/lib/gallery/actions";
import { useTripVault, notifyVaultChange } from "@/lib/vault/useTripVault";
import { patchTripFields } from "@/lib/vault/storage";
import { readTripCoverLibrary } from "@/lib/studio/trip-cover";
import { transferScheduleText } from "@/lib/r2/transfer-status";
import TripMediaViewer from "@/components/media/TripMediaViewer";
import { Modal } from "@/components/world/primitives";
import GalleryThumbnail from "./GalleryThumbnail";
import GalleryAssign from "./GalleryAssign";
import { useGalleryLayout } from "./useGalleryLayout";
import "./gallery.css";
import "./photos.css";
const GalleryPlaces = dynamic(() => import("./GalleryPlaces"), { ssr: false });
const GalleryTripControls = dynamic(() => import("./GalleryTripControls"), {
  ssr: false,
});
const initialAccess: GalleryAccess = {
  status: "denied",
  images: false,
  videos: false,
  limited: false,
};
export default function PhotoGallery() {
  const supported = nativeR2Available(),
    { trips } = useTripVault();
  const [access, setAccess] = useState(initialAccess),
    [view, setView] = useState<"device" | "cloud" | "trips" | "places">(
      "device",
    ),
    [items, setItems] = useState<DeviceMedia[]>([]),
    [cursor, setCursor] = useState(""),
    [hasMore, setHasMore] = useState(false),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [order, setOrder] = useState("newest"),
    [album, setAlbum] = useState(""),
    [allAlbums, setAllAlbums] = useState<{ name: string; count: number }[]>([]),
    [status, setStatus] = useState<StatusFilter>("all"),
    [tripFilter, setTripFilter] = useState(""),
    [placeFilter, setPlaceFilter] = useState(""),
    [assignments, setAssignments] = useState<GalleryAssignment[]>([]),
    [jobs, setJobs] = useState<Transfer[]>([]),
    [summary, setSummary] = useState<StorageSummary>(),
    [slot, setSlot] = useState<BucketSlot>("public"),
    [objects, setObjects] = useState<CloudObject[]>([]),
    [cloudCursor, setCloudCursor] = useState(""),
    [cloudMore, setCloudMore] = useState(false),
    [cloudLoaded, setCloudLoaded] = useState(false),
    [cached, setCached] = useState(false),
    [favorites, setFavorites] = useState<string[]>([]),
    [favoritesOnly, setFavoritesOnly] = useState(false),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [columns, setColumns] = useState(3),
    [selected, setSelected] = useState<string[]>([]),
    [selectionMedia, setSelectionMedia] = useState<Record<string, DeviceMedia>>(
      {},
    ),
    [assigning, setAssigning] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [detail, setDetail] = useState<GalleryAsset>(),
    [viewer, setViewer] = useState(""),
    [overrides, setOverrides] = useState<Record<string, Partial<GalleryAsset>>>(
      {},
    ),
    [drawer, setDrawer] = useState(false),
    [websiteControls, setWebsiteControls] = useState(false),
    [online, setOnline] = useState(true),
    [filtersOpen, setFiltersOpen] = useState(false);
  const grid = useRef<HTMLDivElement>(null),
    sentinel = useRef<HTMLDivElement>(null),
    deviceGeneration = useRef(0),
    cloudGeneration = useRef(0),
    opening = useRef(0),
    previewToken = useRef(""),
    lastSelection = useRef(""),
    checkedPublications = useRef(new Set<string>()),
    hold = useRef<{
      timer?: ReturnType<typeof setTimeout>;
      x: number;
      y: number;
      handled: boolean;
    }>({ x: 0, y: 0, handled: false });
  const report = (e: unknown) =>
    setError(
      e instanceof Error && !("code" in e) ? e.message : storageError(e),
    );
  const reloadJobs = useCallback(async () => {
    if (!supported) return;
    try {
      setJobs((await R2.getTransferProgress()).transfers);
    } catch {
      /* Device gallery remains available if cloud credentials/Keystore are unavailable. */
    }
  }, [supported]);
  useEffect(() => {
    let alive = true;
    void galleryAssignments()
      .then((v) => {
        if (alive) setAssignments(v);
      })
      .catch(() => {});
    void readGalleryPreference<string[]>("favorites", [])
      .then((v) => {
        if (alive) setFavorites(v);
      })
      .catch(() => {});
    void readGalleryPreference<number>(
      "photos-density",
      window.innerWidth < 701 ? 3 : 5,
    )
      .then((v) => {
        if (alive) setColumns(Math.max(2, Math.min(6, v)));
      })
      .catch(() => {});
    if (supported) {
      void R2.getGalleryAccess()
        .then((v) => {
          if (alive) setAccess(v);
        })
        .catch(report);
      void R2.getConfigurationSummary()
        .then((v) => {
          if (alive) setSummary(v);
        })
        .catch(() => {});
      queueMicrotask(() => void reloadJobs());
      void R2.setSensitiveScreen({ enabled: true }).catch(() => {});
    }
    const network = () => setOnline(navigator.onLine),
      focus = () => {
        if (supported)
          void R2.getGalleryAccess()
            .then((v) => {
              if (alive) setAccess(v);
              setRevision((r) => r + 1);
            })
            .catch(() => {});
      };
    queueMicrotask(network);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("focus", focus);
    window.addEventListener("life_atlas_vault_change", reloadJobs);
    return () => {
      alive = false;
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("focus", focus);
      window.removeEventListener("life_atlas_vault_change", reloadJobs);
      if (supported)
        void R2.setSensitiveScreen({ enabled: false }).catch(() => {});
    };
  }, [supported, reloadJobs]);
  useEffect(() => {
    if (!supported) return;
    const timer = setInterval(() => {
      if (
        !document.hidden &&
        (drawer ||
          jobs.some((j) => !["complete", "cancelled"].includes(j.status)))
      )
        void reloadJobs();
    }, 2500);
    return () => clearInterval(timer);
  }, [supported, reloadJobs, drawer, jobs]);
  useEffect(() => {
    if (!supported || access.status === "denied") return;
    let alive = true;
    void R2.getGalleryAlbums()
      .then((v) => {
        if (alive) setAllAlbums(v.albums);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [supported, access.status, revision]);
  useEffect(() => {
    const trip = trips.find((t) => t.id === tripFilter);
    if (!trip?.publishedSlug || checkedPublications.current.has(trip.id))
      return;
    checkedPublications.current.add(trip.id);
    void readTripCoverLibrary(trip.publishedSlug)
      .then((result) =>
        patchTripFields(trip.id, {
          websitePublishedMediaIds: result.media.map((m) => m.id),
        }),
      )
      .then(() => notifyVaultChange())
      .catch(() => {
        checkedPublications.current.delete(trip.id);
      });
  }, [tripFilter, trips]);
  const requestDevice = useCallback(
    async (next: string, append = false) => {
      if (!supported || access.status === "denied") return;
      const generation = ++deviceGeneration.current;
      setLoading(true);
      try {
        const page = await R2.listDeviceMedia({
          cursor: next,
          query,
          kind,
          album,
          order: order === "oldest" ? "oldest" : "newest",
        });
        if (generation !== deviceGeneration.current) return;
        setItems((old) =>
          append
            ? [
                ...new Map(
                  [...old, ...page.items].map((m) => [m.id, m]),
                ).values(),
              ]
            : page.items,
        );
        setCursor(page.cursor);
        setHasMore(!page.complete);
      } catch (e) {
        if (generation === deviceGeneration.current) report(e);
      } finally {
        if (generation === deviceGeneration.current) setLoading(false);
      }
    },
    [supported, access.status, query, kind, album, order],
  );
  useEffect(() => {
    if (view === "cloud" || view === "places") return;
    const generation = deviceGeneration;
    const timer = setTimeout(() => void requestDevice(""), 250);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [requestDevice, revision, view]);
  const requestCloud = useCallback(
    async (next: string, append = false) => {
      if (!supported) return;
      const generation = ++cloudGeneration.current,
        cacheKey = summary?.[slot].configured
          ? `cloud-${slot}-${summary[slot].storageScope || summary[slot].revision}`
          : null;
      setLoading(true);
      try {
        if (!navigator.onLine)
          throw Error("Offline · showing cached cloud metadata.");
        const page = await R2.listObjects({
          slot,
          prefix: slot === "public" ? "galleries/originals/" : "encrypted/",
          cursor: next,
          revision: summary?.[slot].revision,
        });
        if (generation !== cloudGeneration.current) return;
        const rows = page.objects.filter(
          (o) =>
            slot === "public" || /^encrypted\/(photos|videos)\//.test(o.key),
        );
        setObjects((old) => {
          const values = append
            ? [...new Map([...old, ...rows].map((o) => [o.key, o])).values()]
            : rows;
          if (cacheKey) void saveGalleryPreference(cacheKey, values);
          return values;
        });
        setCloudCursor(page.cursor);
        setCloudMore(!page.complete);
        setCloudLoaded(true);
        setCached(false);
      } catch (e) {
        const saved = cacheKey
          ? await readGalleryPreference<CloudObject[]>(cacheKey, [])
          : [];
        if (generation !== cloudGeneration.current) return;
        setObjects(saved);
        setCached(true);
        setCloudLoaded(true);
        setCloudMore(false);
        report(e);
      } finally {
        if (generation === cloudGeneration.current) setLoading(false);
      }
    },
    [supported, slot, summary],
  );
  useEffect(() => {
    if (view !== "cloud") return;
    const generation = cloudGeneration;
    queueMicrotask(() => {
      setObjects([]);
      setCloudLoaded(false);
      void requestCloud("");
    });
    return () => {
      generation.current++;
    };
  }, [view, requestCloud]);
  const deviceAssets = useMemo(() => {
    const latest = new Map<string, Transfer>();
    for (const job of currentBucketTransfers(jobs, summary)) {
      const key = `${job.galleryId}|${job.sourceStamp}`;
      if (!latest.has(key) || latest.get(key)!.createdAt < job.createdAt)
        latest.set(key, job);
    }
    return items.map((m) => {
      const job = latest.get(`${m.id}|${mediaStamp(m)}`);
      return deviceAsset(m, job ? [job] : []);
    });
  }, [items, jobs, summary]);
  const cloudAssets = useMemo(
    () =>
      objects.map((o) =>
        cloudAsset(
          o,
          slot,
          summary?.[slot].publicBaseUrl || "",
          jobs,
          summary?.[slot],
        ),
      ),
    [objects, slot, summary, jobs],
  );
  const assets = useMemo(() => {
    const list = (view === "cloud" ? cloudAssets : deviceAssets).map((a) => ({
      ...a,
      ...overrides[a.id],
    }));
    const result = list.filter((a) => {
      if (
        view === "cloud" &&
        query &&
        !a.name.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      if (view === "cloud" && kind !== "all" && a.kind !== kind) return false;
      if (dateFrom && a.date < new Date(dateFrom + "T00:00:00").getTime())
        return false;
      if (dateTo && a.date > new Date(dateTo + "T23:59:59.999").getTime())
        return false;
      if (!matchesStatus(a, status, trips)) return false;
      if (favoritesOnly && !favorites.includes(a.id)) return false;
      if (view === "trips" || tripFilter) {
        const assigned = assetAssignments(a, assignments, trips);
        if (
          !assigned.some(
            (x) =>
              (!tripFilter || x.tripId === tripFilter) &&
              (!placeFilter || x.placeId === placeFilter),
          )
        )
          return false;
      }
      return true;
    });
    return order === "largest"
      ? [...result].sort((a, b) => b.size - a.size)
      : order === "name"
        ? [...result].sort((a, b) => a.name.localeCompare(b.name))
        : view === "cloud"
          ? [...result].sort((a, b) =>
              order === "oldest" ? a.date - b.date : b.date - a.date,
            )
          : result;
  }, [
    view,
    deviceAssets,
    cloudAssets,
    overrides,
    query,
    kind,
    status,
    trips,
    favoritesOnly,
    favorites,
    tripFilter,
    placeFilter,
    assignments,
    order,
    dateFrom,
    dateTo,
  ]);
  const activeFilters =
    (status !== "all" ? 1 : 0) +
    (order !== "newest" ? 1 : 0) +
    (album ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);
  const layout = useGalleryLayout(
    assets,
    columns,
    grid,
    order === "newest" || order === "oldest",
    view + String(filtersOpen),
  );
  const chosen = selected.flatMap((id) => {
      const record = selectionMedia[id] || items.find((m) => m.id === id);
      return record ? [record] : [];
    }),
    pending = jobs.filter((j) => !["complete", "cancelled"].includes(j.status)),
    albums = allAlbums.length
      ? allAlbums
      : [...new Set(items.map((m) => m.album).filter(Boolean))].map((name) => ({
          name,
          count: 0,
        }));
  const more = view === "cloud" ? cloudMore : hasMore;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !more || loading || !layout.ready) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (view === "cloud") void requestCloud(cloudCursor, true);
          else void requestDevice(cursor, true);
        }
      },
      { rootMargin: "500px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    more,
    loading,
    view,
    requestCloud,
    cloudCursor,
    requestDevice,
    cursor,
    layout.ready,
  ]);
  useEffect(() => {
    const node = grid.current;
    if (!node) return;
    let start = 0;
    const begin = (e: TouchEvent) => {
      if (e.touches.length === 2)
        start = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !start) return;
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (Math.abs(distance - start) > 45) {
        setColumns((c) => {
          const next = Math.max(
            2,
            Math.min(6, c + (distance > start ? -1 : 1)),
          );
          void saveGalleryPreference("photos-density", next);
          return next;
        });
        start = distance;
      }
    };
    node.addEventListener("touchstart", begin, { passive: true });
    node.addEventListener("touchmove", move, { passive: false });
    return () => {
      node.removeEventListener("touchstart", begin);
      node.removeEventListener("touchmove", move);
    };
  }, [access.status, supported, view]);
  const closeViewer = useCallback(() => {
    opening.current++;
    setViewer("");
    if (previewToken.current) {
      void R2.releaseGalleryPreview({ token: previewToken.current }).catch(
        () => {},
      );
      previewToken.current = "";
    }
  }, []);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) closeViewer();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      if (previewToken.current)
        void R2.releaseGalleryPreview({ token: previewToken.current }).catch(
          () => {},
        );
      if (hold.current.timer) clearTimeout(hold.current.timer);
    };
  }, [closeViewer]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function permission() {
    await run(async () => {
      setAccess(await systemAction(() => R2.requestGalleryAccess()));
      setRevision((r) => r + 1);
    });
  }
  async function checkCloud() {
    await run(async () => {
      for (let i = 0; i < chosen.length; i += 30) {
        setNotice(
          `Checking known cloud copies · ${i + 1}–${Math.min(i + 30, chosen.length)} of ${chosen.length}`,
        );
        const result = await systemAction(() =>
          R2.checkDeviceCloud({
            ids: chosen.slice(i, i + 30).map((m) => m.id),
          }),
        );
        setItems((old) =>
          old.map((item) => {
            const checked = result.items.find((c) => c.id === item.id);
            return checked ? { ...item, copies: checked.copies } : item;
          }),
        );
      }
      setNotice(
        "Cloud check finished. “No matching known upload” checks saved history, not every object uploaded elsewhere.",
      );
    });
  }
  function toggle(id: string, range = false) {
    setSelectionMedia((old) => ({
      ...old,
      ...Object.fromEntries(
        assets.flatMap((a) => (a.device ? [[a.id, a.device]] : [])),
      ),
    }));
    const start = assets.findIndex((a) => a.id === lastSelection.current),
      end = assets.findIndex((a) => a.id === id);
    setSelected((old) => {
      const next =
        range && start >= 0
          ? new Set([
              ...old,
              ...assets
                .slice(Math.min(start, end), Math.max(start, end) + 1)
                .map((a) => a.id),
            ])
          : new Set(old);
      if (!range) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return [...next].slice(0, 100);
    });
    lastSelection.current = id;
  }
  async function favorite(id: string) {
    const values = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(values);
    try {
      await saveGalleryPreference("favorites", values);
    } catch (e) {
      report(e);
    }
  }
  async function openAsset(asset: GalleryAsset) {
    if (selected.length && asset.device) {
      toggle(asset.id);
      return;
    }
    await run(async () => {
      const epoch = ++opening.current;
      if (asset.device) {
        setViewer(asset.id);
        return;
      }
      if (asset.slot === "private" && asset.key) {
        const result = await systemAction(() =>
          R2.openGalleryCloudPreview({ key: asset.key! }),
        );
        if (epoch !== opening.current) {
          void R2.releaseGalleryPreview({ token: result.token });
          return;
        }
        if (previewToken.current)
          void R2.releaseGalleryPreview({ token: previewToken.current });
        previewToken.current = result.token;
        setOverrides((old) => ({
          ...old,
          [asset.id]: {
            url: gallerySource(result.path),
            name: result.name,
            mimeType: result.mimeType,
            kind: result.mimeType.startsWith("video/") ? "video" : "photo",
          },
        }));
        setViewer(asset.id);
        return;
      }
      if (asset.kind === "unknown" && asset.key && asset.slot) {
        const metadata = await R2.getObjectMetadata({
          slot: asset.slot,
          key: asset.key,
        });
        const mime = metadata.mimeType || "";
        if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
          setDetail(asset);
          return;
        }
        setOverrides((old) => ({
          ...old,
          [asset.id]: {
            mimeType: mime,
            kind: mime.startsWith("video/") ? "video" : "photo",
          },
        }));
      }
      setViewer(asset.id);
    });
  }
  const viewerAssets = assets.filter(
    (a) =>
      a.url &&
      a.kind !== "unknown" &&
      (a.slot !== "private" || a.id === viewer),
  );
  return (
    <main
      className={`private-gallery${view === "places" ? " has-place-organizer" : ""}`}
    >
      <header className="pg-top">
        <div className="pg-brand">
          <Link href="/secret" aria-label="Back to Private Atlas">
            <ArrowLeft size={20} />
          </Link>
          <Aperture size={29} strokeWidth={1.8} />
          <span>
            Atlas <strong>Photos</strong>
          </span>
        </div>
        <label className="pg-search">
          <Search size={16} />
          <input
            aria-label="Search gallery"
            type="search"
            placeholder="Search filenames"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="pg-header-actions">
          <button
            aria-label="Open transfer queue"
            onClick={() => setDrawer(true)}
          >
            <CloudUpload size={21} />
            {pending.length > 0 && <b>{pending.length}</b>}
          </button>
          <Link
            href="/secret/studio"
            aria-label="Open Creator Studio"
            className="pg-studio-link"
          >
            <span>Studio</span>
            <ArrowLeft size={17} style={{ transform: "rotate(135deg)" }} />
          </Link>
        </div>
      </header>
      <div className="pg-toolbar">
        <nav aria-label="Gallery views">
          {(["device", "cloud", "trips", "places"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              aria-label={
                v === "device"
                  ? "On my phone"
                  : v === "cloud"
                    ? "In the cloud"
                    : v === "places"
                      ? "Places organizer"
                      : "Trips & places"
              }
              onClick={() => {
                setView(v);
                setSelected([]);
                if (v !== "trips") {
                  setTripFilter("");
                  setPlaceFilter("");
                }
                setError("");
              }}
            >
              {v === "device" ? (
                <ImageIcon size={17} />
              ) : v === "cloud" ? (
                <Cloud size={17} />
              ) : v === "places" ? (
                <MapPin size={20} />
              ) : (
                <Aperture size={20} />
              )}{" "}
              {v === "device"
                ? "Photos"
                : v === "cloud"
                  ? "Cloud"
                  : v === "places"
                    ? "Places"
                    : "Trips"}
            </button>
          ))}
        </nav>
        <div className="pg-rail-footer">
          <Link href="/secret/studio">Creator Studio ↗</Link>
          <small>Originals stay original.</small>
        </div>
        <button className="pg-rail-transfers" onClick={() => setDrawer(true)}>
          <CloudUpload size={17} /> Transfers{" "}
          {pending.length > 0 && <b>{pending.length}</b>}
        </button>
      </div>
      <section className="pg-page-heading">
        <div>
          <h1>
            {view === "device"
              ? "Photos"
              : view === "cloud"
                ? "Cloud library"
                : view === "trips"
                  ? "Trips & albums"
                  : "Places"}
          </h1>
          <p>
            {view === "device"
              ? "Your photos and videos, all together."
              : view === "cloud"
                ? "Browse your public and encrypted private originals."
                : view === "trips"
                  ? "Collected by journey. Organized by place."
                  : "Find familiar places in your photo library."}
          </p>
        </div>
        {view !== "places" && (
          <button
            aria-label="Gallery filters"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal size={18} />
            <span>Filters{activeFilters ? ` · ${activeFilters}` : ""}</span>
          </button>
        )}
      </section>
      {!supported ? (
        <section className="pg-permission">
          <ShieldCheck size={34} />
          <h2>My gallery lives on my phone.</h2>
          <p>
            Open Gallery in the Android app to browse accessible device photos,
            check cloud copies and upload originals. A browser cannot enumerate
            the phone’s media library.
          </p>
          <Link href="/secret/studio">Open Creator Studio</Link>
        </section>
      ) : (
        <>
          <div className="pg-access">
            <span>
              <span className={`pg-dot ${online ? "" : "is-offline"}`} />
              {!online
                ? "Offline · local originals remain available"
                : access.status === "full"
                  ? "Full photo & video access"
                  : access.status === "limited"
                    ? "Limited access · showing what Android allows"
                    : "Photo & video access needed"}
            </span>
            <div>
              {access.status !== "full" && (
                <button disabled={busy} onClick={() => void permission()}>
                  {access.status === "limited"
                    ? "Choose more photos"
                    : "Allow photo & video access"}
                </button>
              )}
              <button
                onClick={() =>
                  void systemAction(() => R2.openGallerySettings())
                }
              >
                Permissions
              </button>
              <button
                aria-label="Refresh gallery"
                onClick={() => {
                  setRevision((v) => v + 1);
                  void R2.getConfigurationSummary()
                    .then(setSummary)
                    .catch(() => {});
                  if (view === "cloud") void requestCloud("");
                }}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          {view === "places" ? (
            <GalleryPlaces search={query} onSearch={setQuery} />
          ) : view !== "cloud" && access.status === "denied" ? (
            <section className="pg-permission">
              <ImageIcon size={36} />
              <h2>Let my memories in.</h2>
              <p>
                Grant full access for all accessible photos and videos, or
                choose specific media. Nothing uploads just because it appears
                here.
              </p>
              <button
                className="pg-primary"
                disabled={busy}
                onClick={() => void permission()}
              >
                Choose photo access
              </button>
            </section>
          ) : (
            <>
              {view === "cloud" && (
                <div
                  className="pg-cloud-tabs"
                  aria-label="Cloud storage visibility"
                >
                  <button
                    aria-pressed={slot === "public"}
                    onClick={() => setSlot("public")}
                  >
                    <Cloud size={15} /> Public originals
                  </button>
                  <button
                    aria-pressed={slot === "private"}
                    onClick={() => setSlot("private")}
                  >
                    <ShieldCheck size={15} /> Encrypted private
                  </button>
                </div>
              )}
              <div className="pg-quick-filters">
                <button
                  aria-pressed={kind === "all"}
                  onClick={() => setKind("all")}
                >
                  All
                </button>
                <button
                  aria-pressed={kind === "photo"}
                  onClick={() => setKind("photo")}
                >
                  <ImageIcon size={15} /> Photos
                </button>
                <button
                  aria-pressed={kind === "video"}
                  onClick={() => setKind("video")}
                >
                  <Film size={15} /> Videos
                </button>
                <button
                  aria-pressed={favoritesOnly}
                  onClick={() => setFavoritesOnly((v) => !v)}
                >
                  <Heart size={15} /> Favorites
                </button>
                <button
                  aria-pressed={filtersOpen}
                  onClick={() => setFiltersOpen((v) => !v)}
                >
                  <MoreHorizontal size={18} /> More
                </button>
              </div>
              <div className="pg-filters" hidden={!filtersOpen}>
                <select
                  aria-label="Media type"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="all">Photos & videos</option>
                  <option value="photo">Photos</option>
                  <option value="video">Videos</option>
                </select>
                <select
                  aria-label="Cloud status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="unchecked">Not checked</option>
                  <option value="not-found">No known upload</option>
                  <option value="cloud">Cloud copies</option>
                  <option value="pending">Pending uploads</option>
                  <option value="failed">Needs attention</option>
                  <option value="published">Website published</option>
                </select>
                <select
                  aria-label="Sort gallery"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="largest">Largest · loaded media</option>
                  <option value="name">Name · loaded media</option>
                </select>
                {view === "cloud" ? (
                  <select
                    aria-label="Cloud bucket"
                    value={slot}
                    onChange={(e) => setSlot(e.target.value as BucketSlot)}
                  >
                    <option value="public">Public bucket</option>
                    <option value="private">Encrypted private bucket</option>
                  </select>
                ) : (
                  <select
                    aria-label="Device album"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                  >
                    <option value="">All device albums</option>
                    {albums.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                        {a.count ? ` (${a.count})` : ""}
                      </option>
                    ))}
                  </select>
                )}
                <label className="pg-date-filter">
                  From
                  <input
                    type="date"
                    aria-label="Gallery start date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="pg-date-filter">
                  To
                  <input
                    type="date"
                    aria-label="Gallery end date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
                <button
                  aria-pressed={favoritesOnly}
                  aria-label="Show favorites"
                  onClick={() => setFavoritesOnly((v) => !v)}
                >
                  <Heart size={17} />
                </button>
                <label className="pg-density">
                  <SlidersHorizontal size={16} />
                  <input
                    aria-label="Gallery density"
                    type="range"
                    min={2}
                    max={6}
                    value={columns}
                    onChange={(e) => {
                      setColumns(+e.target.value);
                      void saveGalleryPreference(
                        "photos-density",
                        +e.target.value,
                      );
                    }}
                  />
                </label>
              </div>
              {(view === "trips" || tripFilter) && (
                <div className="pg-trip-filter">
                  <select
                    aria-label="Filter by trip"
                    value={tripFilter}
                    onChange={(e) => {
                      setTripFilter(e.target.value);
                      setPlaceFilter("");
                    }}
                  >
                    <option value="">All assigned trips</option>
                    {trips.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by place"
                    value={placeFilter}
                    onChange={(e) => setPlaceFilter(e.target.value)}
                  >
                    <option value="">All places</option>
                    {trips
                      .find((t) => t.id === tripFilter)
                      ?.websitePlaces?.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {view === "trips" && tripFilter && (
                <div className="pg-website-wrap">
                  <button
                    className="pg-website-toggle"
                    aria-expanded={websiteControls}
                    onClick={() => setWebsiteControls((v) => !v)}
                  >
                    {websiteControls ? "Hide" : "Open"} this trip’s website &
                    cover controls
                  </button>
                  {websiteControls &&
                    trips.find((t) => t.id === tripFilter) && (
                      <GalleryTripControls
                        trip={trips.find((t) => t.id === tripFilter)!}
                      />
                    )}
                </div>
              )}
              <div className="pg-count">
                <span>
                  {assets.length} loaded{" "}
                  {view === "cloud" ? "cloud files" : "moments"}{" "}
                  {loading ? "· Loading…" : ""}
                  {cached ? " · Cached cloud listing" : ""}
                </span>
                <div>
                  <button onClick={() => setView("trips")}>
                    Browse by journey
                  </button>
                  {view !== "cloud" && (
                    <button
                      onClick={() => {
                        setSelectionMedia((old) => ({
                          ...old,
                          ...Object.fromEntries(
                            assets.flatMap((a) =>
                              a.device ? [[a.id, a.device]] : [],
                            ),
                          ),
                        }));
                        setSelected(
                          assets
                            .filter((a) => a.device)
                            .slice(0, 100)
                            .map((a) => a.id),
                        );
                      }}
                    >
                      Select loaded · max 100
                    </button>
                  )}
                </div>
              </div>
              <div
                ref={grid}
                className="pg-grid"
                data-density={columns}
                style={{ height: layout.height }}
              >
                {layout.headers.map((day) => (
                  <div
                    className="pg-date-heading"
                    key={day.key}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: day.y,
                      height: 40,
                    }}
                  >
                    <h2>{day.label}</h2>
                    {view !== "cloud" && (
                      <button
                        aria-label={`Select photos from ${day.label}`}
                        aria-pressed={
                          day.indices.length > 0 &&
                          day.indices.every((i) =>
                            selected.includes(assets[i].id),
                          )
                        }
                        onClick={() => {
                          const dayAssets = day.indices
                            .map((i) => assets[i])
                            .filter((a) => a.device)
                            .slice(0, 100);
                          setSelectionMedia((old) => ({
                            ...old,
                            ...Object.fromEntries(
                              dayAssets.map((a) => [a.id, a.device!]),
                            ),
                          }));
                          const ids = dayAssets.map((a) => a.id),
                            all = ids.every((id) => selected.includes(id));
                          const next = all
                            ? selected.filter((id) => !ids.includes(id))
                            : [...new Set([...selected, ...ids])];
                          if (next.length > 100)
                            setNotice(
                              "Select up to 100 files per batch. Your existing selection is kept.",
                            );
                          setSelected(next.slice(0, 100));
                        }}
                      >
                        <Check size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {layout.visible.map((position) => {
                  const asset = assets[position.index];
                  return (
                    <article
                      key={asset.id}
                      className={`pg-tile ${selected.includes(asset.id) ? "is-selected" : ""} ${selected.length ? "in-selection-mode" : ""}`}
                      style={{
                        position: "absolute",
                        left: position.x,
                        top: position.y,
                        width: position.width,
                        height: position.height,
                      }}
                    >
                      <button
                        className="pg-open"
                        aria-label={`Open ${asset.name}`}
                        onContextMenu={(e) => {
                          if (asset.device) e.preventDefault();
                        }}
                        onPointerDown={(e) => {
                          if (e.pointerType !== "touch" || !asset.device)
                            return;
                          if (hold.current.timer)
                            clearTimeout(hold.current.timer);
                          if (!e.isPrimary) return;
                          hold.current = {
                            x: e.clientX,
                            y: e.clientY,
                            handled: false,
                            timer: setTimeout(() => {
                              hold.current.handled = true;
                              toggle(asset.id);
                            }, 500),
                          };
                        }}
                        onPointerMove={(e) => {
                          if (
                            Math.hypot(
                              e.clientX - hold.current.x,
                              e.clientY - hold.current.y,
                            ) > 12 &&
                            hold.current.timer
                          )
                            clearTimeout(hold.current.timer);
                        }}
                        onPointerUp={() => {
                          if (hold.current.timer)
                            clearTimeout(hold.current.timer);
                        }}
                        onPointerCancel={() => {
                          if (hold.current.timer)
                            clearTimeout(hold.current.timer);
                        }}
                        onClick={(event) => {
                          if (hold.current.handled) {
                            hold.current.handled = false;
                            return;
                          }
                          if (selected.length && asset.device) {
                            toggle(asset.id, event.shiftKey);
                            return;
                          }
                          void openAsset(asset);
                        }}
                      >
                        <GalleryThumbnail
                          key={
                            asset.device
                              ? `${asset.id}|${mediaStamp(asset.device)}`
                              : asset.thumbnail || asset.id
                          }
                          asset={asset}
                        />
                      </button>
                      <div className="pg-tile-top">
                        {asset.device && (
                          <button
                            className="pg-select"
                            aria-label={`Select ${asset.name}`}
                            aria-pressed={selected.includes(asset.id)}
                            onClick={(e) => toggle(asset.id, e.shiftKey)}
                          >
                            {selected.includes(asset.id) ? (
                              <Check size={16} />
                            ) : (
                              <span />
                            )}
                          </button>
                        )}
                        <span className="pg-kind">
                          {asset.kind === "video" ? (
                            <Film size={13} />
                          ) : asset.slot === "private" ? (
                            <ShieldCheck size={13} />
                          ) : null}
                          {asset.kind === "video" && asset.device?.duration
                            ? `${Math.floor(asset.device.duration / 60000)}:${String(Math.floor(asset.device.duration / 1000) % 60).padStart(2, "0")}`
                            : ""}
                        </span>
                        <button
                          className="pg-favorite"
                          aria-pressed={favorites.includes(asset.id)}
                          aria-label={`Favorite ${asset.name}`}
                          onClick={() => void favorite(asset.id)}
                        >
                          <Heart
                            size={16}
                            fill={
                              favorites.includes(asset.id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </div>
                      <div className="pg-tile-bottom">
                        <span>{statusLabel(asset, trips)}</span>
                        <button
                          aria-label={`Details for ${asset.name}`}
                          onClick={() => setDetail(asset)}
                        >
                          <Info size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!assets.length && !loading && (
                <div className="pg-empty">
                  <Aperture size={38} strokeWidth={1} />
                  <h2>
                    {view === "trips"
                      ? "A place for every memory."
                      : "Nothing in this view yet."}
                  </h2>
                  <p>
                    {view === "trips"
                      ? "Select phone photos and add them to a trip and place."
                      : "Try another filter, check permissions or refresh the listing."}
                  </p>
                  {view === "cloud" && cloudLoaded && (
                    <Link href="/secret/control-room">
                      Configure Cloud Storage ↗
                    </Link>
                  )}
                </div>
              )}
              <div ref={sentinel} className="pg-more">
                {more && (
                  <button
                    disabled={loading}
                    onClick={() =>
                      view === "cloud"
                        ? void requestCloud(cloudCursor, true)
                        : void requestDevice(cursor, true)
                    }
                  >
                    {loading ? "Loading more…" : "Load next page"}
                  </button>
                )}
              </div>
              <p className="pg-footnote">
                Cloud checks compare exact file content with this installation’s
                known uploads. Unchecked files are never labelled “not
                uploaded.” Filters apply to loaded results; more pages load as
                you scroll.
              </p>
            </>
          )}
        </>
      )}
      {notice && (
        <p role="status" className="pg-notice">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="pg-error">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </p>
      )}
      {selected.length > 0 && (
        <aside className="pg-selection" aria-label="Selected media actions">
          <strong>{selected.length} selected</strong>
          {selected.length === 1 && chosen[0] && (
            <button
              onClick={() =>
                setDetail(
                  assets.find((a) => a.id === selected[0]) ||
                    deviceAsset(
                      chosen[0],
                      currentBucketTransfers(jobs, summary),
                    ),
                )
              }
            >
              Details
            </button>
          )}
          <button disabled={busy} onClick={() => setAssigning(true)}>
            <CloudUpload size={17} /> Add to trip / upload
          </button>
          <button disabled={busy || !online} onClick={() => void checkCloud()}>
            {busy ? "Working…" : "Check cloud"}
          </button>
          <button aria-label="Clear selection" onClick={() => setSelected([])}>
            <X size={18} />
          </button>
        </aside>
      )}
      {assigning && (
        <GalleryAssign
          media={chosen}
          trips={trips}
          onClose={() => setAssigning(false)}
          onSaved={(message) => {
            setNotice(message);
            setAssigning(false);
            setSelected([]);
            setRevision((v) => v + 1);
            void galleryAssignments().then(setAssignments);
            void reloadJobs();
          }}
        />
      )}
      {viewer && viewerAssets.some((a) => a.id === viewer) && (
        <TripMediaViewer
          selected={viewer}
          variant="library"
          onDetails={(id) => {
            closeViewer();
            setDetail(assets.find((a) => a.id === id));
          }}
          onSelect={setViewer}
          onClose={closeViewer}
          items={viewerAssets.map((a) => ({
            id: a.id,
            url: a.device ? gallerySource(a.device.uri) : a.url!,
            poster: a.thumbnail,
            kind: a.kind === "video" ? "video" : "photo",
            place: a.device?.album || "My gallery",
            category: statusLabel(a, trips),
            caption: `${a.name} · ${bytes(a.size)}`,
          }))}
        />
      )}
      {detail && (
        <Modal
          title="Frame details"
          onClose={() => setDetail(undefined)}
          className="pg-dialog"
        >
          <h2>{detail.name}</h2>
          <dl className="pg-details">
            <div>
              <dt>Storage</dt>
              <dd>{statusLabel(detail, trips)}</dd>
            </div>
            <div>
              <dt>Original size</dt>
              <dd>{bytes(detail.size)}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{detail.mimeType || "Read metadata to inspect format"}</dd>
            </div>
            {detail.device && (
              <>
                {Object.entries(detail.device.copies || {}).map(
                  ([name, copy]) => (
                    <div key={name}>
                      <dt>{name} check</dt>
                      <dd>
                        {copy.state} ·{" "}
                        {new Date(copy.checkedAt).toLocaleString()}
                      </dd>
                    </div>
                  ),
                )}
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {detail.device.width} × {detail.device.height}
                  </dd>
                </div>
                <div>
                  <dt>Device album</dt>
                  <dd>{detail.device.album || "Unspecified"}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Added / uploaded</dt>
              <dd>
                {Number.isFinite(detail.date)
                  ? new Date(detail.date).toLocaleString()
                  : "Unknown"}
              </dd>
            </div>
          </dl>
          {assetAssignments(detail, assignments, trips).map((a) => (
            <p key={a.id}>
              {trips.find((t) => t.id === a.tripId)?.title} /{" "}
              {
                trips
                  .find((t) => t.id === a.tripId)
                  ?.websitePlaces?.find((p) => p.id === a.placeId)?.name
              }
            </p>
          ))}
          <div className="pg-action-row">
            <button
              aria-pressed={favorites.includes(detail.id)}
              onClick={() => void favorite(detail.id)}
            >
              <Heart size={16} />
              {favorites.includes(detail.id)
                ? "Remove favorite"
                : "Add to favorites"}
            </button>
            <button
              onClick={() => {
                setDetail(undefined);
                void openAsset(detail);
              }}
            >
              View original
            </button>
            {detail.device && (
              <button
                onClick={() => {
                  setSelectionMedia((old) => ({
                    ...old,
                    [detail.id]: detail.device!,
                  }));
                  setSelected([detail.id]);
                  setDetail(undefined);
                  setAssigning(true);
                }}
              >
                Add to a trip
              </button>
            )}
            {detail.key && detail.slot && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await systemAction(() =>
                      R2.downloadObject({
                        slot: detail.slot!,
                        key: detail.key!,
                        name: detail.name,
                      }),
                    );
                    setNotice("Original download queued in Cloud Storage.");
                  })
                }
              >
                Download original
              </button>
            )}
            {detail.url && detail.slot === "public" && (
              <button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(detail.url!)
                    .then(() => setNotice("Public URL copied."))
                }
              >
                Copy public URL
              </button>
            )}
          </div>
          <p className="pg-muted">
            No local original is deleted by this gallery. Website publishing
            remains an explicit review in Creator Studio.
          </p>
        </Modal>
      )}
      {drawer && (
        <Modal
          title="Transfer queue"
          onClose={() => setDrawer(false)}
          className="pg-dialog"
        >
          <p className="pg-muted">
            Native uploads continue independently of this screen. Android may
            delay background work.
          </p>
          {jobs
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 100)
            .map((job) => (
              <div className="pg-transfer" key={job.id}>
                <strong>{job.name}</strong>
                <span>
                  {job.reused ? "Reused existing copy" : job.status} ·{" "}
                  {job.slot}
                </span>
                <progress
                  max={job.totalBytes || 1}
                  value={
                    job.verified
                      ? job.totalBytes
                      : job.status === "verifying"
                        ? job.verifiedBytes
                        : job.uploadedBytes
                  }
                />
                <p>
                  {transferScheduleText(job) ||
                    `${bytes(job.uploadedBytes)} / ${bytes(job.totalBytes)}`}
                </p>
                {job.error && (
                  <p className="pg-error">
                    {storageError({ code: job.error })}
                  </p>
                )}
                <div className="pg-action-row">
                  {job.canRecover && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await R2.recoverTripUploads();
                          await reloadJobs();
                        })
                      }
                    >
                      Restore approved queue
                    </button>
                  )}
                  {["failed", "paused", "interrupted"].includes(job.status) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await systemAction(() =>
                            R2.resumeTransfer({ id: job.id }),
                          );
                          await reloadJobs();
                        })
                      }
                    >
                      Retry / resume
                    </button>
                  )}
                  {["queued", "preparing", "uploading", "verifying"].includes(
                    job.status,
                  ) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await R2.pauseTransfer({ id: job.id });
                          await reloadJobs();
                        })
                      }
                    >
                      Pause
                    </button>
                  )}
                  {!["complete", "cancelled", "cancelling"].includes(
                    job.status,
                  ) && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "Cancel this transfer? Local originals stay on the phone.",
                          )
                        )
                          void run(async () => {
                            await systemAction(() =>
                              R2.cancelTransfer({ id: job.id }),
                            );
                            await reloadJobs();
                          });
                      }}
                    >
                      Cancel transfer
                    </button>
                  )}
                </div>
              </div>
            ))}
          {!jobs.length && <p>No transfers yet.</p>}
          <Link href="/secret/control-room">Open Cloud Storage ↗</Link>
        </Modal>
      )}
    </main>
  );
}
