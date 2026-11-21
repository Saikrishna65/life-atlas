"use client";
import {
  useCallback,
  useEffect,
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
import { R2 } from "@/lib/r2/native";
import {
  deviceMediaId,
  shareDevice,
  editDevice,
  setDevicePhotoAs,
} from "@/lib/gallery/viewer-actions";
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
}: {
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
}) {
  const index = items.findIndex((i) => i.id === selected),
    item = items[index];
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [chrome, setChrome] = useState(true),
    [info, setInfo] = useState(false);
  const [actions, setActions] = useState(false),
    [vertical, setVertical] = useState(0);
  const axis = useRef<"x" | "y" | undefined>(undefined);
  const [magnify, setMagnify] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const beforeHold = useRef({ scale: 1, x: 0, y: 0 });
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
  useGalleryBack(true, onClose, 100);
  const [drag, setDrag] = useState(0);
  const [settling, setSettling] = useState(false);
  const dragRef = useRef(0);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const stage = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  useEffect(() => () => clearTimeout(slideTimer.current), []);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
    if (info || actions || busy) clearTimeout(timer.current);
  }, [info, actions, busy]);
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
    });
  const move = (n: number) => {
    if (items.length > 1 && !settling) {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const width = stage.current?.clientWidth || window.innerWidth;
      setSettling(true);
      setDrag(-n * width);
      slideTimer.current = setTimeout(
        () => {
          setDrag(0);
          dragRef.current = 0;
          setSettling(false);
          setTransform({ scale: 1, x: 0, y: 0 });
          setInfo(false);
          activity();
          onSelect(items[(index + n + items.length) % items.length].id);
        },
        reduced ? 0 : 220,
      );
    }
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
      setError(
        e instanceof Error ? e.message : "This action could not finish.",
      );
    } finally {
      setBusy(false);
      activity();
    }
  };
  const share = () =>
    perform(() => (onShare ? onShare(selected) : shareDevice([selected])));
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
  const zoom = (scale: number) => setTransform({ scale, x: 0, y: 0 });
  return (
    <Modal
      title="Photo viewer"
      className="pv-viewer"
      onClose={() => {
        if (info) {
          setInfo(false);
          activity();
        } else onClose();
      }}
    >
      <div
        className={`pv-top ${chrome || info || busy ? "" : "is-hidden"}`}
        inert={!chrome && !info && !busy}
        onClick={activity}
        onKeyDown={activity}
      >
        <button onClick={onClose} aria-label="Back to photos">
          <ArrowLeft />
        </button>
        <span>
          {index + 1} / {items.length}
        </span>
        <div className="pv-top-actions" />
      </div>
      <div
        ref={stage}
        className={`pv-picture journal-viewer-stage ${settling ? "is-settling" : ""}`}
        style={{
          transform: `translate3d(0,${vertical}px,0)`,
          opacity: Math.max(0.35, 1 - Math.abs(vertical) / 1000),
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
        onDoubleClick={() => {
          if (item.kind !== "video") zoom(transform.scale > 1 ? 1 : 2.5);
        }}
        onPointerDown={(e) => {
          if (
            (e.target as HTMLElement).closest(
              "button,input,.pv-video-controls",
            ) ||
            settling
          )
            return;
          e.currentTarget.setPointerCapture(e.pointerId);
          points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const p = [...points.current.values()];
          if (p.length === 1) {
            dragRef.current = 0;
            axis.current = undefined;
            clearTimeout(holdTimer.current);
            if (item.kind === "photo" && transform.scale > 1)
              holdTimer.current = setTimeout(() => {
                beforeHold.current = transform;
                setMagnify(true);
                setTransform((t) => ({
                  ...t,
                  scale: Math.min(5, t.scale * 1.5),
                }));
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
              multi: false,
            };
          else if (p.length === 2) {
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
            p.length === 2 &&
            start.current.distance > 0 &&
            item.kind !== "video"
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
            setTransform((old) => ({
              ...old,
              scale,
              x: scale === 1 ? 0 : old.x,
              y: scale === 1 ? 0 : old.y,
            }));
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
              dragRef.current = dx;
              setDrag(dx);
            }
          } else if (p.length === 1 && transform.scale > 1) {
            const r = e.currentTarget.getBoundingClientRect();
            const img = e.currentTarget.querySelector("img");
            const boundX = Math.max(
              0,
              ((img?.clientWidth || r.width) * transform.scale - r.width) / 2,
            );
            const boundY = Math.max(
              0,
              ((img?.clientHeight || r.height) * transform.scale - r.height) /
                2,
            );
            setTransform((old) => ({
              ...old,
              x: Math.max(
                -boundX,
                Math.min(
                  boundX,
                  start.current.panX + e.clientX - start.current.x,
                ),
              ),
              y: Math.max(
                -boundY,
                Math.min(
                  boundY,
                  start.current.panY + e.clientY - start.current.y,
                ),
              ),
            }));
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
          if (magnify) {
            setMagnify(false);
            setTransform(beforeHold.current);
          }
          const s = start.current;
          points.current.delete(e.pointerId);
          if (!points.current.size && !s.multi && transform.scale === 1) {
            const dx = e.clientX - s.x,
              dy = e.clientY - s.y;
            if (axis.current === "y") {
              if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.2) {
                setSettling(true);
                setVertical(stage.current?.clientHeight || window.innerHeight);
                slideTimer.current = setTimeout(onClose, 180);
                return;
              }
              if (dy < -75 && Math.abs(dy) > Math.abs(dx) * 1.2) {
                setActions(true);
                activity();
              }
              setVertical(0);
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
                transform: `translate3d(calc(${offset * 100}% + ${drag}px),0,0)`,
              }}
            >
              {offset === 0 && media.kind === "video" ? (
                <ViewerVideo
                  key={media.id}
                  src={media.url}
                  poster={media.poster}
                  onResumeTime={() => videoPositions.current.get(media.id) || 0}
                  onPosition={(time) => {
                    videoPositions.current.set(media.id, time);
                    if (videoPositions.current.size > 8)
                      videoPositions.current.delete(
                        videoPositions.current.keys().next().value!,
                      );
                  }}
                  show={chrome && !info}
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
        className={`pv-bottom ${chrome || info || actions || busy ? "" : "is-hidden"}`}
        inert={!chrome && !info && !actions && !busy}
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
            activity();
          }}
        >
          <MoreHorizontal />
          <small>More</small>
        </button>
      </div>
      {actions && (
        <div
          className="pv-sheet-backdrop"
          onClick={() => {
            setActions(false);
            activity();
          }}
        >
          <section
            role="region"
            aria-label="Photo actions"
            className="pv-action-sheet"
            onClick={(e) => e.stopPropagation()}
          >
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
            {(onShare || deviceMediaId(selected)) && (
              <button disabled={busy} onClick={() => void share()}>
                <Share2 />
                Share original quality
              </button>
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
                  onClick={() => void perform(() => editDevice(selected))}
                >
                  <Pencil />
                  Edit a copy
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
              Swipe down to close. Swipe up for actions. Pinch to zoom; drag to
              pan. Sharing originals may include location metadata. Edits are
              saved as new photos.
            </p>
            {busy && <p role="status">Preparing…</p>}
            {error && <p role="alert">{error}</p>}
          </section>
        </div>
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
