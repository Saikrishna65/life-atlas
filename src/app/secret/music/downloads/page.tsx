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
  const { playTrack, currentTrack, deleteDownloadedCopy } = useMusicPlayer();
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28">
      <MusicNav onTrackImported={loadData} />

      {/* Storage & Offline Status Card */}
      <div className="p-6 rounded-3xl bg-surface border border-emerald-500/20 bg-gradient-to-br from-[#111818] via-surface to-background space-y-4 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <WifiOff className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl sm:text-2xl text-foreground font-normal">
                  Offline Sanctuary
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-semibold uppercase">
                  Airplane Mode Ready
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every track below is physically cached in persistent app storage. Zero network dependency.
              </p>
            </div>
          </div>

          {offlineTracks.length > 0 && (
            <button
              onClick={handlePlayAllOffline}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-sans text-xs font-semibold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Offline ({offlineTracks.length})</span>
            </button>
          )}
        </div>

        {/* Storage Bar */}
        {storageReport && (
          <div className="pt-2 border-t border-white/5 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                <span>Storage Footprint:</span>
              </span>
              <span className="font-mono text-foreground font-medium">
                {storageReport.formattedSize} ({storageReport.importedTracks} imported, {storageReport.downloadedTracks} downloaded)
              </span>
            </div>

            {storageReport.quotaUsedPercentage !== undefined && (
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: `${Math.min(storageReport.quotaUsedPercentage, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Offline Track List */}
      <div className="space-y-2">
        <h3 className="font-display text-lg text-foreground font-normal">
          Available Offline Tracks ({offlineTracks.length})
        </h3>

        {offlineTracks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 text-muted-foreground text-xs space-y-2">
            <DownloadCloud className="w-8 h-8 text-muted-foreground/60 mx-auto" />
            <p>No offline tracks currently stored.</p>
            <p className="text-muted-foreground/80">
              Import personal audio files or download online streams to make them available offline.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
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
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group active:scale-[0.99] ${
                    isCurrent
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-surface hover:bg-surface-hover/80 border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
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
                        <Music className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs sm:text-sm font-medium truncate ${
                          isCurrent ? "text-emerald-400" : "text-foreground group-hover:text-emerald-300"
                        }`}
                      >
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.artist} • {(t.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t.source === "IMPORTED" ? "Imported" : "Downloaded"}</span>
                    </span>

                    {t.source === "DOWNLOADED" && (
                      <button
                        onClick={(e) => handleRemoveDownload(t.id, e)}
                        className="p-1.5 text-muted-foreground hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
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
