"use client";
import {onPublicPreload,publicPreloading} from "@/lib/public-loading/readiness";
import { useEffect, useRef } from "react";

/** Native streaming, with no video decoding for off-screen journal frames. */
export default function DetailFilm({ src, poster, paused, label, posterPolicy = "always", onMetadata }: { src: string; poster?: string; paused: boolean; label: string; posterPolicy?: "always" | "reduced-motion"; onMetadata?: (video: HTMLVideoElement) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (posterPolicy === "reduced-motion") {
        if (motion.matches && poster) video.poster = poster;
        else video.removeAttribute("poster");
      }
      if(publicPreloading()&&!motion.matches&&!video.getAttribute("src")){video.src=src;video.preload="metadata";}
      if (visible && !publicPreloading() && !paused && !document.hidden && !motion.matches) {
        if (video.getAttribute("src") !== src) video.src = src;
        void video.play().catch(() => { /* Poster and the explicit viewer remain available. */ });
      } else video.pause();
    };
    const releasePreload=onPublicPreload(update);
    window.addEventListener("atlas-public-loading",update);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: .1 });
    observer.observe(video);
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    return () => { releasePreload();window.removeEventListener("atlas-public-loading",update);observer.disconnect(); video.pause(); document.removeEventListener("visibilitychange", update); motion.removeEventListener("change", update); };
  }, [src, paused, poster, posterPolicy]);
  return <video ref={ref} className="td-auto-film" data-poster-policy={posterPolicy} poster={posterPolicy === "always" ? poster || undefined : undefined} onLoadedMetadata={event => onMetadata?.(event.currentTarget)} onLoadedData={event => { event.currentTarget.dataset.ready = "true"; }} muted loop playsInline autoPlay preload="none" aria-label={label} />;
}
