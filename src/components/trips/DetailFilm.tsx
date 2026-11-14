"use client";
import { useEffect, useRef } from "react";

/** Native streaming, with no video decoding for off-screen journal frames. */
export default function DetailFilm({ src, poster, paused, label }: { src: string; poster?: string; paused: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (visible && !paused && !document.hidden && !motion.matches) {
        if (video.getAttribute("src") !== src) video.src = src;
        void video.play().catch(() => { /* Poster and the explicit viewer remain available. */ });
      } else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: .1 });
    observer.observe(video);
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    return () => { observer.disconnect(); video.pause(); document.removeEventListener("visibilitychange", update); motion.removeEventListener("change", update); };
  }, [src, paused]);
  return <video ref={ref} className="td-auto-film" poster={poster || undefined} muted loop playsInline autoPlay preload="none" aria-label={label} />;
}
