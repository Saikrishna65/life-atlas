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
if (typeof window !== "undefined")
  window.addEventListener("atlas:gallery-analysis", () => cached.clear());
export function invalidateThumbnail(id: string) {
  cached.delete(id);
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("atlas:gallery-thumbnail", { detail: id }),
    );
}
export function cachedThumbnail(id: string) {
  const value = cached.get(id);
  return value ? gallerySource(value.path) : undefined;
}
export async function thumbnail(id: string, stillNeeded: () => boolean) {
  if (cached.has(id)) return cached.get(id)!;
  await new Promise<void>((resolve) => {
    if (active < 3) {
      active++;
      resolve();
    } else waiting.push(resolve);
  });
  try {
    if (!stillNeeded()) throw Error("Thumbnail no longer visible");
    const result = await R2.getDeviceThumbnail({ id });
    cached.set(id, result);
    if (cached.size > 240) cached.delete(cached.keys().next().value!);
    return result;
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export default function GalleryThumbnail({ asset }: { asset: GalleryAsset }) {
  const root = useRef<HTMLDivElement>(null),
    retried = useRef(false);
  const [near, setNear] = useState(false),
    [source, setSource] = useState(asset.thumbnail || ""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const change = (event: Event) => {
      if ((event as CustomEvent<string>).detail === asset.id) {
        setSource("");
        setFailed(false);
        retried.current = false;
      }
    };
    window.addEventListener("atlas:gallery-thumbnail", change);
    return () => window.removeEventListener("atlas:gallery-thumbnail", change);
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
    if (!near || source || !asset.device) return;
    let mounted = true;
    void thumbnail(asset.device.id, () => mounted)
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
  }, [near, source, asset.device]);
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
              invalidateThumbnail(asset.device.id);
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
