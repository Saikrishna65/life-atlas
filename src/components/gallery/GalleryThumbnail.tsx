"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Film, ImageIcon } from "lucide-react";
import type { GalleryAsset } from "@/lib/gallery/types";
import { R2 } from "@/lib/r2/native";
import { gallerySource } from "@/lib/gallery/actions";
// Native thumbnails only, bounded concurrency. No full originals fetched by the grid.
let active = 0;
const waiting: (() => void)[] = [];
const cached = new Map<string, { path: string }>();
const variants = new Map<string, number>();
let previewEpoch = 0;
if (typeof window !== "undefined")
  window.addEventListener("atlas:gallery-preview-settings", () => {
    previewEpoch++;
    cached.clear();
    variants.clear();
  });
if (typeof window !== "undefined")
  window.addEventListener("atlas:gallery-analysis", () => {
    cached.clear();
    variants.clear();
  });
export function invalidateThumbnail(id: string) {
  cached.delete(id);
  variants.delete(id);
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("atlas:gallery-thumbnail", { detail: id }),
    );
}
export function cachedThumbnail(id: string) {
  const value = cached.get(id);
  return value ? gallerySource(value.path) : undefined;
}
export async function thumbnail(
  id: string,
  stillNeeded: () => boolean,
  pixels = 768,
) {
  const epoch = previewEpoch;
  if (cached.has(id) && (variants.get(id) || 0) >= pixels)
    return cached.get(id)!;
  await new Promise<void>((resolve) => {
    if (active < 3) {
      active++;
      resolve();
    } else waiting.push(resolve);
  });
  try {
    if (!stillNeeded()) throw Error("Thumbnail no longer visible");
    const result = await R2.getDeviceThumbnail({ id, pixels });
    if (epoch !== previewEpoch) throw Error("Preview settings changed");
    variants.set(id, pixels);
    cached.set(id, result);
    if (cached.size > 240) {
      const oldest = cached.keys().next().value!;
      cached.delete(oldest);
      variants.delete(oldest);
    }
    return result;
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export default function GalleryThumbnail({
  asset,
  paused = false,
}: {
  asset: GalleryAsset;
  paused?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    retried = useRef(false);
  const [near, setNear] = useState(false),
    [source, setSource] = useState(asset.thumbnail || ""),
    [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const change = (event: Event) => {
      if ((event as CustomEvent<string>).detail === asset.id) {
        setSource("");
        setFailed(false);
        retried.current = false;
      }
    };
    const settings = () => {
      setSource("");
      setFailed(false);
      retried.current = false;
      setRevision((n) => n + 1);
    };
    window.addEventListener("atlas:gallery-thumbnail", change);
    window.addEventListener("atlas:gallery-preview-settings", settings);
    return () => {
      window.removeEventListener("atlas:gallery-thumbnail", change);
      window.removeEventListener("atlas:gallery-preview-settings", settings);
    };
  }, [asset.id]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => setNear(entries[0].isIntersecting),
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (paused || !near || source || !asset.device) return;
    let mounted = true;
    const bounds = root.current?.getBoundingClientRect();
    const ratio = Math.max(
      1,
      (asset.device?.height || 1) / (asset.device?.width || 1),
      (asset.device?.width || 1) / (asset.device?.height || 1),
    );
    const pixels = Math.ceil(
      Math.max(bounds?.width || 160, bounds?.height || 160) *
        Math.min(devicePixelRatio || 1, 3) *
        Math.min(ratio, 2),
    );
    void thumbnail(asset.device.id, () => mounted, pixels)
      .then((result) => {
        if (mounted) {
          setFailed(false);
          setSource(gallerySource(result.path));
        }
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [
    near,
    source,
    asset.device,
    asset.device?.width,
    asset.device?.height,
    paused,
    revision,
  ]);
  return (
    <div className="pg-thumbnail" ref={root}>
      {near && source && !failed ? (
        <Image
          src={source}
          alt=""
          fill
          unoptimized
          sizes="(max-width:650px) 45vw, 25vw"
          loading="lazy"
          decoding="async"
          onError={() => {
            if (asset.device && !retried.current) {
              retried.current = true;
              // Retry locally; broadcasting here would reset every instance's retry guard.
              cached.delete(asset.device.id);
              setSource("");
            } else setFailed(true);
          }}
        />
      ) : asset.kind === "video" ? (
        <Film size={27} strokeWidth={1} />
      ) : (
        <ImageIcon size={27} strokeWidth={1} />
      )}
    </div>
  );
}
