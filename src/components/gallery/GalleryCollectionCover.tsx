"use client";
import { observeGalleryVisibility } from "@/lib/gallery/visibility";
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
  const [{ near, visible }, setVisibility] = useState({
      near: false,
      visible: false,
    }),
    [source, setSource] = useState("");
  const identity = JSON.stringify([mediaId, faceId]);
  const [shown, setShown] = useState(identity);
  if (shown !== identity) {
    setShown(identity);
    setSource("");
  }
  useEffect(() => {
    retried.current = false;
  }, [identity]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    return observeGalleryVisibility(element, setVisibility);
  }, []);
  useEffect(() => {
    if (!near || source) return;
    let alive = true;
    const request = faceId
      ? R2.getGalleryFaceThumbnail({ faceId }).then((r) => r.thumbnail)
      : mediaId
        ? thumbnail(mediaId, () => alive, 768, undefined, visible ? 0 : 1).then(
            (r) => gallerySource(r.path),
          )
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
  }, [mediaId, faceId, near, visible, source]);
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
