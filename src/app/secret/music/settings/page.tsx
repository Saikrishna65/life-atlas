"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { HardDrive, Cloud, DownloadCloud, UploadCloud, RefreshCw, FileDown, FileUp, ShieldAlert, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import {
  getStorageReport,
  exportLibraryJSON,
  getAllTracks,
  saveTrack,
  savePlaylist,
  deleteMusicDB,
} from "@/lib/music/storage";
import { MusicStorageReport, MusicTrack, MusicPlaylist } from "@/lib/music/types";
import { syncCloudToLocalStorage, downloadTrackToLocalStorage, uploadTrackToCloud } from "@/lib/music/cloudSync";
import { Sheet, notifyLibraryChanged, hasLocalAudio, hasCloudCopy } from "@/components/music/ui";
import { revokeSecretAccess } from "@/lib/deviceAuth";

function Row({
  icon: Icon,
  title,
  body,
  onClick,
  disabled,
  tint = "from-slate-500 to-slate-700",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  onClick: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-4 p-3.5 rounded-3xl bg-white/[0.06] border border-white/10 text-left active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
    >
      <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${tint} flex items-center justify-center shrink-0 shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-white">{title}</span>
        <span className="block text-xs text-white/45 mt-0.5">{body}</span>
      </span>
    </button>
  );
}

