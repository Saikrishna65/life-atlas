"use client";
import { useEffect, useRef, useState } from "react";
import { R2 } from "@/lib/r2/native";
import { deviceAsset } from "@/lib/gallery/model";
import type { DeviceMedia } from "@/lib/gallery/types";
import GalleryThumbnail from "./GalleryThumbnail";
import { ImageIcon } from "lucide-react";
export default function AlbumCover({
  name,
  initial,
}: {
  name: string;
  initial?: DeviceMedia;
}) {
  const root = useRef<HTMLDivElement>(null),
    [photo, setPhoto] = useState(initial);
  useEffect(() => {
    if (initial || !root.current) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        void R2.listDeviceMedia({
          cursor: "",
          album: name,
          kind: "all",
          query: "",
          order: "newest",
        })
          .then((page) => {
            if (alive) setPhoto(page.items[0]);
          })
          .catch(() => {});
      },
      { rootMargin: "150px" },
    );
    io.observe(root.current);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [initial, name]);
  const cover = initial ?? photo;
  return (
    <div ref={root} className="gc-cover">
      {cover ? (
        <GalleryThumbnail asset={deviceAsset(cover, [])} />
      ) : (
        <ImageIcon size={30} />
      )}
    </div>
  );
}
