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
  Disc,
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav />

      {/* Queue Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-slate-900 font-normal tracking-tight">
            Up Next Queue ({queue.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {sourceContext?.title ? `Playing from: ${sourceContext.title}` : "Interactive playlist queue."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleShuffle}
            className={`p-2.5 rounded-2xl text-xs transition-all cursor-pointer border ${
              isShuffle
                ? "bg-amber-500/15 text-amber-900 border-amber-400 shadow-xs"
                : "glass-card-subtle text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
            title="Toggle shuffle queue"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={clearQueue}
            disabled={queue.length === 0}
            className="px-3.5 py-2.5 rounded-2xl glass-card-subtle hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 text-xs font-sans transition-all disabled:opacity-40 cursor-pointer active:scale-95 shadow-xs"
          >
            Clear Queue
          </button>
        </div>
      </div>

      {/* Now Playing Featured in Queue */}
      {currentTrack && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white/95 border border-amber-300 space-y-2.5 relative overflow-hidden shadow-[0_4px_24px_rgba(245,158,11,0.12)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-900 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>CURRENTLY PLAYING</span>
            </span>
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 bg-amber-500 rounded-full animate-eq-1" />
              <span className="w-0.5 bg-amber-500 rounded-full animate-eq-2" />
              <span className="w-0.5 bg-sky-500 rounded-full animate-eq-3" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
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
                  <Disc className="w-5 h-5 text-amber-600" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-900 truncate">
                  {currentTrack.title}
                </h4>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {currentTrack.artist || "Unknown Artist"}
                </p>
              </div>
            </div>

            <button
              onClick={togglePlayPause}
              className="w-11 h-11 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white flex items-center justify-center transition-all shadow-md cursor-pointer shrink-0 active:scale-90"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current stroke-[2.5]" /> : <Play className="w-4 h-4 fill-current stroke-[2.5] ml-0.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Queue Items */}
      <div className="space-y-2">
        {queue.length === 0 ? (
          <div className="p-12 text-center rounded-3xl glass-card-subtle border border-dashed border-slate-300 text-slate-500 text-xs space-y-2">
            <ListOrdered className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-slate-700 font-medium">Queue is empty.</p>
            <p className="text-slate-500">Add songs to your queue from your Library or Playlists.</p>
          </div>
        ) : (
          queue.map((t, idx) => {
            const isPlayingThis = idx === queueIndex;
            return (
              <div
                key={`${t.id}-${idx}`}
                className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3.5 ${
                  isPlayingThis
                    ? "bg-amber-500/10 border-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.12)] ring-1 ring-amber-400/30"
                    : "glass-card-subtle hover:bg-white border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-sm"
                }`}
              >
                {/* Steppers */}
                <div className="flex flex-col items-center justify-center shrink-0 w-6">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveQueueItem(idx, "UP")}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer active:scale-90 transition-transform"
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-500">{idx + 1}</span>
                  <button
                    disabled={idx === queue.length - 1}
                    onClick={() => handleMoveQueueItem(idx, "DOWN")}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer active:scale-90 transition-transform"
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Track Details */}
                <div
                  onClick={() => playTrack(t, queue, sourceContext)}
                  className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer group"
                >
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
                    {t.artworkUrl ? (
                      <Image
                        src={t.artworkUrl}
                        alt={t.title}
                        fill
                        sizes="44px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Disc className="w-4 h-4 text-amber-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                        isPlayingThis ? "text-amber-900" : "text-slate-900 group-hover:text-amber-800"
                      }`}
                    >
                      {t.title}
                    </h4>
                    <p className="text-[11px] font-sans text-slate-500 truncate mt-0.5">{t.artist || "Unknown Artist"}</p>
                  </div>
                </div>

                {/* Remove from Queue */}
                <button
                  onClick={() => removeFromQueue(idx)}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-xl hover:bg-rose-50 cursor-pointer shrink-0 active:scale-90"
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