export default function MusicVaultSettingsPage() {
  const [report, setReport] = useState<MusicStorageReport | null>(null);
  const [cloudCount, setCloudCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setReport(await getStorageReport());
      const tracks = await getAllTracks();
      setCloudCount(tracks.filter(hasCloudCopy).length);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 5000);
  };

  const wrap = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    try {
      flash(await fn());
    } catch (e) {
      flash(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
      notifyLibraryChanged();
      load();
    }
  };

  const syncCloud = () =>
    wrap("Syncing with cloud…", async () => {
      const r = await syncCloudToLocalStorage();
      return `Cloud sync complete · ${r.total} songs online`;
    });

  const saveAllOffline = () =>
    wrap("Saving songs to phone…", async () => {
      let n = 0;
      for (const t of await getAllTracks()) {
        if (!hasLocalAudio(t) && hasCloudCopy(t)) {
          try {
            await downloadTrackToLocalStorage(t);
            n++;
          } catch {
            /* continue */
          }
        }
      }
      return `Saved ${n} song${n === 1 ? "" : "s"} to this phone`;
    });

  const backupAll = () =>
    wrap("Backing up to cloud…", async () => {
      let n = 0;
      for (const t of await getAllTracks()) {
        if (hasLocalAudio(t) && !hasCloudCopy(t)) {
          const r = await uploadTrackToCloud(t, t.audioBlob);
          if (r.success) n++;
        }
      }
      return n ? `Backed up ${n} song${n === 1 ? "" : "s"}` : "Nothing new to back up (large files over 4.5 MB can't be uploaded).";
    });

  const exportJSON = () =>
    wrap("Exporting…", async () => {
      const json = await exportLibraryJSON();
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `atlas_music_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return "Library exported";
    });

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    wrap("Restoring…", async () => {
      const data = JSON.parse(await file.text());
      for (const t of data.tracks || []) await saveTrack(t as MusicTrack);
      for (const p of data.playlists || []) await savePlaylist(p as MusicPlaylist);
      return "Backup restored";
    }).finally(() => {
      if (importRef.current) importRef.current.value = "";
    });
  };

  const wipe = async () => {
    setWipeOpen(false);
    await wrap("Clearing…", async () => {
      await deleteMusicDB();
      return "Phone library cleared. Your cloud copy is untouched.";
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="px-1 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-300/75">Storage · Cloud · Privacy</p>
        <h1 className="font-display text-[34px] leading-none text-white mt-1">Vault</h1>
      </header>

      {(busy || note) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 text-sm text-white">
          {busy && <Loader2 className="w-4 h-4 animate-spin text-fuchsia-300" />}
          <span>{busy || note}</span>
        </div>
      )}

      {/* Storage */}
      <section className="rounded-[28px] p-5 bg-gradient-to-br from-fuchsia-600/25 via-purple-600/15 to-indigo-600/20 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-5 h-5 text-fuchsia-300" />
          <h2 className="font-semibold text-white">Storage Telemetry</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-display text-3xl text-white">{report?.totalTracks ?? "–"}</p>
            <p className="text-[11px] text-white/45 uppercase tracking-wider mt-0.5">Songs</p>
          </div>
          <div>
            <p className="font-display text-3xl text-white">{report?.formattedSize ?? "–"}</p>
            <p className="text-[11px] text-white/45 uppercase tracking-wider mt-0.5">On phone</p>
          </div>
          <div>
            <p className="font-display text-3xl text-white">{cloudCount}</p>
            <p className="text-[11px] text-white/45 uppercase tracking-wider mt-0.5">In cloud</p>
          </div>
        </div>
      </section>

      {/* Cloud */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Cloud</h2>
        <Row icon={RefreshCw} tint="from-sky-400 to-indigo-600" title="Sync with cloud" body="Fetch your online library" onClick={syncCloud} disabled={!!busy} />
        <Row icon={DownloadCloud} tint="from-emerald-400 to-teal-600" title="Save all to phone" body="Make every cloud song playable offline" onClick={saveAllOffline} disabled={!!busy} />
        <Row icon={UploadCloud} tint="from-amber-400 to-orange-600" title="Back up phone songs" body="Upload songs that aren't in the cloud" onClick={backupAll} disabled={!!busy} />
      </section>

      {/* Backup */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Backup</h2>
        <Row icon={FileDown} tint="from-violet-400 to-purple-600" title="Export library" body="Songs & playlists as a JSON file" onClick={exportJSON} disabled={!!busy} />
        <Row icon={FileUp} tint="from-pink-400 to-rose-600" title="Restore from file" body="Import a JSON backup" onClick={() => importRef.current?.click()} disabled={!!busy} />
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={importJSON} />
      </section>

      {/* Security & danger */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Security</h2>
        <Link
          href="/secret"
          onClick={() => revokeSecretAccess()}
          className="w-full flex items-center gap-4 p-3.5 rounded-3xl bg-white/[0.06] border border-white/10 active:scale-[0.98] transition-all"
        >
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-white" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-white">Lock vault</span>
            <span className="block text-xs text-white/45 mt-0.5">Ask for fingerprint next time</span>
          </span>
        </Link>
        <button
          onClick={() => setWipeOpen(true)}
          className="w-full flex items-center gap-4 p-3.5 rounded-3xl bg-rose-500/10 border border-rose-500/25 text-left active:scale-[0.98] cursor-pointer"
        >
          <span className="w-11 h-11 rounded-2xl bg-rose-500/80 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-white" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-rose-300">Clear phone library</span>
            <span className="block text-xs text-white/45 mt-0.5">Cloud copies are kept</span>
          </span>
        </button>
      </section>

      <Sheet open={wipeOpen} onClose={() => setWipeOpen(false)}>
        <div className="p-2 space-y-4">
          <div>
            <p className="font-semibold text-lg text-white">Clear the phone library?</p>
            <p className="text-sm text-white/50 mt-1">
              Songs saved only on this phone will be lost. Trip Vault and Finance are not touched.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setWipeOpen(false)} className="py-3.5 rounded-2xl bg-white/10 font-semibold text-white cursor-pointer">Cancel</button>
            <button onClick={wipe} className="py-3.5 rounded-2xl bg-rose-500 font-semibold text-white cursor-pointer">Clear</button>
          </div>
        </div>
      </Sheet>

      <p className="text-center text-xs text-white/25 pb-4 flex items-center justify-center gap-1.5">
        <Cloud className="w-3 h-3" /> Atlas Sonic
      </p>
    </div>
  );
}
