"use client";

import React, { useRef, useState } from "react";
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
import { parseAudioFile } from "@/lib/music/metadataParser";
import { saveTrack, getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";

export default function MusicNav({ onTrackImported }: { onTrackImported?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

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
      }

      setImportStatus(
        `Imported ${importedCount} track(s)${
          duplicateCount > 0 ? ` (${duplicateCount} duplicate(s) skipped)` : ""
        }`
      );

      if (onTrackImported) {
        onTrackImported();
      }

      setTimeout(() => setImportStatus(null), 3500);
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
      <nav className="flex items-center justify-between gap-2.5 pb-2">
        <Link
          href="/secret"
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card-subtle text-xs font-sans tracking-wide text-neutral-300 hover:text-white transition-all border border-white/10 hover:border-white/20 active:scale-95 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1 text-neutral-400 group-hover:text-amber-400" />
          <span className="font-medium">Private Atlas</span>
        </Link>

        {/* Center Audiophile Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1 rounded-full glass-pill-luxury text-[10px] font-mono tracking-widest text-amber-300 font-semibold uppercase shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
          </span>
          <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-transparent">
            HI-FI LOSSLESS VAULT
          </span>
          <span className="text-white/25">|</span>
          <span className="text-[9px] text-cyan-300/80 font-mono">48kHz / 24-bit</span>
        </div>

        <div className="flex items-center gap-2">
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
            className="relative group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-95 text-neutral-950 font-sans text-xs font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] disabled:opacity-50 cursor-pointer overflow-hidden"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isImporting ? "Importing..." : "Import"}</span>
          </button>

          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card-subtle hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-sans text-neutral-400 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Lock Private Atlas"
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </nav>

      {/* Notification Toast */}
      {importStatus && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300 backdrop-blur-xl animate-fade-in flex items-center gap-2.5 shadow-lg">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Capsule Navigation Bar (Luxury Frosted Glass Deck) */}
      <div className="glass-pill-nav rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.7)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-sans whitespace-nowrap transition-all duration-200 shrink-0 ${
                isActive
                  ? "bg-gradient-to-r from-amber-500/25 via-amber-500/15 to-transparent text-amber-300 font-semibold border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-transparent"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-amber-400" : "text-neutral-400"}`} />
              <span>{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] ml-0.5 animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
