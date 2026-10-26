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
    router.push("/secret/vault");
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
    <div className="space-y-4 mb-6">
      {/* Top Header Bar */}
      <nav className="flex items-center justify-between border-b border-muted/30 pb-4">
        <Link
          href="/secret"
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Private Atlas</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono tracking-wider text-amber-400 font-semibold uppercase">
            <Music className="w-3.5 h-3.5 text-amber-400" />
            <span>Music Vault</span>
          </div>

          <button
            onClick={handleLockVault}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-muted hover:border-foreground/30 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Lock Private Atlas"
          >
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Lock</span>
          </button>
        </div>
      </nav>

      {/* Action Row: Title + Import Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight flex items-center gap-2.5">
            <span>Expedition Soundtrack</span>
          </h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Offline personal audio archive & background roadtrip listening.
          </p>
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-sans text-xs font-semibold tracking-wide transition-all shadow-md disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{isImporting ? "Importing..." : "Import Audio"}</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {importStatus && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-300 animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Category Navigation Pills (Horizontally scrollable on mobile) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar border-b border-white/5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? "bg-amber-500/15 text-amber-400 font-medium border border-amber-500/30"
                  : "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
