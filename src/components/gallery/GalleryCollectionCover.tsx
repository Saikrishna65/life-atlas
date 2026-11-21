"use client";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, UserRound } from "lucide-react";
import Image from "next/image";
import { R2 } from "@/lib/r2/native";
import { gallerySource } from "@/lib/gallery/actions";
import { thumbnail, invalidateThumbnail } from "./GalleryThumbnail";

export default function GalleryCollectionCover({
  mediaId,
  faceId,
}: {
  mediaId?: string;
  faceId?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const retried = useRef(false);
  const [near, setNear] = useState(false),
    [source, setSource] = useState("");
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => setNear(entries[0].isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    let alive = true;
    const request = faceId
      ? R2.getGalleryFaceThumbnail({ faceId }).then((r) => r.thumbnail)
      : mediaId
        ? thumbnail(mediaId, () => alive).then((r) => gallerySource(r.path))
        : Promise.resolve("");
    void request
      .then((value) => {
        if (alive) setSource(value);
      })
      .catch(() => {
        if (alive) setSource("");
      });
    return () => {
      alive = false;
    };
  }, [mediaId, faceId, near]);
  return (
    <span ref={root} className={`gsmart-cover${faceId ? " is-face" : ""}`}>
      {source ? (
        <Image
          src={source}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 700px) 45vw, 280px"
          loading="lazy"
          onError={() => {
            setSource("");
            if (mediaId && !faceId && !retried.current) {
              retried.current = true;
              invalidateThumbnail(mediaId);
              void thumbnail(mediaId, () => !!root.current)
                .then((r) => {
                  if (root.current) setSource(gallerySource(r.path));
                })
                .catch(() => {});
            }
          }}
        />
      ) : faceId ? (
        <UserRound aria-hidden="true" />
      ) : (
        <ImageIcon aria-hidden="true" />
      )}
    </span>
  );
}
