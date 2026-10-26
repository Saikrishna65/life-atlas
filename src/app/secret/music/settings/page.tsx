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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav />

      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-slate-900 font-normal tracking-tight">
          Vault Storage & Diagnostics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Storage allocations, metadata backups, and offline cache operations.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs font-mono text-amber-900 animate-fade-in shadow-xs">
          {feedback}
        </div>
      )}

      {/* Storage Breakdown */}
      {report && (
        <div className="p-6 rounded-3xl glass-card-premium border border-slate-200/90 space-y-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Physical Storage Metrics</h3>
              <p className="text-xs text-slate-500">IndexedDB audio blob footprint on device</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Total Tracks</span>
              <span className="text-lg font-mono font-bold text-slate-900 mt-0.5 block">{report.totalTracks}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Imported Audio</span>
              <span className="text-lg font-mono font-bold text-emerald-700 mt-0.5 block">{report.importedTracks}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Downloads</span>
              <span className="text-lg font-mono font-bold text-sky-700 mt-0.5 block">{report.downloadedTracks}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Allocated Size</span>
              <span className="text-lg font-mono font-bold text-amber-800 mt-0.5 block">{report.formattedSize}</span>
            </div>
          </div>
        </div>
      )}

      {/* Backup and Restore */}
      <div className="p-6 rounded-3xl glass-card-premium border border-slate-200/90 space-y-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
        <h3 className="text-sm font-semibold text-slate-900">Library Backup & Restoration</h3>
        <p className="text-xs text-slate-500">
          Export your playlist architecture and track metadata into a portable JSON document.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-card-subtle hover:bg-white border border-slate-200 text-xs font-sans text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <Download className="w-4 h-4 text-amber-600" />
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-card-subtle hover:bg-white border border-slate-200 text-xs font-sans text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <Upload className="w-4 h-4 text-sky-600" />
            <span>Restore from Backup</span>
          </button>

          <button
            onClick={handleSeedSamples}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-card-subtle hover:bg-white border border-slate-200 text-xs font-sans text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Reload Sample Tracks</span>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-3xl bg-rose-50/50 border border-rose-200 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-rose-700">
          <ShieldAlert className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Reset Music Vault</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Wipes the local Music Vault IndexedDB table. Does not affect Trip Vault expeditions or public records.
        </p>
        <button
          onClick={handleResetDatabase}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 text-xs font-semibold tracking-wide transition-all cursor-pointer active:scale-95"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Wipe & Reset Music Database</span>
        </button>
      </div>
    </div>
  );
}
