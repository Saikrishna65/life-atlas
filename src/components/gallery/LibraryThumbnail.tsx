"use client";
import { useEffect, useRef, useState } from "react";
import { Film, ImageIcon } from "lucide-react";
import { R2 } from "@/lib/r2/native";
import { gallerySource } from "@/lib/gallery/actions";
import type { LibraryItem } from "@/lib/gallery/library";
let active = 0;
const waiting: (() => void)[] = [];
export default function LibraryThumbnail({
  item,
  session,
}: {
  item: LibraryItem;
  session: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    [url, setUrl] = useState(""),
    [near, setNear] = useState(false);
  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(
      (e) => setNear(e[0].isIntersecting),
      { rootMargin: "150px" },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near || !item.hasThumbnail) return;
    let live = true;
    void (async () => {
      await new Promise<void>((resolve) => {
        if (active < 4) {
          active++;
          resolve();
        } else waiting.push(resolve);
      });
      try {
        if (!live) return;
        const result = await R2.libraryThumbnail({ id: item.id, session });
        if (live) setUrl(result.url || gallerySource(result.path!));
      } catch {
      } finally {
        const next = waiting.shift();
        if (next) next();
        else active--;
      }
    })();
    return () => {
      live = false;
    };
  }, [near, item.id, item.hasThumbnail, session]);
  return (
    <div ref={root} className="gl-thumb">
      {url ? (
        // Native foreground-only file URL; Next image optimization cannot serve it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
        />
      ) : item.kind === "video" ? (
        <Film />
      ) : (
        <ImageIcon />
      )}
    </div>
  );
}
