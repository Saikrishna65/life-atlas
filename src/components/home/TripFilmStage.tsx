"use client";
import {usePublicLoading} from "@/components/layout/PublicPageReady";
import { useCallback, useEffect, useRef, useState } from "react";
import { heroHandoffAt, HERO_PRELOAD_AT_SECONDS } from "./hero-playback";

/** The outgoing decoder stays alive until the incoming video has painted a frame. */
export default function TripFilmStage({
  films=[],
  active,
  outgoing,
  requested,
  count,
  playing,
  reduced,
  onReveal,
  onProgress,
  onEnd,
  onStatus,
}: {
  films?:ReadonlyArray<{src:string;poster:string;fallback:string}>;
  active: number;
  outgoing: number | null;
  requested: number;
  count: number;
  playing: boolean;
  reduced: boolean;
  onReveal: (index: number) => void;
  onProgress: (value: number) => void;
  onEnd: () => void;
  onStatus: (status: "stock" | "fallback" | "failed" | "blocked") => void;
}) {
  const publicLoading=usePublicLoading();
  const [prepared,setPrepared]=useState<number[]>([]);
  const [prewarmed, setPrewarmed] = useState<number | null>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const failedSlots = useRef(new Set<number>());
  const generations = useRef([0, 0, 0]);
  const [fallbacks, setFallbacks] = useState<boolean[]>([false, false, false]);
  const current = useRef({
    active,
    requested,
    playing,
    reduced,
    onReveal,
    onProgress,
    onEnd,
    onStatus,
  });
  useEffect(() => {
    current.current = {
      active,
      requested,
      playing,
      reduced,
      onReveal,
      onProgress,
      onEnd,
      onStatus,
    };
  });
  useEffect(()=>{
    if(!publicLoading)return;
    let alive=true;
    queueMicrotask(()=>{
      if(!alive)return;
      // Cached frames/errors can arrive before React attaches media listeners.
      const broken=videos.current.flatMap((video,index)=>video?.error&&!fallbacks[index]?[index]:[]);
      if(broken.length)setFallbacks(previous=>previous.map((value,index)=>value||broken.includes(index)));
      const ready=videos.current.flatMap((video,index)=>video&&video.readyState>=2?[index]:[]);
      setPrepared(previous=>ready.some(index=>!previous.includes(index))?[...new Set([...previous,...ready])]:previous);
    });
    return ()=>{alive=false;};
  },[publicLoading,fallbacks]);
  const reveal = useCallback((index: number, element: HTMLVideoElement) => {
    const state = current.current;
    if (index !== state.requested || element.readyState < 2) return;
    if(index!==state.active)setPrepared(previous=>previous.filter(slot=>slot!==state.active));
    state.onReveal(index);
  }, []);
  useEffect(() => {
    let disposed = false;
    const frames = new Set<number>();
    const rafs = new Set<number>();
    const target = videos.current[requested];
    if (!target) return;
    if (failedSlots.current.has(requested)) {
      current.current.onStatus("failed");
      return;
    }
    if (requested !== active && target.currentTime > 0.05)
      target.currentTime = 0;
    const paint = () => {
      if (disposed || target.readyState < (playing ? 3 : 2)) return;
      if (playing && requested !== active) {
        const ahead =
          Array.from(
            { length: target.buffered.length },
            (_, i) => target.buffered.end(i) - target.currentTime,
          ).find(
            (seconds, i) =>
              target.buffered.start(i) <= target.currentTime + 0.05 &&
              seconds > 0,
          ) ?? 0;
        if (ahead < Math.min(1.4, (target.duration || 10) / 2)) return;
      }
      const generation = generations.current[requested];
      const commit = () => {
        if (!disposed && generation === generations.current[requested])
          reveal(requested, target);
      };
      if (playing && "requestVideoFrameCallback" in target) {
        const id = target.requestVideoFrameCallback(() => {
          frames.delete(id);
          commit();
        });
        frames.add(id);
      } else {
        rafs.add(
          requestAnimationFrame(() => {
            rafs.add(requestAnimationFrame(commit));
          }),
        );
      }
    };
    target.addEventListener("loadeddata", paint);
    target.addEventListener("canplay", paint);
    target.addEventListener("progress", paint);
    videos.current.forEach((v, index) => {
      if (!v) return;
      const needed =
        index === active || index === requested || index === outgoing;
      if (playing && needed)
        void v
          .play()
          .then(() => {
            if (index === requested) paint();
          })
          .catch(() => {
            if (!disposed && index === requested) {
              current.current.onStatus("blocked");
              if (v.readyState >= 2) reveal(index, v);
            }
          });
      else v.pause();
    });
    if (target.readyState >= 2) paint();
    return () => {
      disposed = true;
      frames.forEach((id) => target.cancelVideoFrameCallback(id));
      rafs.forEach(cancelAnimationFrame);
      target.removeEventListener("loadeddata", paint);
      target.removeEventListener("canplay", paint);
      target.removeEventListener("progress", paint);
    };
  }, [active, requested, playing, outgoing, fallbacks, reveal]);
  useEffect(() => {
    current.current.onStatus(fallbacks[active] ? "fallback" : "stock");
  }, [active, fallbacks]);
  useEffect(() => {
    const elements = videos.current.filter((v) => v !== null);
    return () =>
      elements.forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
  }, []);
  return (
    <div
      className="trip-film-stage"
      aria-hidden="true"
      data-transitioning={requested !== active}
    >
      {films.slice(0, count).map((film, index) => {
        const mounted =
          publicLoading || prepared.includes(index) || index === active ||
          index === requested ||
          index === outgoing ||
          (index === prewarmed && playing && !reduced);
        return (
          <video
            key={index}
            ref={(el) => {
              videos.current[index] = el;
            }}
            data-film-index={index}
            data-showing={index === active}
            data-outgoing={index === outgoing}
            src={
              mounted
                ? fallbacks[index]
                  ? film.fallback
                  : film.src
                : undefined
            }
            poster={film.poster || undefined}
            muted
            playsInline
            preload={publicLoading?"metadata":mounted?(index===active||index===requested||index===outgoing||(index===prewarmed&&playing&&!reduced)?"auto":"metadata"):"none"}
            onLoadedData={()=>{if(index!==outgoing)setPrepared(previous=>previous.includes(index)?previous:[...previous,index]);}}
            disablePictureInPicture
            tabIndex={-1}
            onError={() => {
              generations.current[index]++;
              if (!fallbacks[index] && film.fallback)
                setFallbacks((old) =>
                  old.map((value, i) => (i === index ? true : value)),
                );
              else {
                failedSlots.current.add(index);
                if (index === current.current.requested)
                  current.current.onStatus("failed");
              }
            }}
            onTimeUpdate={(e) => {
              if (index !== current.current.active) return;
              const element = e.currentTarget;
              const duration = heroHandoffAt(element.duration);
              const connection = (
                navigator as Navigator & { connection?: { saveData?: boolean } }
              ).connection;
              if (
                element.currentTime >= HERO_PRELOAD_AT_SECONDS &&
                current.current.playing &&
                !current.current.reduced &&
                outgoing === null &&
                count > 1 &&
                !connection?.saveData
              ) {
                const next = (index + 1) % count;
                if (prewarmed !== next) setPrewarmed(next);
              }
              current.current.onProgress(
                Math.min(1, element.currentTime / duration),
              );
              if (
                element.currentTime >= duration &&
                current.current.playing &&
                !current.current.reduced &&
                current.current.requested === index
              )
                current.current.onEnd();
            }}
            onEnded={() => {
              if (
                index === current.current.active &&
                current.current.playing &&
                !current.current.reduced &&
                current.current.requested === index
              )
                current.current.onEnd();
            }}
          />
        );
      })}
    </div>
  );
}
