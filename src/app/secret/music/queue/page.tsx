"use client";

import React from "react";
import Image from "next/image";
import {
  ListOrdered,
  Play,
  Pause,
  Trash2,
  ChevronUp,
  ChevronDown,
  Music,
  Shuffle,
  Volume2,
} from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";

export default function QueuePage() {
  const {
    queue,
    queueIndex,
    currentTrack,
    isPlaying,
    togglePlayPause,
    playTrack,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    toggleShuffle,
    isShuffle,
    sourceContext,
  } = useMusicPlayer();

  const handleMoveQueueItem = (index: number, direction: "UP" | "DOWN") => {
    const newIndex = direction === "UP" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= queue.length) return;

    const copy = [...queue];
    const [moved] = copy.splice(index, 1);
    copy.splice(newIndex, 0, moved);

    reorderQueue(copy);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28">
      <MusicNav />

      {/* Queue Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-foreground font-normal">
            Up Next Queue ({queue.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            {sourceContext?.title ? `Playing from: ${sourceContext.title}` : "Interactive playlist queue."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleShuffle}
            className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
              isShuffle ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-white/5 hover:bg-white/10 text-neutral-300"
            }`}
            title="Toggle shuffle queue"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={clearQueue}
            disabled={queue.length === 0}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 text-neutral-300 hover:text-rose-400 text-xs font-sans transition-colors disabled:opacity-50 cursor-pointer"
          >
            Clear Queue
          </button>
        </div>
      </div>

      {/* Now Playing Featured in Queue */}
      {currentTrack && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-semibold block">
            Currently Playing
          </span>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                {currentTrack.artworkUrl ? (
                  <Image
                    src={currentTrack.artworkUrl}
                    alt={currentTrack.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <Music className="w-5 h-5 text-amber-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-amber-400 truncate">
                  {currentTrack.title}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {currentTrack.artist}
                </p>
              </div>
            </div>

            <button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Queue Items */}
      <div className="space-y-1.5">
        {queue.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 text-muted-foreground text-xs space-y-2">
            <ListOrdered className="w-8 h-8 text-muted-foreground/60 mx-auto" />
            <p>Queue is empty.</p>
          </div>
        ) : (
          queue.map((t, idx) => {
            const isPlayingThis = idx === queueIndex;
            return (
              <div
                key={`${t.id}-${idx}`}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isPlayingThis
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-surface hover:bg-surface-hover/80 border-white/5"
                }`}
              >
                {/* Steppers */}
                <div className="flex flex-col items-center justify-center shrink-0 w-6">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveQueueItem(idx, "UP")}
                    className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-20 cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-muted-foreground">{idx + 1}</span>
                  <button
                    disabled={idx === queue.length - 1}
                    onClick={() => handleMoveQueueItem(idx, "DOWN")}
                    className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-20 cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Track Details */}
                <div
                  onClick={() => playTrack(t, queue, sourceContext)}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                >
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                    {t.artworkUrl ? (
                      <Image
                        src={t.artworkUrl}
                        alt={t.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Music className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-xs sm:text-sm font-medium truncate ${
                        isPlayingThis ? "text-amber-400" : "text-foreground"
                      }`}
                    >
                      {t.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground truncate">{t.artist}</p>
                  </div>
                </div>

                {/* Remove from Queue */}
                <button
                  onClick={() => removeFromQueue(idx)}
                  className="p-1.5 text-neutral-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10 cursor-pointer shrink-0"
                  title="Remove from queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
