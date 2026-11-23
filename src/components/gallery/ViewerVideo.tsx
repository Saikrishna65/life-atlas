"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { R2, storageError, nativeR2Available } from "@/lib/r2/native";
import { gallerySource } from "@/lib/gallery/actions";
import { useGalleryBack } from "@/lib/gallery/navigation";
import { invalidateThumbnail } from "./GalleryThumbnail";
import { videoTime } from "@/components/media/JournalVideo";
export default function ViewerVideo({
  src,
  poster,
  show,
  onActivity,
  onResumeTime,
  mediaId,
  onPosition,
}: {
  src: string;
  mediaId?: string;
  poster?: string;
  show: boolean;
  onActivity: () => void;
  onResumeTime?: () => number;
  onPosition?: (seconds: number) => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(true),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [failed, setFailed] = useState(false),
    [waiting, setWaiting] = useState(true);
  const [frames, setFrames] = useState<{ seconds: number; path: string }[]>([]),
    [framesOpen, setFramesOpen] = useState(false),
    [toolsBusy, setToolsBusy] = useState(false),
    [message, setMessage] = useState("");
  const lastSave = useRef(0),
    restoredPosition = useRef(0);
  const persist = useCallback(
    (seconds: number, ready = (video.current?.readyState || 0) >= 1) => {
      if (ready && mediaId && nativeR2Available())
        void R2.saveGalleryVideoState({ id: mediaId, seconds }).catch(() => {});
    },
    [mediaId],
  );
  useEffect(() => {
    if (!mediaId || !nativeR2Available()) return;
    let alive = true;
    void R2.getGalleryViewerState({ id: mediaId })
      .then((state) => {
        const player = video.current;
        restoredPosition.current = state.position;
        if (
          alive &&
          player &&
          player.currentTime < 1 &&
          state.position > 0 &&
          Number.isFinite(player.duration) &&
          state.position < player.duration
        )
          player.currentTime = state.position;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mediaId]);
  const browse = useCallback(async () => {
    setFramesOpen((v) => !v);
    if (frames.length || !mediaId) return;
    setToolsBusy(true);
    try {
      setFrames((await R2.getGalleryVideoFrames({ id: mediaId })).frames);
    } catch (e) {
      setMessage(storageError(e));
    } finally {
      setToolsBusy(false);
    }
  }, [frames.length, mediaId]);
  useGalleryBack(framesOpen, () => setFramesOpen(false), 105);
  useEffect(() => {
    const handler = (event: Event) => {
      const value = (event as CustomEvent<{ id: string; action: string }>)
        .detail;
      if (value?.id !== mediaId) return;
      if (value.action === "frames") void browse();
      else if (value.action === "cover") {
        setToolsBusy(true);
        void R2.saveGalleryVideoState({
          id: mediaId!,
          seconds: video.current?.currentTime || 0,
          cover: true,
        })
          .then(() => {
            invalidateThumbnail(mediaId!);
            setMessage("Video cover saved.");
          })
          .catch((e) => setMessage(storageError(e)))
          .finally(() => setToolsBusy(false));
      }
    };
    window.addEventListener("atlas:video-action", handler);
    return () => window.removeEventListener("atlas:video-action", handler);
  }, [mediaId, browse]);
  useEffect(() => {
    const v = video.current!;
    if (!document.hidden) void v.play().catch(() => setWaiting(false));
    const visibility = () => {
      if (document.hidden) v.pause();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      persist(v.currentTime, v.readyState >= 1);
      v.pause();
    };
  }, [src, persist]);
  return (
    <div className="pv-video">
      <video
        ref={video}
        src={src}
        poster={poster}
        autoPlay
        muted
        playsInline
        preload="metadata"
        aria-label="Video"
        onPlay={() => setPlaying(true)}
        onPause={(e) => {
          setPlaying(false);
          persist(e.currentTarget.currentTime);
        }}
        onPlaying={() => setWaiting(false)}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          const initialTime = Math.max(
            onResumeTime?.() || 0,
            restoredPosition.current,
          );
          if (initialTime > 0 && initialTime < e.currentTarget.duration)
            e.currentTarget.currentTime = initialTime;
        }}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          onPosition?.(e.currentTarget.currentTime);
          if (Date.now() - lastSave.current > 5000) {
            lastSave.current = Date.now();
            persist(e.currentTarget.currentTime);
          }
        }}
        onError={() => {
          setFailed(true);
          setWaiting(false);
        }}
      />
      {framesOpen && (
        <div
          className="pv-filmstrip"
          role="region"
          aria-label="Video frames"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.stopPropagation();
            onActivity();
          }}
        >
          {toolsBusy ? (
            <p>Preparing frames…</p>
          ) : (
            frames.map((frame, i) => (
              <button
                key={frame.seconds}
                aria-label={`Seek to frame ${i + 1}`}
                onClick={() => {
                  if (video.current) video.current.currentTime = frame.seconds;
                  onActivity();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gallerySource(frame.path)} alt="" loading="lazy" />
                <small>{videoTime(frame.seconds)}</small>
              </button>
            ))
          )}
        </div>
      )}
      {message && (
        <p className="pv-feedback" role="status">
          {message}
        </p>
      )}
      {waiting && (
        <span className="pv-loading" role="status">
          Loading video…
        </span>
      )}
      {failed && (
        <span className="pv-loading" role="alert">
          This video could not play.{" "}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFailed(false);
              video.current?.load();
            }}
          >
            Try again
          </button>
        </span>
      )}
      <div
        className={`pv-video-controls ${show ? "" : "is-hidden"}`}
        inert={!show}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation();
          onActivity();
        }}
        onKeyDown={onActivity}
      >
        <button
          aria-label={playing ? "Pause video" : "Play video"}
          onClick={() => {
            const v = video.current!;
            if (v.paused) void v.play().catch(() => {});
            else v.pause();
            onActivity();
          }}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <span>
          {videoTime(time)} / {videoTime(duration)}
        </span>
        <input
          aria-label="Seek video"
          type="range"
          min={0}
          max={Number.isFinite(duration) && duration > 0 ? duration : 1}
          value={Math.min(
            time,
            Number.isFinite(duration) && duration > 0 ? duration : 1,
          )}
          step={0.1}
          disabled={!Number.isFinite(duration) || duration <= 0}
          onChange={(e) => {
            video.current!.currentTime = +e.target.value;
            setTime(+e.target.value);
            onActivity();
          }}
        />
        <button
          aria-label={muted ? "Unmute video" : "Mute video"}
          onClick={() => {
            video.current!.muted = !muted;
            setMuted(!muted);
            onActivity();
          }}
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <button
          aria-label="Full screen video"
          onClick={() => {
            if (document.fullscreenElement)
              void document.exitFullscreen?.().catch(() => {});
            else
              void video.current?.parentElement
                ?.requestFullscreen?.()
                .catch(() => {});
            onActivity();
          }}
        >
          <Maximize size={20} />
        </button>
      </div>
    </div>
  );
}
