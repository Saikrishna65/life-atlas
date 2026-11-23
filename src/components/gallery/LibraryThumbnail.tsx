"use client";
import { useEffect, useRef, useState } from "react";
import { Film, ImageIcon } from "lucide-react";
import { R2 } from "@/lib/r2/native";
import { gallerySource } from "@/lib/gallery/actions";
import type { LibraryItem } from "@/lib/gallery/library";
import { galleryMediaRequests } from "@/lib/gallery/media-requests";
export default function LibraryThumbnail({
  item,
  session,
}: {
  item: LibraryItem;
  session: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    [preview, setPreview] = useState<{ key: string; url: string }>(),
    [near, setNear] = useState(false);
  const previewKey = JSON.stringify([session, item.id]);
  const url = preview?.key === previewKey ? preview.url : "";
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
    if (!near || !item.hasThumbnail || url) return;
    let live = true;
    void (async () => {
      try {
        if (!live) return;
        const result = await galleryMediaRequests.run(
          JSON.stringify(["private-library", session, item.id]),
          () => live,
          () => R2.libraryThumbnail({ id: item.id, session }),
        );
        if (live)
          setPreview({
            key: previewKey,
            url: result.url || gallerySource(result.path!),
          });
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, [near, item.id, item.hasThumbnail, session, url, previewKey]);
  return (
    <div ref={root} className="gl-thumb">
      {near && url ? (
        // Native foreground-only file URL; Next image optimization cannot serve it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" />
      ) : item.kind === "video" ? (
        <Film />
      ) : (
        <ImageIcon />
      )}
    </div>
  );
}
