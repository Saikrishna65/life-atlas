"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Info,
  Trash2,
  X,
  Heart,
  Share2,
  MoreHorizontal,
  Pencil,
  Images,
  Download,
  ImagePlus,
} from "lucide-react";
import { Modal } from "@/components/world/primitives";
import type { DetailMedia } from "@/lib/public-trips/detail";
import { useGalleryBack } from "@/lib/gallery/navigation";
import { R2, storageError } from "@/lib/r2/native";
import {
  deviceMediaId,
  shareDevice,
  editDevice,
  setDevicePhotoAs,
  shareWhatsApp,
} from "@/lib/gallery/viewer-actions";
import { containRect } from "@/lib/gallery/viewer-motion";
import { useViewerTransition } from "@/lib/gallery/use-viewer-transition";
import { useViewerMotion } from "@/lib/gallery/use-viewer-motion";
import {
  readGalleryPreference,
  saveGalleryPreference,
} from "@/lib/gallery/store";
import GalleryExtraction from "./GalleryExtraction";
import GalleryPhotoEditor from "./GalleryPhotoEditor";
import type {
  GalleryViewerState,
  GalleryMotion,
} from "@/lib/gallery/media-tools";
import { gallerySource } from "@/lib/gallery/actions";
import { systemAction } from "@/lib/r2/native";
import ViewerVideo from "./ViewerVideo";
import "@/components/media/journal-viewer.css";
import "./photo-viewer.css";
export default function PhotoViewer({
  items,
  selected,
  onSelect,
  onClose,
  details,
  onDelete,
  favorite,
  onFavorite,
  onShare,
  onAlbum,
  onTrip,
  onDownload,
  onWhatsApp,
  onTripMedia,
  searchQuery = "",
}: {
  searchQuery?: string;
  items: DetailMedia[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  details?: (id: string) => ReactNode;
  onDelete?: (id: string) => Promise<void>;
  favorite?: boolean;
  onFavorite?: (id: string) => void | Promise<void>;
  onShare?: (id: string) => Promise<void>;
  onAlbum?: (id: string) => void;
  onTrip?: (id: string) => void;
  onDownload?: (id: string) => Promise<void>;
  onWhatsApp?: (id: string) => Promise<void>;
  onTripMedia?: (items: import("@/lib/gallery/types").DeviceMedia[]) => void;
}) {
  const [swipeUp, setSwipeUp] = useState("whatsapp");
  useEffect(() => {
    let alive = true;
    void readGalleryPreference("viewer-swipe-up", "whatsapp")
      .then((value) => {
        if (alive && ["whatsapp", "share", "info", "trip"].includes(value))
          setSwipeUp(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [extract, setExtract] = useState<{
      x: number;
      y: number;
      automatic?: boolean;
    }>(),
    [teaching, setTeaching] = useState(false),
    [label, setLabel] = useState("");
  useGalleryBack(teaching, () => setTeaching(false), 150);
  const [editing, setEditing] = useState(false),
    [showOriginal, setShowOriginal] = useState(false),
    [privacyShare, setPrivacyShare] = useState(false),
    [feedback, setFeedback] = useState("");
  const [extra, setExtra] = useState<{
      id: string;
      value: GalleryViewerState;
    }>(),
    [motion, setMotion] = useState<{ id: string; value: GalleryMotion }>(),
    [motionSource, setMotionSource] = useState<{ id: string; url: string }>();
  useEffect(() => {
    if (!deviceMediaId(selected)) return;
    let alive = true;
    void Promise.resolve()
      .then(() => R2.getGalleryViewerState({ id: selected }))
      .then((value) => {
        if (alive) setExtra({ id: selected, value });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [selected]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const viewingMotion = motionSource?.id === selected;
  const index = items.findIndex((i) => i.id === selected),
    item = items[index];
  const stage = useRef<HTMLDivElement>(null);
  const {
    pose: transform,
    setTransform,
    vertical,
    setVertical,
    setDrag,
  } = useViewerMotion(stage);
  const sharedClose = useViewerTransition(stage, selected);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [chrome, setChrome] = useState(true),
    [info, setInfo] = useState(false);
  const [actions, setActions] = useState(false);
  const axis = useRef<"x" | "y" | undefined>(undefined);
  const quickZoom = useRef(false),
    lastTap = useRef({ at: 0, x: 0, y: 0 });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pinchOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const videoPositions = useRef(new Map<string, number>());
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const [localFavourite, setLocalFavourite] = useState(false);
  useEffect(() => {
    if (onFavorite || !deviceMediaId(selected)) return;
    let alive = true;
    void R2.getGalleryMediaPreferences()
      .then((v) => {
        if (alive) setLocalFavourite(!!v.favorites?.includes(selected));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [onFavorite, selected]);
  const favouriteActive = onFavorite ? !!favorite : localFavourite;
  const toggleFavourite = async () => {
    if (onFavorite) {
      await onFavorite(selected);
      return;
    }
    const prefs = await R2.getGalleryMediaPreferences();
    const values = prefs.favorites || [];
    const next = values.includes(selected)
      ? values.filter((id) => id !== selected)
      : [...values, selected];
    await R2.saveGalleryMediaPreferences({ favorites: next });
    setLocalFavourite(next.includes(selected));
    window.dispatchEvent(new Event("atlas:gallery-restored"));
  };
  const [closing, setClosing] = useState(false);

  const [settling, setSettling] = useState(false);
  const dragRef = useRef(0);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const suppressClick = useRef(false);
  useEffect(() => () => clearTimeout(slideTimer.current), []);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function dismiss() {
    if (closing || !item) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      onClose();
      return;
    }
    setChrome(false);
    if (sharedClose(selected, onClose)) {
      setClosing(true);
      return;
    }
    setClosing(true);
    clearTimeout(timer.current);
    slideTimer.current = setTimeout(onClose, 140);
  }
  useGalleryBack(!!item, dismiss, 100);
  useEffect(() => {
    if (item) return;
    const timeout = setTimeout(onClose, 0);
    return () => clearTimeout(timeout);
  }, [item, onClose]);
  const activity = useCallback(() => {
    setChrome(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!document.activeElement?.matches(":focus-visible")) setChrome(false);
    }, 2800);
  }, []);
  useGalleryBack(
    actions,
    () => {
      setActions(false);
      activity();
    },
    110,
  );
  useGalleryBack(
    info,
    () => {
      setInfo(false);
      activity();
    },
    120,
  );
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!document.activeElement?.matches(":focus-visible")) setChrome(false);
    }, 2800);
    return () => clearTimeout(timer.current);
  }, [selected]);
  useEffect(() => {
    clearTimeout(timer.current);
    if (!info && !actions && !busy && !editing && !showOriginal)
      timer.current = setTimeout(() => {
        if (!document.activeElement?.matches(":focus-visible"))
          setChrome(false);
      }, 2800);
    return () => clearTimeout(timer.current);
  }, [info, actions, busy, editing, showOriginal]);
  const points = useRef(new Map<number, { x: number; y: number }>()),
    start = useRef({
      distance: 0,
      scale: 1,
      x: 0,
      y: 0,
      panX: 0,
      panY: 0,
      at: 0,
      multi: false,
      drag: 0,
    });
  const currentId = useRef(selected);
  const slideFrame = useRef(0);
  const pendingSlide = useRef<{ id: string; from: number } | undefined>(
    undefined,
  );
  useLayoutEffect(() => {
    currentId.current = selected;
    const pending = pendingSlide.current,
      node = stage.current;
    if (!pending || pending.id !== selected || !node) return;
    pendingSlide.current = undefined;
    node.classList.remove("is-settling");
    node.style.setProperty("--pv-drag", `${pending.from}px`);
    setDrag(pending.from);
    slideFrame.current = requestAnimationFrame(() => {
      setSettling(true);
      setDrag(0);
      dragRef.current = 0;
      slideTimer.current = setTimeout(() => setSettling(false), 220);
    });
  }, [selected, setDrag]);
  useEffect(() => () => cancelAnimationFrame(slideFrame.current), []);
  const move = (n: number) => {
    if (closing || items.length < 2) return;
    clearTimeout(slideTimer.current);
    cancelAnimationFrame(slideFrame.current);
    const at = items.findIndex((m) => m.id === currentId.current),
      next = items[(Math.max(0, at) + n + items.length) % items.length];
    const width = (stage.current?.clientWidth || innerWidth) + 18;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    setSettling(false);
    pendingSlide.current = reduced
      ? undefined
      : { id: next.id, from: n * width + dragRef.current };
    currentId.current = next.id;
    setTransform({ scale: 1, x: 0, y: 0 });
    setVertical(0);
    setInfo(false);
    activity();
    if (reduced) {
      setDrag(0);
      dragRef.current = 0;
    }
    onSelect(next.id);
  };
  useEffect(() => {
    points.current.clear();
    start.current.multi = false;
  }, [selected]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        info ||
        actions ||
        busy ||
        (e.target as HTMLElement)?.closest("input,textarea,select")
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setActions(false);
    } catch (e) {
      const failure = e as { code?: string; message?: string };
      setError(
        failure?.code || /^[A-Z_]{3,50}$/.test(failure?.message || "")
          ? storageError(e)
          : e instanceof Error
            ? e.message
            : "This action could not finish.",
      );
    } finally {
      setBusy(false);
      activity();
    }
  };
  const share = () =>
    perform(() =>
      privacyShare && deviceMediaId(selected)
        ? systemAction(() => R2.shareSanitizedMedia({ id: selected }))
        : onShare
          ? onShare(selected)
          : shareDevice([selected]),
    );
  const whatsApp = () =>
    perform(() =>
      privacyShare && deviceMediaId(selected)
        ? systemAction(() =>
            R2.shareSanitizedMedia({ id: selected, target: "whatsapp" }),
          )
        : onWhatsApp
          ? onWhatsApp(selected)
          : shareWhatsApp(selected),
    );
  const inspectMotion = () => {
    if (
      !deviceMediaId(selected) ||
      item?.kind !== "photo" ||
      motion?.id === selected
    )
      return;
    void R2.getGalleryMotionPhoto({ id: selected })
      .then((value) => setMotion({ id: selected, value }))
      .catch(() => {});
  };
  const remove = () =>
    perform(async () => {
      if (!onDelete) return;
      if (
        confirm(
          "Move this file to phone trash? Cloud originals and trip records remain.",
        )
      )
        await onDelete(selected);
    });
  if (!item) return null;
  const clampPose = (scale: number, x: number, y: number) => {
    const node = stage.current,
      img = node?.querySelector<HTMLImageElement>(
        ".pv-slide:not([inert]) > img",
      );
    if (!node || !img) return { scale, x: 0, y: 0 };
    const box = node.getBoundingClientRect(),
      fit = containRect(box, img.naturalWidth, img.naturalHeight);
    const bx = Math.max(0, (fit.width * scale - box.width) / 2),
      by = Math.max(0, (fit.height * scale - box.height) / 2);
    return {
      scale,
      x: Math.max(-bx, Math.min(bx, x)),
      y: Math.max(-by, Math.min(by, y)),
    };
  };
  const zoom = (scale: number, clientX?: number, clientY?: number) => {
    const box = stage.current?.getBoundingClientRect(),
      image = stage.current?.querySelector<HTMLImageElement>(
        ".pv-slide:not([inert]) > img",
      );
    const next = clampPose(
      scale,
      scale === 1 || !box
        ? 0
        : ((clientX ?? box.left + box.width / 2) - (box.left + box.width / 2)) *
            (1 - scale),
      scale === 1 || !box
        ? 0
        : ((clientY ?? box.top + box.height / 2) - (box.top + box.height / 2)) *
            (1 - scale),
    );
    const previous = image ? getComputedStyle(image).transform : "none";
    image?.getAnimations().forEach((animation) => animation.cancel());
    setTransform(next);
    if (image && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      image.animate(
        [
          { transform: previous },
          {
            transform: `translate3d(${next.x}px,${next.y}px,0) scale(${next.scale})`,
          },
        ],
        { duration: 190, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
  };
  return (
    <Modal
      title="Photo viewer"
      className={`pv-viewer ${closing ? "is-closing" : ""}`}
      onClose={() => {
        const event = new Event("atlas:back", { cancelable: true });
        if (window.dispatchEvent(event)) dismiss();
      }}
    >
      <div
        className={`pv-top ${(chrome || info || busy) && vertical <= 8 && !closing ? "" : "is-hidden"}`}
        inert={vertical > 8 || closing || (!chrome && !info && !busy)}
        onClick={activity}
        onKeyDown={activity}
      >
        <button onClick={dismiss} aria-label="Back to photos">
          <ArrowLeft />
        </button>
        <span>
          {index + 1} / {items.length}
        </span>
        <div className="pv-top-actions" />
      </div>
      <div
        ref={stage}
        onDragStart={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
        className={`pv-picture journal-viewer-stage ${settling ? "is-settling" : ""}`}
        style={{
          transform: `translate3d(0,${Math.max(0, vertical)}px,0) scale(${1 - Math.min(0.18, Math.max(0, vertical) / 1500)})`,
          borderRadius: vertical > 8 ? 18 : 0,
        }}
        onClick={(e) => {
          if (
            (e.target as HTMLElement).closest("button,input") ||
            suppressClick.current
          ) {
            suppressClick.current = false;
            return;
          }
          if (start.current.multi) return;
          if (Math.abs(e.clientX - start.current.x) > 12 && points.current.size)
            return;
          if (chrome) setChrome(false);
          else activity();
        }}
        onDoubleClick={(e) => {
          lastTap.current.at = 0;
          quickZoom.current = false;
          if (item.kind !== "video" && !viewingMotion)
            zoom(transform.scale > 1 ? 1 : 2.5, e.clientX, e.clientY);
        }}
        onPointerDown={(e) => {
          if (
            (e.target as HTMLElement).closest(
              "button,input,.pv-video-controls",
            ) ||
            closing
          )
            return;
          if (settling) {
            const active = e.currentTarget.querySelector<HTMLElement>(
              ".pv-slide:not([inert])",
            );
            const offset = active
              ? new DOMMatrix(getComputedStyle(active).transform).m41
              : 0;
            clearTimeout(slideTimer.current);
            cancelAnimationFrame(slideFrame.current);
            e.currentTarget.style.setProperty("--pv-drag", `${offset}px`);
            e.currentTarget.classList.remove("is-settling");
            setSettling(false);
            setDrag(offset);
            dragRef.current = offset;
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const p = [...points.current.values()];
          if (p.length === 1) {
            quickZoom.current =
              Date.now() - lastTap.current.at < 300 &&
              Math.hypot(
                e.clientX - lastTap.current.x,
                e.clientY - lastTap.current.y,
              ) < 24;
            suppressClick.current = false;
            axis.current = undefined;
            clearTimeout(holdTimer.current);
            if (
              !quickZoom.current &&
              item.kind === "photo" &&
              !viewingMotion &&
              deviceMediaId(selected)
            )
              holdTimer.current = setTimeout(() => {
                const image = stage.current?.querySelector<HTMLImageElement>(
                  ".pv-slide:not([inert]) > img",
                );
                if (!image) return;
                const box = containRect(
                  image.getBoundingClientRect(),
                  image.naturalWidth,
                  image.naturalHeight,
                );
                setExtract({
                  automatic: true,
                  x: Math.max(
                    0,
                    Math.min(1, (e.clientX - box.left) / box.width),
                  ),
                  y: Math.max(
                    0,
                    Math.min(1, (e.clientY - box.top) / box.height),
                  ),
                });
                suppressClick.current = true;
              }, 500);
          } else clearTimeout(holdTimer.current);
          if (p.length === 1)
            start.current = {
              distance: 0,
              scale: transform.scale,
              x: e.clientX,
              y: e.clientY,
              panX: transform.x,
              panY: transform.y,
              at: Date.now(),
              drag: dragRef.current,
              multi: false,
            };
          else if (p.length === 2) {
            const box = e.currentTarget.getBoundingClientRect();
            pinchOrigin.current = {
              x: (p[0].x + p[1].x) / 2 - box.left - box.width / 2,
              y: (p[0].y + p[1].y) / 2 - box.top - box.height / 2,
              panX: transform.x,
              panY: transform.y,
            };
            start.current.distance = Math.hypot(
              p[0].x - p[1].x,
              p[0].y - p[1].y,
            );
            start.current.scale = transform.scale;
            start.current.multi = true;
          }
        }}
        onPointerMove={(e) => {
          if (!points.current.has(e.pointerId)) return;
          points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (
            Math.hypot(
              e.clientX - start.current.x,
              e.clientY - start.current.y,
            ) > 8
          )
            clearTimeout(holdTimer.current);
          const p = [...points.current.values()];
          if (
            p.length === 1 &&
            quickZoom.current &&
            item.kind === "photo" &&
            !viewingMotion &&
            Math.abs(e.clientY - start.current.y) > 8
          ) {
            suppressClick.current = true;
            const scale = Math.max(
              1,
              Math.min(
                5,
                start.current.scale *
                  Math.exp(-(e.clientY - start.current.y) / 180),
              ),
            );
            setTransform(clampPose(scale, transform.x, transform.y));
            return;
          }
          if (
            p.length === 2 &&
            start.current.distance > 0 &&
            item.kind !== "video" &&
            !viewingMotion
          ) {
            const scale = Math.max(
              1,
              Math.min(
                5,
                (start.current.scale *
                  Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)) /
                  start.current.distance,
              ),
            );
            const box = e.currentTarget.getBoundingClientRect(),
              origin = pinchOrigin.current,
              k = scale / start.current.scale;
            setTransform(
              clampPose(
                scale,
                origin.panX * k +
                  (p[0].x + p[1].x) / 2 -
                  box.left -
                  box.width / 2 -
                  origin.x * k,
                origin.panY * k +
                  (p[0].y + p[1].y) / 2 -
                  box.top -
                  box.height / 2 -
                  origin.y * k,
              ),
            );
          } else if (
            p.length === 1 &&
            transform.scale === 1 &&
            !start.current.multi
          ) {
            const dx = e.clientX - start.current.x,
              dy = e.clientY - start.current.y;
            if (Math.hypot(dx, dy) > 8) clearTimeout(holdTimer.current);
            if (!axis.current && Math.max(Math.abs(dx), Math.abs(dy)) > 10)
              axis.current =
                Math.abs(dx) > Math.abs(dy) * 1.15
                  ? "x"
                  : Math.abs(dy) > Math.abs(dx) * 1.15
                    ? "y"
                    : undefined;
            if (axis.current === "y") {
              setVertical(Math.max(-180, Math.min(500, dy)));
              suppressClick.current = true;
              return;
            }
            if (Math.abs(dx) > 8) {
              suppressClick.current = true;
              dragRef.current = start.current.drag + dx;
              setDrag(dragRef.current);
            }
          } else if (p.length === 1 && transform.scale > 1) {
            if (
              Math.hypot(
                e.clientX - start.current.x,
                e.clientY - start.current.y,
              ) > 8
            )
              suppressClick.current = true;
            setTransform(
              clampPose(
                transform.scale,
                start.current.panX + e.clientX - start.current.x,
                start.current.panY + e.clientY - start.current.y,
              ),
            );
          }
        }}
        onPointerCancel={(e) => {
          clearTimeout(holdTimer.current);
          setVertical(0);
          points.current.delete(e.pointerId);
          setDrag(0);
          dragRef.current = 0;
        }}
        onPointerUp={(e) => {
          if (!points.current.has(e.pointerId)) return;
          clearTimeout(holdTimer.current);
          const s = start.current;
          points.current.delete(e.pointerId);
          if (
            !points.current.size &&
            Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8
          )
            lastTap.current = { at: Date.now(), x: e.clientX, y: e.clientY };
          if (quickZoom.current && Math.abs(e.clientY - s.y) > 8) return;
          if (!points.current.size && !s.multi && transform.scale === 1) {
            const dx = e.clientX - s.x,
              dy = e.clientY - s.y;
            if (axis.current === "y") {
              if (
                (dy > 90 ||
                  (dy > 40 && dy / Math.max(1, Date.now() - s.at) > 0.65)) &&
                Math.abs(dy) > Math.abs(dx) * 1.2
              ) {
                dismiss();
                return;
              }
              if (dy < -75 && Math.abs(dy) > Math.abs(dx) * 1.2) {
                if (swipeUp === "info") setInfo(true);
                else if (swipeUp === "trip" && onTrip) onTrip(selected);
                else if (swipeUp === "share") void share();
                else void whatsApp();
                activity();
              }
              setSettling(true);
              setVertical(0);
              slideTimer.current = setTimeout(() => setSettling(false), 180);
              return;
            }
            if (
              items.length > 1 &&
              Math.abs(dx) > 50 &&
              Math.abs(dx) > Math.abs(dy) * 1.3 &&
              (Math.abs(dx) > (stage.current?.clientWidth || 400) * 0.2 ||
                Date.now() - s.at < 1000)
            )
              move(dx < 0 ? 1 : -1);
            else if (dragRef.current !== 0) {
              dragRef.current = 0;
              setSettling(true);
              setDrag(0);
              slideTimer.current = setTimeout(() => setSettling(false), 180);
            }
          } else if (points.current.size === 1) {
            const p = [...points.current.values()][0];
            start.current = {
              ...s,
              x: p.x,
              y: p.y,
              panX: transform.x,
              panY: transform.y,
            };
          }
        }}
      >
        {[-1, 0, 1].map((offset) => {
          if (items.length < 2 && offset !== 0) return null;
          const media = items[(index + offset + items.length) % items.length];
          return (
            <div
              key={
                items.length === 2 && offset === -1
                  ? `${media.id}:mirror`
                  : media.id
              }
              className="pv-slide"
              aria-hidden={offset !== 0}
              inert={offset !== 0}
              style={{
                transform: `translate3d(calc(${offset * 100}% + ${offset * 18}px + var(--pv-drag, 0px)),0,0)`,
              }}
            >
              {offset === 0 &&
              (media.kind === "video" || motionSource?.id === selected) ? (
                <ViewerVideo
                  key={media.id}
                  src={
                    motionSource?.id === selected ? motionSource.url : media.url
                  }
                  mediaId={
                    media.kind === "video" && deviceMediaId(media.id)
                      ? media.id
                      : undefined
                  }
                  poster={media.poster}
                  onResumeTime={() => videoPositions.current.get(media.id) || 0}
                  onPosition={(time) => {
                    videoPositions.current.set(media.id, time);
                    if (videoPositions.current.size > 8)
                      videoPositions.current.delete(
                        videoPositions.current.keys().next().value!,
                      );
                  }}
                  show={chrome && !info && vertical <= 8 && !closing}
                  onActivity={activity}
                />
              ) : media.kind === "video" && !media.poster ? (
                <div className="pv-neighbor-video">Video</div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={media.id}
                  src={media.kind === "photo" ? media.url : media.poster}
                  alt={offset === 0 ? media.caption || "Photo" : ""}
                  draggable={false}
                  decoding="async"
                  style={
                    offset === 0
                      ? {
                          transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
                        }
                      : undefined
                  }
                />
              )}
            </div>
          );
        })}
      </div>
      <div
        className={`pv-bottom ${(chrome || info || actions || busy) && vertical <= 8 && !closing ? "" : "is-hidden"}`}
        inert={
          vertical > 8 || closing || (!chrome && !info && !actions && !busy)
        }
        onPointerDown={activity}
      >
        {onShare || deviceMediaId(selected) ? (
          <button
            aria-label="Share"
            disabled={busy}
            onClick={() => void share()}
          >
            <Share2 />
            <small>Share</small>
          </button>
        ) : null}
        {(onFavorite || deviceMediaId(selected)) && (
          <button
            disabled={busy}
            aria-label={favouriteActive ? "Remove favourite" : "Favourite"}
            aria-pressed={favouriteActive}
            onClick={() => void perform(toggleFavourite)}
          >
            <Heart fill={favouriteActive ? "currentColor" : "none"} />
            <small>Favourite</small>
          </button>
        )}
        <button
          aria-label="Photo details"
          aria-expanded={info}
          onClick={() => {
            setInfo((v) => !v);
            activity();
          }}
        >
          <Info />
          <small>Info</small>
        </button>
        {onDelete && (
          <button
            aria-label="Delete"
            disabled={busy}
            onClick={() => void remove()}
          >
            <Trash2 />
            <small>Delete</small>
          </button>
        )}
        <button
          aria-label="More photo actions"
          onClick={() => {
            setActions(true);
            inspectMotion();
            activity();
          }}
        >
          <MoreHorizontal />
          <small>More</small>
        </button>
      </div>
      {extract && (
        <GalleryExtraction
          id={selected}
          source={item.url}
          point={extract}
          onClose={() => {
            setExtract(undefined);
            activity();
          }}
        />
      )}
      {teaching && (
        <Modal
          title="Teach Atlas"
          className="gextract"
          onClose={() => setTeaching(false)}
        >
          <header>
            <h2>Teach Atlas</h2>
            <button
              onClick={() => setTeaching(false)}
              aria-label="Close corrections"
            >
              <X />
            </button>
          </header>
          <p>
            Your corrections personalize future search. They stay encrypted on
            your device and in an approved encrypted recovery backup.
          </p>
          <label>
            Describe this photo
            <input
              aria-label="Photo search labels"
              maxLength={200}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Tungnath temple, my birthday"
            />
          </label>
          <div className="gextract-actions">
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await R2.saveGalleryCorrection({ id: selected, label });
                  setExtra((old) => ({
                    id: selected,
                    value: {
                      ...(old?.id === selected
                        ? old.value
                        : { position: 0, cover: 0 }),
                      searchLabel: label,
                    },
                  }));
                  setTeaching(false);
                  setFeedback("Saved. Atlas will remember this description.");
                })
              }
            >
              Save description
            </button>
            {searchQuery && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await R2.saveGalleryCorrection({
                        id: selected,
                        query: searchQuery,
                        relevant: true,
                      });
                      setTeaching(false);
                      setFeedback("Relevant match remembered.");
                    })
                  }
                >
                  Good match for “{searchQuery}”
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await R2.saveGalleryCorrection({
                        id: selected,
                        query: searchQuery,
                        relevant: false,
                      });
                      setTeaching(false);
                      setFeedback(
                        "This match will be excluded for that search.",
                      );
                    })
                  }
                >
                  Wrong match
                </button>
              </>
            )}
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await R2.saveGalleryCorrection({ id: selected, clear: true });
                  setExtra((old) => ({
                    id: selected,
                    value: {
                      ...(old?.id === selected
                        ? old.value
                        : { position: 0, cover: 0 }),
                      searchLabel: "",
                    },
                  }));
                  setLabel("");
                  setFeedback("Search corrections cleared for this photo.");
                })
              }
            >
              Reset this photo’s search corrections
            </button>
          </div>
        </Modal>
      )}
      {actions && (
        <div
          className="pv-info-backdrop"
          onClick={() => {
            setActions(false);
            activity();
          }}
        >
          <section
            role="region"
            aria-label="Photo actions"
            className="pv-info-panel pv-action-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {deviceMediaId(selected) && item.kind === "photo" && (
              <>
                <button
                  onClick={() => {
                    setActions(false);
                    setExtract({ x: 0.5, y: 0.5 });
                  }}
                >
                  Extract text or create sticker
                </button>
                <button
                  onClick={() => {
                    setActions(false);
                    setLabel(
                      extra?.id === selected
                        ? extra.value.searchLabel || ""
                        : "",
                    );
                    setTeaching(true);
                  }}
                >
                  Teach Atlas about this photo
                </button>
              </>
            )}
            <header>
              <h2>{item.kind === "video" ? "Video" : "Photo"}</h2>
              <button
                aria-label="Close actions"
                onClick={() => {
                  setActions(false);
                  activity();
                }}
              >
                <X />
              </button>
            </header>
            <label className="pv-shortcut">
              Swipe up opens
              <select
                aria-label="Swipe-up shortcut"
                value={swipeUp}
                onChange={(e) => {
                  setSwipeUp(e.target.value);
                  void saveGalleryPreference("viewer-swipe-up", e.target.value);
                }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="share">Share menu</option>
                <option value="info">Photo information</option>
                {onTrip && <option value="trip">Add to a trip</option>}
              </select>
            </label>

            {(onShare || deviceMediaId(selected)) && (
              <button disabled={busy} onClick={() => void share()}>
                <Share2 />
                {privacyShare
                  ? "Share location-free copy"
                  : "Share original file"}
              </button>
            )}
            {item.kind === "video" && deviceMediaId(selected) && (
              <>
                <button
                  onClick={() => {
                    setActions(false);
                    window.dispatchEvent(
                      new CustomEvent("atlas:video-action", {
                        detail: { id: selected, action: "frames" },
                      }),
                    );
                  }}
                >
                  Browse video frames
                </button>
                <button
                  onClick={() => {
                    setActions(false);
                    window.dispatchEvent(
                      new CustomEvent("atlas:video-action", {
                        detail: { id: selected, action: "cover" },
                      }),
                    );
                  }}
                >
                  Use current frame as video cover
                </button>
              </>
            )}
            {deviceMediaId(selected) && (
              <label className="pv-privacy-choice">
                <input
                  type="checkbox"
                  checked={privacyShare}
                  onChange={(e) => setPrivacyShare(e.target.checked)}
                />
                Remove location tags from shared copies
                <small>
                  {item.kind === "video"
                    ? "Creates an MP4 without re-encoding its audio/video tracks."
                    : "Creates a still JPEG copy up to 3072px / 6 MP. Motion stays in your original."}{" "}
                  What appears in the picture or sound can still reveal a place.
                </small>
              </label>
            )}
            {extra?.id === selected && extra.value.original && (
              <button
                onClick={() => {
                  setActions(false);
                  setShowOriginal(true);
                }}
              >
                See unedited original
              </button>
            )}
            {motion?.id === selected && motion.value.embedded && (
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const value = await R2.getGalleryMotionPhoto({
                      id: selected,
                      extract: true,
                    });
                    if (!value.path)
                      throw new Error(
                        "This motion clip is not supported on this phone.",
                      );
                    setTransform({ scale: 1, x: 0, y: 0 });
                    setMotionSource({
                      id: selected,
                      url: gallerySource(value.path),
                    });
                  })
                }
              >
                Play motion photo
              </button>
            )}
            {motion?.id === selected && motion.value.companion && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(() =>
                      shareDevice([selected, motion.value.companion!.id]),
                    )
                  }
                >
                  Share photo + companion video
                </button>
                <button
                  onClick={() => {
                    setTransform({ scale: 1, x: 0, y: 0 });
                    setMotionSource({
                      id: selected,
                      url: gallerySource(motion.value.companion!.uri),
                    });
                    setActions(false);
                  }}
                >
                  Play companion video
                </button>
                {onTripMedia && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      const companion = motion.value.companion!;
                      setActions(false);
                      onTripMedia([companion]);
                    }}
                  >
                    Add photo + video to a trip or backup
                  </button>
                )}
              </>
            )}
            {motionSource?.id === selected && (
              <button
                onClick={() => {
                  setMotionSource(undefined);
                  setActions(false);
                }}
              >
                Back to still photo
              </button>
            )}
            {motion?.id === selected && motion.value.companion && (
              <p>
                This photo has a matching companion video,{" "}
                {motion.value.companion.name}. Keep both selected when backing
                up or sharing this Live Photo pair.
              </p>
            )}
            {onAlbum && (
              <button
                onClick={() => {
                  setActions(false);
                  onAlbum(selected);
                }}
              >
                <Images />
                Add to album
              </button>
            )}
            {onTrip && (
              <button
                onClick={() => {
                  setActions(false);
                  onTrip(selected);
                }}
              >
                <ImagePlus />
                Add to a trip
              </button>
            )}
            {item.kind === "photo" && deviceMediaId(selected) && (
              <>
                <button
                  disabled={busy}
                  onClick={() => {
                    setActions(false);
                    setEditing(true);
                  }}
                >
                  <Pencil />
                  Edit photo
                </button>
                <button
                  disabled={busy}
                  onClick={() => void perform(() => editDevice(selected))}
                >
                  <Pencil />
                  Open another editor
                </button>
                <button
                  disabled={busy}
                  onClick={() => void perform(() => setDevicePhotoAs(selected))}
                >
                  <ImagePlus />
                  Use as wallpaper or contact photo
                </button>
              </>
            )}
            {onDownload && (
              <button
                disabled={busy}
                onClick={() => void perform(() => onDownload(selected))}
              >
                <Download />
                Download original
              </button>
            )}
            <button
              onClick={() => {
                setActions(false);
                setInfo(true);
              }}
            >
              <Info />
              Details & backup status
            </button>
            <p>
              Swipe down to close. Swipe up to choose a recipient in WhatsApp.
              Pinch to zoom; drag to pan. Sharing originals may include location
              metadata. Edits are saved as new photos.
            </p>
            {busy && <p role="status">Preparing…</p>}
            {error && <p role="alert">{error}</p>}
          </section>
        </div>
      )}
      {editing && (
        <GalleryPhotoEditor
          id={selected}
          source={item.url}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setFeedback(
              "Edited copy saved in Pictures / Atlas Edits. Your original is unchanged.",
            );
          }}
        />
      )}
      {showOriginal && extra?.id === selected && extra.value.original && (
        <PhotoViewer
          selected={extra.value.original.id}
          items={[
            {
              id: extra.value.original.id,
              url: gallerySource(extra.value.original.uri),
              kind: extra.value.original.kind,
              place: extra.value.original.album,
              category: "Unedited original",
              caption: extra.value.original.name,
            },
          ]}
          onSelect={() => {}}
          onClose={() => setShowOriginal(false)}
        />
      )}
      {feedback && (
        <p role="status" className="pv-feedback">
          {feedback}
        </p>
      )}
      {error && !actions && <p role="alert">{error}</p>}
      {info && (
        <div
          className="pv-info-backdrop"
          onClick={() => {
            setInfo(false);
            activity();
          }}
        >
          <section
            className="pv-info-panel"
            role="region"
            aria-label="Photo information"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>Details</h2>
              <button
                aria-label="Close information"
                onClick={() => {
                  setInfo(false);
                  activity();
                }}
              >
                <X size={20} />
              </button>
            </header>
            {details ? (
              details(selected)
            ) : (
              <dl>
                <dt>Place</dt>
                <dd>{item.place}</dd>
                <dt>Type</dt>
                <dd>{item.kind === "video" ? "Video" : "Photo"}</dd>
                {item.caption && (
                  <>
                    <dt>Name</dt>
                    <dd>{item.caption}</dd>
                  </>
                )}
              </dl>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
