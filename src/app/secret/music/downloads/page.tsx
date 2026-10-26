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
      <div className="p-6 rounded-3xl glass-card-premium border border-emerald-300/60 relative overflow-hidden shadow-[0_12px_36px_rgba(15,23,42,0.06)] space-y-4">
        {/* Emerald Ambient Light Wash */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
              <WifiOff className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl sm:text-2xl text-slate-900 font-normal tracking-tight">
                  Offline Sanctuary
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono text-emerald-700 font-bold uppercase shadow-xs">
                  Airplane Mode Ready
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Physically cached in device storage. 100% zero network or cell coverage required.
              </p>
            </div>
          </div>

          {offlineTracks.length > 0 && (
            <button
              onClick={handlePlayAllOffline}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-sans text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <Play className="w-4 h-4 fill-current stroke-[2.5]" />
              <span>Play Sanctuary ({offlineTracks.length})</span>
            </button>
          )}
        </div>

        {/* Storage Bar */}
        {storageReport && (
          <div className="relative z-10 pt-3 border-t border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                <span>Device Footprint:</span>
              </span>
              <span className="font-mono text-slate-900 font-semibold">
                {storageReport.formattedSize} ({storageReport.importedTracks} imported, {storageReport.downloadedTracks} downloaded)
              </span>
            </div>

            {storageReport.quotaUsedPercentage !== undefined && (
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                  style={{ width: `${Math.min(storageReport.quotaUsedPercentage, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Offline Track List */}
      <div className="space-y-3">
        <h3 className="font-display text-lg text-slate-900 font-normal flex items-center gap-2">
          <span>Cached Soundtracks</span>
          <span className="text-xs font-mono text-slate-500">({offlineTracks.length})</span>
        </h3>

        {offlineTracks.length === 0 ? (
          <div className="p-10 text-center rounded-3xl glass-card-subtle border border-dashed border-slate-300 text-slate-500 text-xs space-y-2">
            <DownloadCloud className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-slate-700 font-medium">No offline tracks currently stored.</p>
            <p className="text-slate-500">
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
                      ? "bg-emerald-500/10 border-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/30"
                      : "glass-card-subtle hover:bg-white border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
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
                        <Disc className="w-5 h-5 text-emerald-600" />
                      )}

                      {isCurrent && (
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center">
                          {isPlaying ? (
                            <div className="flex items-end gap-0.5 h-3" aria-label="Playing">
                              <span className="w-0.5 bg-emerald-300 rounded-full animate-eq-1" />
                              <span className="w-0.5 bg-emerald-300 rounded-full animate-eq-2" />
                              <span className="w-0.5 bg-emerald-300 rounded-full animate-eq-3" />
                            </div>
                          ) : (
                            <Play className="w-4 h-4 fill-emerald-300 text-emerald-300 ml-0.5" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                          isCurrent ? "text-emerald-900" : "text-slate-900 group-hover:text-emerald-800"
                        }`}
                      >
                        {t.title}
                      </h4>
                      <p className="text-[11px] font-sans text-slate-500 truncate mt-0.5">
                        {t.artist || "Unknown Artist"} • {(t.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{t.source === "IMPORTED" ? "Local" : "Cached"}</span>
                    </span>

                    {t.source === "DOWNLOADED" && (
                      <button
                        onClick={(e) => handleRemoveDownload(t.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
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
