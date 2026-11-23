"use client";
import { observeGalleryVisibility } from "@/lib/gallery/visibility";
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
    [{ near, visible }, setVisibility] = useState({
      near: false,
      visible: false,
    });
  const previewKey = JSON.stringify([session, item.id]);
  const url = preview?.key === previewKey ? preview.url : "";
  useEffect(() => {
    if (!root.current) return;
    return observeGalleryVisibility(root.current, setVisibility);
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
          visible ? 0 : 1,
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
  }, [near, visible, item.id, item.hasThumbnail, session, url, previewKey]);
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
