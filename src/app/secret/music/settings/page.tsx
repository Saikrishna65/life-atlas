"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import {
  getStorageReport,
  exportLibraryJSON,
  getAllTracks,
  saveTrack,
  savePlaylist,
  deleteMusicDB,
} from "@/lib/music/storage";
import { MusicStorageReport, MusicTrack, MusicPlaylist } from "@/lib/music/types";
import { CURATED_EXPEDITION_SAMPLES } from "@/lib/music/samples";

export default function MusicSettingsPage() {
  const [report, setReport] = useState<MusicStorageReport | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReport = async () => {
    try {
      const rep = await getStorageReport();
      setReport(rep);
    } catch (err) {
      console.error("Failed loading storage report:", err);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExportJSON = async () => {
    try {
      const json = await exportLibraryJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `life_atlas_music_vault_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback("Library metadata exported successfully.");
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback("Export failed.");
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const data = JSON.parse(text);

        if (Array.isArray(data.tracks)) {
          for (const t of data.tracks) {
            await saveTrack(t as MusicTrack);
          }
        }
        if (Array.isArray(data.playlists)) {
          for (const pl of data.playlists) {
            await savePlaylist(pl as MusicPlaylist);
          }
        }

        setFeedback("Library metadata backup restored successfully.");
        await loadReport();
        setTimeout(() => setFeedback(null), 3500);
      } catch (err) {
        setFeedback("Invalid JSON backup file format.");
        setTimeout(() => setFeedback(null), 3500);
      }
    };
    reader.readAsText(file);
  };

  const handleSeedSamples = async () => {
    try {
      for (const sample of CURATED_EXPEDITION_SAMPLES) {
        const newTrack: MusicTrack = {
          ...sample,
          id: `trk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          addedAt: Date.now(),
        };
        await saveTrack(newTrack);
      }
      setFeedback("Expedition sample tracks refreshed.");
      await loadReport();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback("Failed seeding sample tracks.");
    }
  };

  const handleResetDatabase = async () => {
    if (
      confirm(
        "Are you sure you want to reset the Music Vault database? All imported music tracks and custom playlists will be erased. (Trip Vault expeditions will NOT be touched)."
      )
    ) {
      await deleteMusicDB();
      await loadReport();
      setFeedback("Music Vault reset to factory empty state.");
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28">
      <MusicNav />

      <div>
        <h2 className="font-display text-2xl text-foreground font-normal">
          Vault Settings & Maintenance
        </h2>
        <p className="text-xs text-muted-foreground">
          Storage allocations, metadata backups, and offline cache operations.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-300 animate-fade-in">
          {feedback}
        </div>
      )}

      {/* Storage Breakdown */}
      {report && (
        <div className="p-6 rounded-3xl bg-surface border border-white/5 space-y-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Local Storage Metrics</h3>
              <p className="text-xs text-muted-foreground">Physical disk usage by audio files</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-white/5">
              <span className="text-[10px] text-muted-foreground font-mono uppercase block">Total Tracks</span>
              <span className="text-lg font-mono font-semibold text-foreground">{report.totalTracks}</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5">
              <span className="text-[10px] text-muted-foreground font-mono uppercase block">Imported Audio</span>
              <span className="text-lg font-mono font-semibold text-emerald-400">{report.importedTracks}</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5">
              <span className="text-[10px] text-muted-foreground font-mono uppercase block">Downloads</span>
              <span className="text-lg font-mono font-semibold text-cyan-400">{report.downloadedTracks}</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5">
              <span className="text-[10px] text-muted-foreground font-mono uppercase block">Total Size</span>
              <span className="text-lg font-mono font-semibold text-amber-400">{report.formattedSize}</span>
            </div>
          </div>
        </div>
      )}

      {/* Backup and Restore */}
      <div className="p-6 rounded-3xl bg-surface border border-white/5 space-y-4 shadow-soft">
        <h3 className="text-sm font-medium text-foreground">Library Backup & Restoration</h3>
        <p className="text-xs text-muted-foreground">
          Export your playlist architecture and track metadata into a portable JSON document.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-sans text-neutral-200 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Export Library JSON</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json,application/json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-sans text-neutral-200 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Restore from Backup</span>
          </button>

          <button
            onClick={handleSeedSamples}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-sans text-neutral-200 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Reload Sample Tracks</span>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-3xl bg-surface border border-rose-500/20 space-y-3 shadow-soft">
        <div className="flex items-center gap-2.5 text-rose-400">
          <ShieldAlert className="w-4 h-4" />
          <h3 className="text-sm font-medium">Reset Music Vault</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Wipes the local Music Vault IndexedDB table. Does not affect Trip Vault expeditions or public records.
        </p>
        <button
          onClick={handleResetDatabase}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Wipe & Reset Music Database</span>
        </button>
      </div>
    </div>
  );
}
