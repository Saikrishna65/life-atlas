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
  Trash2,
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
import { useGalleryBack } from "@/lib/gallery/navigation";
import { cachedThumbnail } from "./GalleryThumbnail";
import PhotoViewer from "./PhotoViewer";
import { Modal } from "@/components/world/primitives";
import GalleryThumbnail from "./GalleryThumbnail";
import GalleryAssign from "./GalleryAssign";
import { useGalleryLayout } from "./useGalleryLayout";
import "./gallery.css";
import "./photos.css";
import GalleryCollections from "./GalleryCollections";
import GalleryStorageHome from "./GalleryStorageHome";
import "./gallery-workspace.css";
import "./gallery-intelligence.css";
import type {
  CollectionKind,
  SmartCollection,
} from "@/lib/gallery/collections";
import "./smart-collections.css";
const GalleryRecoveryPanel = dynamic(() => import("./GalleryRecoveryPanel"), {
  ssr: false,
});
const GallerySmartCollections = dynamic(
  () => import("./GallerySmartCollections"),
  { ssr: false },
);
import type { GalleryIntelligenceStatus } from "@/lib/gallery/intelligence";
const GalleryIntelligencePanel = dynamic(
  () => import("./GalleryIntelligencePanel"),
  { ssr: false },
);
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
    [view, setView] = useState<
      "device" | "cloud" | "trips" | "places" | "curated"
    >("device"),
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
    [maxColumns, setMaxColumns] = useState(6),
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
    [filtersOpen, setFiltersOpen] = useState(false),
    [selectionMode, setSelectionMode] = useState(false),
    [workspace, setWorkspace] = useState<"photos" | "organize" | "backup">(
      "photos",
    ),
    [collectionOpen, setCollectionOpen] = useState(false),
    [searchOpen, setSearchOpen] = useState(false);
  const [intelligence, setIntelligence] = useState<GalleryIntelligenceStatus>();
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [smartMode, setSmartMode] = useState<CollectionKind>();
  const [curated, setCurated] = useState<SmartCollection>();
  const [analysisGoal, setAnalysisGoal] = useState<"similar" | "people">();
  const [searchMode, setSearchMode] = useState<"files" | "smart">("files");
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    void Promise.resolve()
      .then(() => R2.getGalleryIntelligence())
      .then((value) => {
        if (alive) setIntelligence(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [supported, revision]);
  useGalleryBack(
    assigning || !!detail || websiteControls || drawer,
    () => {
      setAssigning(false);
      setDetail(undefined);
      setWebsiteControls(false);
      setDrawer(false);
    },
    90,
  );
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    const changed = () => {
      if (!alive) return;
      setRevision((v) => v + 1);
      window.dispatchEvent(new Event("atlas:gallery-analysis"));
    };
    const subscription = R2.addListener("galleryChanged", changed);
    const restored = () => {
      void R2.getGalleryMediaPreferences()
        .then((v) => {
          if (alive && v.favorites) {
            setFavorites(v.favorites);
            void saveGalleryPreference("favorites", v.favorites);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("atlas:gallery-restored", restored);
    return () => {
      alive = false;
      void subscription.then((s) => s.remove()).catch(() => {});
      window.removeEventListener("atlas:gallery-restored", restored);
    };
  }, [supported]);
  const analysisState = intelligence?.state;
  useEffect(() => {
    if (
      !supported ||
      !analysisState ||
      ["ready", "off", "paused", "error"].includes(analysisState)
    )
      return;
    let alive = true;
    const timer = setInterval(() => {
      if (document.hidden) return;
      void R2.getGalleryIntelligence()
        .then((v) => {
          if (!alive) return;
          setIntelligence(v);
          if (v.state === "ready") {
            setRevision((n) => n + 1);
            window.dispatchEvent(new Event("atlas:gallery-analysis"));
          }
        })
        .catch(() => {});
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [supported, analysisState]);
  const browsing = workspace === "photos" || collectionOpen;
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
  useEffect(() => {
    const fit = () => {
      const limit = window.innerWidth < 701 ? 3 : 6;
      setMaxColumns(limit);
      setColumns((value) => Math.min(value, limit));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
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
      .then(async (v) => {
        if (supported) {
          try {
            const native = await R2.getGalleryMediaPreferences();
            if (native.favorites) v = native.favorites;
            else if (v.length)
              await R2.saveGalleryMediaPreferences({ favorites: v });
          } catch {}
        }
        if (alive) setFavorites(v);
      })
      .catch(() => {});
    void readGalleryPreference<number>(
      "photos-density",
      window.innerWidth < 701 ? 3 : 5,
    )
      .then((v) => {
        if (alive)
          setColumns(Math.max(2, Math.min(window.innerWidth < 701 ? 3 : 6, v)));
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
        const smart =
          searchMode === "smart" && !!query.trim() && kind !== "video";
        const page =
          view === "curated" && curated
            ? await R2.getGalleryCollectionMedia({
                kind:
                  curated.kind === "similar"
                    ? "similar"
                    : curated.kind === "people"
                      ? "people"
                      : "memories",
                key: curated.id,
                cursor: next,
              })
            : smart
              ? await R2.searchGalleryIntelligence({
                  query,
                  album,
                  kind,
                  offset: next ? Number(next) : 0,
                })
              : await R2.listDeviceMedia({
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
    [
      supported,
      access.status,
      query,
      kind,
      album,
      order,
      searchMode,
      view,
      curated,
    ],
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
      const asset = deviceAsset(m, job ? [job] : []);
      return view === "curated" && m.capturedAt && m.capturedAt > 0
        ? { ...asset, date: m.capturedAt }
        : asset;
    });
  }, [items, jobs, summary, view]);
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
    if (
      view !== "cloud" &&
      searchMode === "smart" &&
      query.trim() &&
      kind !== "video"
    )
      return result;
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
    searchMode,
  ]);
  const layout = useGalleryLayout(
    assets,
    columns,
    grid,
    (order === "newest" || order === "oldest") &&
      !(
        view !== "cloud" &&
        searchMode === "smart" &&
        query.trim() &&
        kind !== "video"
      ),
    view + String(filtersOpen) + workspace + String(collectionOpen),
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
    browsing,
    workspace,
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
            Math.min(maxColumns, c + (distance > start ? -1 : 1)),
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
  }, [access.status, supported, view, maxColumns, browsing, workspace]);
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
  useGalleryBack(
    workspace !== "photos" ||
      collectionOpen ||
      searchOpen ||
      selectionMode ||
      !!detail ||
      assigning ||
      intelligenceOpen ||
      drawer ||
      websiteControls,
    () => {
      if (intelligenceOpen) {
        setIntelligenceOpen(false);
        return;
      }
      if (assigning) {
        setAssigning(false);
        return;
      }
      if (detail) {
        setDetail(undefined);
        return;
      }
      if (websiteControls) {
        setWebsiteControls(false);
        return;
      }
      if (drawer) {
        setDrawer(false);
        return;
      }
      if (selectionMode) {
        setSelectionMode(false);
        setSelected([]);
        return;
      }
      if (searchOpen) {
        setSearchOpen(false);
        setQuery("");
        return;
      }
      if (collectionOpen) {
        setCollectionOpen(false);
        setCurated(undefined);
        setView("device");
        setAlbum("");
        setTripFilter("");
        setPlaceFilter("");
        return;
      }
      if (smartMode) {
        setSmartMode(undefined);
        return;
      }
      setWorkspace("photos");
    },
    20,
  );
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
      void R2.saveGalleryMediaPreferences({ favorites: values }).catch(
        () => {},
      );
    } catch (e) {
      report(e);
    }
  }
  async function openAsset(asset: GalleryAsset) {
    if ((selected.length || selectionMode) && asset.device) {
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
      <header className="gw-header">
        <div className="gw-heading">
          {!collectionOpen && !smartMode && (
            <Link
              href="/secret"
              className="gw-back"
              aria-label="Back to Private Atlas"
            >
              <ArrowLeft size={20} />
            </Link>
          )}
          <button
            hidden={!collectionOpen && !smartMode}
            className="gw-back"
            aria-label={
              collectionOpen
                ? "Back to collections"
                : smartMode
                  ? "Back to collections"
                  : "Back to Private Atlas"
            }
            onClick={() => {
              if (smartMode && !collectionOpen) {
                setSmartMode(undefined);
                return;
              }
              if (collectionOpen) {
                setCurated(undefined);
                window.scrollTo(0, 0);
                setCollectionOpen(false);
                setView("device");
                setTripFilter("");
                setPlaceFilter("");
                setAlbum("");
                setSelected([]);
                setSelectionMode(false);
                setQuery("");
                setSearchOpen(false);
                setKind("all");
                setStatus("all");
                setFavoritesOnly(false);
                setDateFrom("");
                setDateTo("");
              }
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1>
            {collectionOpen
              ? view === "curated"
                ? curated?.title || "Collection"
                : view === "places"
                  ? "Places"
                  : view === "cloud"
                    ? "Public cloud"
                    : tripFilter
                      ? trips.find((t) => t.id === tripFilter)?.title || "Trip"
                      : album || "Collection"
              : workspace === "photos"
                ? "Photos"
                : workspace === "organize"
                  ? smartMode === "similar"
                    ? "Similar photos"
                    : smartMode === "people"
                      ? "People"
                      : smartMode === "memories"
                        ? "Albums & memories"
                        : "Collections"
                  : "Backup"}
          </h1>
        </div>
        {browsing && view !== "places" && (
          <div className="gw-header-actions">
            {view !== "curated" && (
              <button
                aria-label="Search photos"
                disabled={view !== "cloud" && access.status === "denied"}
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search size={21} />
              </button>
            )}
            {view !== "cloud" && (
              <button
                className="gw-select"
                disabled={!assets.length}
                aria-pressed={selectionMode}
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelected([]);
                }}
              >
                {selectionMode ? "Done" : "Select"}
              </button>
            )}
          </div>
        )}
      </header>
      {recoveryOpen && (
        <GalleryRecoveryPanel
          onClose={() => {
            setRecoveryOpen(false);
            setRevision((v) => v + 1);
            window.dispatchEvent(new Event("atlas:gallery-restored"));
          }}
        />
      )}
      {intelligenceOpen && (
        <GalleryIntelligencePanel
          albums={allAlbums}
          initialFeature={analysisGoal}
          onChange={(value) => {
            setIntelligence(value);
            if (!value.indexed) setSearchMode("files");
            setRevision((r) => r + 1);
          }}
          onClose={() => {
            setIntelligenceOpen(false);
            setRevision((r) => r + 1);
          }}
        />
      )}
      {searchOpen && browsing && (
        <label className="gw-search">
          <Search size={19} />
          <button
            aria-label="View options"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={18} />
          </button>
          <input
            autoFocus
            type="search"
            aria-label="Search gallery"
            placeholder={
              searchMode === "smart" && kind !== "video"
                ? "Describe a photo or find words inside…"
                : "Search filenames…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            aria-label="Close search"
            onClick={() => {
              setSearchOpen(false);
              setQuery("");
            }}
          >
            <X size={18} />
          </button>
        </label>
      )}
      {searchOpen && browsing && view !== "cloud" && (
        <div className="gi-search-mode" aria-label="Search type">
          <button
            aria-pressed={searchMode === "files"}
            onClick={() => setSearchMode("files")}
          >
            Filenames
          </button>
          <button
            aria-pressed={searchMode === "smart"}
            onClick={() => {
              if (
                !intelligence?.indexed ||
                !(intelligence.ocr || intelligence.visual)
              )
                setIntelligenceOpen(true);
              else setSearchMode("smart");
            }}
          >
            Smart search
          </button>
          <button onClick={() => setIntelligenceOpen(true)}>
            Search settings
          </button>
          {searchMode === "smart" && (
            <small>
              {kind === "video"
                ? "Videos use filename search. Photo analysis is available for photos only."
                : `Searching ${intelligence?.indexed.toLocaleString() || 0} analyzed photos${intelligence?.visual ? " by scene and text" : " by text"}. Switch to filenames to search files not analyzed yet. Results are ranked by relevance.`}
            </small>
          )}
        </div>
      )}
      <nav className="gw-navigation" aria-label="Gallery views">
        {(["photos", "organize", "backup"] as const).map((section) => (
          <button
            key={section}
            aria-label={
              section === "photos"
                ? "On my phone"
                : section === "organize"
                  ? "Organize collections"
                  : "Backup and cloud"
            }
            aria-current={workspace === section ? "page" : undefined}
            onClick={() => {
              window.scrollTo(0, 0);
              setWorkspace(section);
              setSmartMode(undefined);
              setCurated(undefined);
              setAnalysisGoal(undefined);
              setKind("all");
              setStatus("all");
              setFavoritesOnly(false);
              setDateFrom("");
              setDateTo("");
              setCollectionOpen(false);
              setView("device");
              setTripFilter("");
              setPlaceFilter("");
              setAlbum("");
              setQuery("");
              setSearchOpen(false);
              setSelected([]);
              setSelectionMode(false);
              setError("");
            }}
          >
            {section === "photos" ? (
              <ImageIcon size={22} />
            ) : section === "organize" ? (
              <Aperture size={22} />
            ) : (
              <Cloud size={22} />
            )}
            <span>
              {section === "photos"
                ? "Photos"
                : section === "organize"
                  ? "Collections"
                  : "Backup"}
            </span>
          </button>
        ))}
      </nav>
      {workspace === "organize" && !collectionOpen && !smartMode && (
        <GalleryCollections
          albums={albums}
          items={items}
          trips={trips}
          onSmart={(mode) => {
            window.scrollTo(0, 0);
            setSmartMode(mode);
            setSelected([]);
            setSelectionMode(false);
          }}
          onFavorites={() => {
            setWorkspace("photos");
            setView("device");
            setFavoritesOnly(true);
          }}
          onAlbum={(name) => {
            window.scrollTo(0, 0);
            setAlbum(name);
            setView("device");
            setCollectionOpen(true);
          }}
          onTrip={(id) => {
            window.scrollTo(0, 0);
            setTripFilter(id);
            setView("trips");
            setCollectionOpen(true);
          }}
          onPlaces={() => {
            window.scrollTo(0, 0);
            setView("places");
            setCollectionOpen(true);
          }}
        />
      )}
      {workspace === "organize" && !collectionOpen && smartMode && (
        <GallerySmartCollections
          mode={smartMode}
          revision={revision}
          onSettings={(feature) => {
            setAnalysisGoal(feature);
            setIntelligenceOpen(true);
          }}
          onChanged={() => setRevision((value) => value + 1)}
          onOpen={(collection) => {
            deviceGeneration.current++;
            window.scrollTo(0, 0);
            setCurated(collection);
            setView("curated");
            setCollectionOpen(true);
            setItems([]);
            setHasMore(false);
            setCursor("");
            setKind("all");
            setStatus("all");
            setQuery("");
            setSearchOpen(false);
            setFiltersOpen(false);
            setSearchMode("files");
            setFavoritesOnly(false);
            setDateFrom("");
            setDateTo("");
            setTripFilter("");
            setPlaceFilter("");
            setAlbum("");
            setSelected([]);
            setSelectionMode(false);
            setOrder("newest");
          }}
        />
      )}
      {workspace === "backup" && !collectionOpen && (
        <GalleryStorageHome
          summary={summary}
          pending={pending.length}
          onRecovery={() => setRecoveryOpen(true)}
          onSmartSearch={() => {
            setAnalysisGoal(undefined);
            setIntelligenceOpen(true);
          }}
          onPublic={() => {
            window.scrollTo(0, 0);
            setView("cloud");
            setSlot("public");
            setCollectionOpen(true);
          }}
          onTransfers={() => setDrawer(true)}
        />
      )}
      {browsing && (
        <>
          {!supported ? (
            <section className="pg-permission">
              <ShieldCheck size={34} />
              <h2>My gallery lives on my phone.</h2>
              <p>
                Open Gallery in the Android app to browse accessible device
                photos, check cloud copies and upload originals. A browser
                cannot enumerate the phone’s media library.
              </p>
              <Link href="/secret/studio">Open Creator Studio</Link>
            </section>
          ) : (
            <>
              <div
                className={`pg-access ${access.status === "full" && online ? "is-ready" : ""}`}
                hidden={access.status === "full" && online}
              >
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
                    choose specific media. Nothing uploads just because it
                    appears here.
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
                  {filtersOpen && (
                    <Modal
                      title="View options"
                      onClose={() => setFiltersOpen(false)}
                      className="pg-dialog gw-options"
                    >
                      {" "}
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
                      </div>
                      <div className="pg-filters">
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
                          onChange={(e) =>
                            setStatus(e.target.value as StatusFilter)
                          }
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
                          <option value="largest">
                            Largest · loaded media
                          </option>
                          <option value="name">Name · loaded media</option>
                        </select>
                        {view === "cloud" ? (
                          <select
                            aria-label="Cloud bucket"
                            value={slot}
                            onChange={(e) =>
                              setSlot(e.target.value as BucketSlot)
                            }
                          >
                            <option value="public">Public bucket</option>
                            <option value="private">
                              Encrypted private bucket
                            </option>
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
                            max={maxColumns}
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
                      <div className="gw-options-utilities">
                        {" "}
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
                      <div className="gw-options-actions">
                        <button
                          onClick={() => {
                            setKind("all");
                            setStatus("all");
                            setOrder("newest");
                            setAlbum("");
                            setFavoritesOnly(false);
                            setDateFrom("");
                            setDateTo("");
                          }}
                        >
                          Reset filters
                        </button>
                        <button
                          className="pg-primary"
                          onClick={() => setFiltersOpen(false)}
                        >
                          Show photos
                        </button>
                      </div>
                    </Modal>
                  )}
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
                        {websiteControls ? "Hide" : "Open"} this trip’s website
                        & cover controls
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
                          className={`pg-tile ${selected.includes(asset.id) ? "is-selected" : ""} ${selected.length || selectionMode ? "in-selection-mode" : ""}`}
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
                              if (
                                (selected.length || selectionMode) &&
                                asset.device
                              ) {
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
                  <p className="pg-footnote" hidden={!filtersOpen}>
                    Cloud checks compare exact file content with this
                    installation’s known uploads. Unchecked files are never
                    labelled “not uploaded.” Filters apply to loaded results;
                    more pages load as you scroll.
                  </p>
                </>
              )}
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
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (
                  !confirm(
                    `Move ${chosen.length} phone files to Android trash? Cloud copies and albums are not deleted. Make sure important files are backed up first.`,
                  )
                )
                  return;
                const result = await systemAction(() =>
                  R2.trashDeviceMedia({
                    ids: chosen.map((m) => m.id),
                    trashed: true,
                  }),
                );
                if (result.approved) {
                  setSelected([]);
                  setRevision((n) => n + 1);
                  setNotice(
                    "Phone files moved to Android trash. Restore them from Library → Phone trash.",
                  );
                }
              })
            }
            aria-label="Move phone files to trash"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
          <button disabled={busy} onClick={() => setAssigning(true)}>
            <CloudUpload size={17} /> Add or back up
          </button>
          <button disabled={busy || !online} onClick={() => void checkCloud()}>
            {busy ? "Working…" : "Check cloud"}
          </button>
          <button
            aria-label="Clear selection"
            onClick={() => {
              setSelected([]);
              setSelectionMode(false);
            }}
          >
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
        <PhotoViewer
          selected={viewer}
          onDelete={
            assets.find((a) => a.id === viewer)?.device
              ? async (id) => {
                  const asset = assets.find((a) => a.id === id);
                  if (!asset?.device) return;
                  const result = await systemAction(() =>
                    R2.trashDeviceMedia({
                      ids: [asset.device!.id],
                      trashed: true,
                    }),
                  );
                  if (result.approved) {
                    closeViewer();
                    setSelected([]);
                    setRevision((n) => n + 1);
                    setNotice(
                      "Moved to phone trash. Open Backup → Trash & restore to restore it.",
                    );
                  }
                }
              : undefined
          }
          details={(id) => {
            const a = assets.find((v) => v.id === id);
            return a ? (
              <dl>
                <dt>Name</dt>
                <dd>{a.name}</dd>
                <dt>Size</dt>
                <dd>{bytes(a.size)}</dd>
                {a.device && (
                  <>
                    <dt>Album</dt>
                    <dd>{a.device.album || "Photos"}</dd>
                    <dt>Dimensions</dt>
                    <dd>
                      {a.device.width} × {a.device.height}
                    </dd>
                  </>
                )}
                <dt>Date</dt>
                <dd>
                  {Number.isFinite(a.date)
                    ? new Date(a.date).toLocaleString()
                    : "Unknown"}
                </dd>
                <dt>Storage</dt>
                <dd>{statusLabel(a, trips)}</dd>
              </dl>
            ) : null;
          }}
          onSelect={setViewer}
          onClose={closeViewer}
          items={viewerAssets.map((a) => ({
            id: a.id,
            url: a.device ? gallerySource(a.device.uri) : a.url!,
            poster:
              a.thumbnail ||
              (a.device ? cachedThumbnail(a.device.id) : undefined),
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
