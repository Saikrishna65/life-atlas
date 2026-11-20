"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { videoTime } from "@/components/media/JournalVideo";
export default function ViewerVideo({
  src,
  poster,
  show,
  onActivity,
}: {
  src: string;
  poster?: string;
  show: boolean;
  onActivity: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(true),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [failed, setFailed] = useState(false),
    [waiting, setWaiting] = useState(true);
  useEffect(() => {
    const v = video.current!;
    void v.play().catch(() => setWaiting(false));
    return () => v.pause();
  }, [src]);
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
        onPause={() => setPlaying(false)}
        onPlaying={() => setWaiting(false)}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onError={() => {
          setFailed(true);
          setWaiting(false);
        }}
      />
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
