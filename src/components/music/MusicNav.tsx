"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Music,
  Lock,
  Plus,
  Compass,
  ListMusic,
  Disc,
  Users,
  DownloadCloud,
  ListOrdered,
  Settings,
  Sparkles,
} from "lucide-react";
import { YoutubeIcon } from "./YoutubeIcon";
import { parseAudioFile } from "@/lib/music/metadataParser";
import { saveTrack, getAllTracks } from "@/lib/music/storage";
import { uploadTrackToCloud } from "@/lib/music/cloudSync";
import { MusicTrack } from "@/lib/music/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";

export default function MusicNav({ onTrackImported }: { onTrackImported?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Listen for track updates to refresh list
  useEffect(() => {
    const handleTracksUpdated = () => {
      if (onTrackImported) onTrackImported();
    };
    window.addEventListener("lifeatlas_tracks_updated", handleTracksUpdated);
    return () => window.removeEventListener("lifeatlas_tracks_updated", handleTracksUpdated);
  }, [onTrackImported]);

  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/secret");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setImportStatus(`Importing ${files.length} track(s)...`);

    try {
      const existingTracks = await getAllTracks();
      let importedCount = 0;
      let duplicateCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const parsed = await parseAudioFile(file);

        // Duplicate detection: matching title + artist or matching file name + size
        const isDuplicate = existingTracks.some(
          (t) =>
            (t.title.toLowerCase() === parsed.title.toLowerCase() &&
              t.artist.toLowerCase() === parsed.artist.toLowerCase()) ||
            (t.fileName === file.name && t.size === file.size)
        );

        if (isDuplicate) {
          duplicateCount++;
          continue;
        }

        const newTrack: MusicTrack = {
          id: `trk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          title: parsed.title,
          artist: parsed.artist,
          album: parsed.album,
          genre: parsed.genre,
          year: parsed.year,
          duration: parsed.duration || 0,
          format: file.type || "audio/mpeg",
          size: file.size,
          artworkUrl: parsed.artworkUrl,
          audioBlob: file,
          source: "IMPORTED",
          isFavorite: false,
          playCount: 0,
          addedAt: Date.now(),
          fileName: file.name,
        };

        await saveTrack(newTrack);
        existingTracks.push(newTrack);
        importedCount++;

        // Dual persistence: upload audio & metadata to online database and Neon Object Storage
        uploadTrackToCloud(newTrack, file)
          .then((res) => {
            if (res.success && res.audioUrl) {
              newTrack.audioUrl = res.audioUrl;
              newTrack.syncedToCloud = true;
            }
          })
          .catch((e) => console.warn("Cloud upload background error:", e));
      }

      setImportStatus(
        `Imported ${importedCount} track(s) to local storage and synced with online database${
          duplicateCount > 0 ? ` (${duplicateCount} duplicate(s) skipped)` : ""
        }`
      );

      if (onTrackImported) {
        onTrackImported();
      }

      setTimeout(() => setImportStatus(null), 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setImportStatus(`Error: ${msg}`);
      setTimeout(() => setImportStatus(null), 4000);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const navItems = [
    { href: "/secret/music", label: "Home", icon: Compass },
    { href: "/secret/music/library", label: "Library", icon: Music },
    { href: "/secret/music/playlists", label: "Playlists", icon: ListMusic },
    { href: "/secret/music/albums", label: "Albums", icon: Disc },
    { href: "/secret/music/artists", label: "Artists", icon: Users },
    { href: "/secret/music/downloads", label: "Offline", icon: DownloadCloud },
    { href: "/secret/music/queue", label: "Queue", icon: ListOrdered },
    { href: "/secret/music/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="space-y-4 mb-6 select-none">
      {/* Top Header Bar */}
      <nav className="flex items-center justify-between gap-1.5 sm:gap-2.5 pb-2">
        <Link
          href="/secret"
          className="group inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full glass-card-subtle text-xs font-sans tracking-wide text-slate-700 hover:text-slate-950 transition-all border border-slate-200/80 hover:border-slate-300 active:scale-95 shadow-xs shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1 text-slate-500 group-hover:text-amber-600 shrink-0" />
          <span className="font-medium hidden sm:inline">Private Atlas</span>
          <span className="font-medium inline sm:hidden">Atlas</span>
        </Link>

        {/* Center Audiophile Status Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1 rounded-full glass-pill-luxury text-[10px] font-mono tracking-widest text-amber-800 font-semibold uppercase shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
          </span>
          <span className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 bg-clip-text text-transparent font-bold">
            HI-FI LOSSLESS VAULT
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[9px] text-blue-700 font-mono font-bold">48kHz / 24-bit</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* YouTube Video / Shorts Direct Extractor Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("lifeatlas_youtube_share", { detail: { url: "" } }));
            }}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold tracking-wide transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Extract & Import Audio from YouTube Link or Share"
          >
            <YoutubeIcon className="w-3.5 h-3.5 fill-current shrink-0" />
            <span className="hidden sm:inline">YouTube</span>
          </button>

          {/* Hidden File Picker triggering Android Document Selector */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            multiple
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="relative group inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-95 text-slate-950 font-sans text-xs font-bold tracking-wide transition-all shadow-md disabled:opacity-50 cursor-pointer overflow-hidden"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isImporting ? "Importing..." : "Import"}</span>
          </button>

          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full glass-card-subtle hover:bg-slate-100 active:scale-95 border border-slate-200/80 text-xs font-sans text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-xs"
            title="Lock Private Atlas"
          >
            <Lock className="w-3 h-3 text-amber-600" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </nav>

      {/* Notification Toast */}
      {importStatus && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300/80 text-xs font-mono text-amber-900 backdrop-blur-xl animate-fade-in flex items-center gap-2.5 shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Capsule Navigation Bar (Editorial Light Frosted Glass Deck) */}
      <div className="glass-pill-nav rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar border border-slate-200/80 shadow-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-sans whitespace-nowrap transition-all duration-200 shrink-0 ${
                isActive
                  ? "bg-amber-500/15 text-amber-900 font-bold border border-amber-500/30 shadow-xs"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100/70 border border-transparent"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-amber-600 font-bold" : "text-slate-500"}`} />
              <span>{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b] ml-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
