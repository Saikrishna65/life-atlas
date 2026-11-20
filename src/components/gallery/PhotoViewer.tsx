"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Info,
  Trash2,
  X,
  Plus,
  Minus,
} from "lucide-react";
import { Modal } from "@/components/world/primitives";
import type { DetailMedia } from "@/lib/public-trips/detail";
import JournalVideo from "@/components/media/JournalVideo";
import "@/components/media/journal-viewer.css";
import "./photo-viewer.css";
export default function PhotoViewer({
  items,
  selected,
  onSelect,
  onClose,
  onDetails,
  onDelete,
}: {
  items: DetailMedia[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onDetails: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  const index = items.findIndex((i) => i.id === selected),
    item = items[index];
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
    if (items.length > 1) {
      setTransform({ scale: 1, x: 0, y: 0 });
      onSelect(items[(index + n + items.length) % items.length].id);
    }
  };
  useEffect(() => {
    points.current.clear();
  }, [selected]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
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
  if (!item) return null;
  const zoom = (scale: number) => setTransform({ scale, x: 0, y: 0 });
  return (
    <Modal title="Photo viewer" className="pv-viewer" onClose={onClose}>
      <div className="pv-top">
        <button onClick={onClose} aria-label="Close photo">
          <X />
        </button>
        <span>
          {index + 1} / {items.length}
        </span>
        <button onClick={() => onDetails(selected)} aria-label="Photo details">
          <Info />
        </button>
      </div>
      <div
        className="pv-picture journal-viewer-stage"
        onDoubleClick={() => zoom(transform.scale > 1 ? 1 : 2.5)}
        onPointerDown={(e) => {
          if (item.kind === "video") return;
          e.currentTarget.setPointerCapture(e.pointerId);
          points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const p = [...points.current.values()];
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
          const p = [...points.current.values()];
          if (p.length === 2 && start.current.distance > 0) {
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
        onPointerCancel={(e) => points.current.delete(e.pointerId)}
        onPointerUp={(e) => {
          const s = start.current;
          points.current.delete(e.pointerId);
          if (!points.current.size && !s.multi && transform.scale === 1) {
            const dx = e.clientX - s.x,
              dy = e.clientY - s.y;
            if (
              Math.abs(dx) > 50 &&
              Math.abs(dx) > Math.abs(dy) * 1.3 &&
              Date.now() - s.at < 1000
            )
              move(dx < 0 ? 1 : -1);
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
        {item.kind === "video" ? (
          <JournalVideo
            key={item.id}
            src={item.url}
            poster={item.poster}
            label="Video"
          />
        ) : (
          <>
            {" "}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={item.id}
              src={item.url}
              alt={item.caption || "Photo"}
              draggable={false}
              style={{
                transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
              }}
            />
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="pv-actions">
        <button
          aria-label="Previous photo"
          disabled={items.length < 2}
          onClick={() => move(-1)}
        >
          <ArrowLeft />
        </button>
        {item.kind === "photo" && (
          <>
            <button
              aria-label="Zoom out"
              onClick={() => zoom(Math.max(1, transform.scale - 0.5))}
            >
              <Minus />
            </button>
            <button
              aria-label="Zoom in"
              onClick={() => zoom(Math.min(5, transform.scale + 0.5))}
            >
              <Plus />
            </button>
          </>
        )}
        {onDelete && (
          <button
            className="pv-delete"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "Move this file to your phone’s trash? Cloud copies and trip records will stay unchanged.",
                )
              )
                return;
              setBusy(true);
              try {
                await onDelete(selected);
              } catch {
                setError(
                  "Could not move this file to trash. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={20} />
            <span>{busy ? "Moving…" : "Delete"}</span>
          </button>
        )}
        <button
          aria-label="Next photo"
          disabled={items.length < 2}
          onClick={() => move(1)}
        >
          <ArrowRight />
        </button>
      </div>
    </Modal>
  );
}
