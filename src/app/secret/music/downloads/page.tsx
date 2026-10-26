"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  DownloadCloud,
  CheckCircle2,
  Trash2,
  Play,
  HardDrive,
  WifiOff,
  Music,
  Disc,
} from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getSmartPlaylistTracks,
  getStorageReport,
  getAllTracks,
} from "@/lib/music/storage";
import { MusicTrack, MusicStorageReport } from "@/lib/music/types";

export default function DownloadsPage() {
  const { playTrack, currentTrack, isPlaying, deleteDownloadedCopy } = useMusicPlayer();
  const [offlineTracks, setOfflineTracks] = useState<MusicTrack[]>([]);
  const [storageReport, setStorageReport] = useState<MusicStorageReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const offline = await getSmartPlaylistTracks("OFFLINE");
      const report = await getStorageReport();
      setOfflineTracks(offline);
      setStorageReport(report);
    } catch (err) {
      console.error("Failed loading offline sanctuary:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePlayAllOffline = () => {
    if (offlineTracks.length > 0) {
      playTrack(offlineTracks[0], offlineTracks, {
        type: "SMART_PLAYLIST",
        title: "Offline Sanctuary",
      });
    }
  };

  const handleRemoveDownload = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Remove downloaded copy from offline storage? The track will revert to streaming.")) {
      await deleteDownloadedCopy(trackId);
      await loadData();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={loadData} />

      {/* Storage & Offline Status Card */}
      <div className="p-6 rounded-3xl glass-card-premium border border-emerald-500/25 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-4">
        {/* Emerald Ambient Light Wash */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              <WifiOff className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl sm:text-2xl text-white font-normal tracking-tight">
                  Offline Sanctuary
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold uppercase shadow-xs">
                  Airplane Mode Ready
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Physically cached in device storage. 100% zero network or cell coverage required.
              </p>
            </div>
          </div>

          {offlineTracks.length > 0 && (
            <button
              onClick={handlePlayAllOffline}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-neutral-950 font-sans text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95 cursor-pointer shrink-0"
            >
              <Play className="w-4 h-4 fill-current stroke-[2.5]" />
              <span>Play Sanctuary ({offlineTracks.length})</span>
            </button>
          )}
        </div>

        {/* Storage Bar */}
        {storageReport && (
          <div className="relative z-10 pt-3 border-t border-white/10 space-y-2 text-xs">
            <div className="flex justify-between text-neutral-300">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Device Footprint:</span>
              </span>
              <span className="font-mono text-white font-semibold">
                {storageReport.formattedSize} ({storageReport.importedTracks} imported, {storageReport.downloadedTracks} downloaded)
              </span>
            </div>

            {storageReport.quotaUsedPercentage !== undefined && (
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full shadow-[0_0_10px_#10b981]"
                  style={{ width: `${Math.min(storageReport.quotaUsedPercentage, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Offline Track List */}
      <div className="space-y-3">
        <h3 className="font-display text-lg text-white font-normal flex items-center gap-2">
          <span>Cached Soundtracks</span>
          <span className="text-xs font-mono text-neutral-400">({offlineTracks.length})</span>
        </h3>

        {offlineTracks.length === 0 ? (
          <div className="p-10 text-center rounded-3xl glass-card-subtle border border-dashed border-white/10 text-neutral-400 text-xs space-y-2">
            <DownloadCloud className="w-8 h-8 text-neutral-500 mx-auto" />
            <p className="text-neutral-300 font-medium">No offline tracks currently stored.</p>
            <p className="text-neutral-500">
              Import personal audio files or download online streams to make them available offline.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {offlineTracks.map((t) => {
              const isCurrent = currentTrack?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() =>
                    playTrack(t, offlineTracks, {
                      type: "SMART_PLAYLIST",
                      title: "Offline Sanctuary",
                    })
                  }
                  className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3.5 cursor-pointer group active:scale-[0.99] ${
                    isCurrent
                      ? "bg-emerald-500/15 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                      : "glass-card-subtle hover:bg-white/[0.08] border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#121622] border border-white/10 shrink-0 flex items-center justify-center shadow-md">
                      {t.artworkUrl ? (
                        <Image
                          src={t.artworkUrl}
                          alt={t.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <Disc className="w-5 h-5 text-emerald-400" />
                      )}

                      {isCurrent && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                          {isPlaying ? (
                            <div className="flex items-end gap-0.5 h-3" aria-label="Playing">
                              <span className="w-0.5 bg-emerald-400 rounded-full animate-eq-1" />
                              <span className="w-0.5 bg-emerald-400 rounded-full animate-eq-2" />
                              <span className="w-0.5 bg-emerald-400 rounded-full animate-eq-3" />
                            </div>
                          ) : (
                            <Play className="w-4 h-4 fill-emerald-400 text-emerald-400 ml-0.5" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                          isCurrent ? "text-emerald-300" : "text-white group-hover:text-emerald-200"
                        }`}
                      >
                        {t.title}
                      </h4>
                      <p className="text-[11px] font-sans text-neutral-400 truncate mt-0.5">
                        {t.artist || "Unknown Artist"} • {(t.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>{t.source === "IMPORTED" ? "Local" : "Cached"}</span>
                    </span>

                    {t.source === "DOWNLOADED" && (
                      <button
                        onClick={(e) => handleRemoveDownload(t.id, e)}
                        className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/15 transition-colors cursor-pointer"
                        title="Remove downloaded copy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
