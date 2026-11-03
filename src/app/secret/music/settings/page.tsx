"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { HardDrive, Cloud, DownloadCloud, UploadCloud, RefreshCw, FileDown, FileUp, ShieldAlert, Loader2, Palette, Check } from "lucide-react";
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
import { MUSIC_THEMES, useMusicTheme } from "@/lib/music/theme";
import { triggerHaptic } from "@/lib/deviceAuth";

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
      className="w-full flex items-center gap-4 p-3.5 rounded-3xl sonic-glass text-left active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
    >
      <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${tint} flex items-center justify-center shrink-0 shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[var(--mv-text)]">{title}</span>
        <span className="block text-xs text-[var(--mv-text-muted)] mt-0.5">{body}</span>
      </span>
    </button>
  );
}

export default function MusicVaultSettingsPage() {
  const { theme, setTheme } = useMusicTheme();
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--mv-accent)]">
          Theme · Storage · Cloud
        </p>
        <h1 className="font-display text-[34px] leading-none text-[var(--mv-text)] mt-1">Vault Settings</h1>
      </header>

      {(busy || note) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl sonic-glass text-sm text-[var(--mv-text)]">
          {busy && <Loader2 className="w-4 h-4 animate-spin text-[var(--mv-accent)]" />}
          <span>{busy || note}</span>
        </div>
      )}

      {/* 1-Tap Multi-Palette Theme Switcher */}
      <section className="space-y-3" aria-label="Color Theme Switcher">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mv-text-muted)] flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-[var(--mv-accent)]" /> Appearance
          </h2>
          <span className="text-[11px] text-[var(--mv-text-subtle)]">1-tap switch</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {MUSIC_THEMES.map((option) => {
            const active = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  setTheme(option.id);
                }}
                aria-pressed={active}
                className={`relative p-3.5 rounded-[24px] text-left transition-all active:scale-[0.97] cursor-pointer border ${
                  active
                    ? "bg-[var(--mv-accent-soft)] border-[var(--mv-accent)] shadow-[0_12px_28px_-8px_var(--mv-glow)]"
                    : "sonic-glass hover:bg-[var(--mv-card-hover)]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center -space-x-1.5">
                    {option.swatches.map((hex, idx) => (
                      <span
                        key={hex + idx}
                        className="w-5 h-5 rounded-full ring-2 ring-black/20 border border-white/25 shadow-sm"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                  {active && (
                    <span className="w-5 h-5 rounded-full bg-[var(--mv-accent)] text-[var(--mv-accent-fg)] flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-[14px] font-bold text-[var(--mv-text)] leading-tight">
                  {option.name}
                </p>
                <p className="text-[11px] text-[var(--mv-text-muted)] mt-0.5 leading-snug line-clamp-2">
                  {option.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Storage */}
      <section
        className="rounded-[28px] p-5 border border-[var(--mv-border-strong)]"
        style={{
          background:
            "linear-gradient(135deg, var(--mv-accent-soft) 0%, var(--mv-card) 100%)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-5 h-5 text-[var(--mv-accent)]" />
          <h2 className="font-semibold text-[var(--mv-text)]">Storage Telemetry</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-display text-3xl text-[var(--mv-text)]">{report?.totalTracks ?? "–"}</p>
            <p className="text-[11px] text-[var(--mv-text-muted)] uppercase tracking-wider mt-0.5">Songs</p>
          </div>
          <div>
            <p className="font-display text-3xl text-[var(--mv-text)]">{report?.formattedSize ?? "–"}</p>
            <p className="text-[11px] text-[var(--mv-text-muted)] uppercase tracking-wider mt-0.5">On phone</p>
          </div>
          <div>
            <p className="font-display text-3xl text-[var(--mv-text)]">{cloudCount}</p>
            <p className="text-[11px] text-[var(--mv-text-muted)] uppercase tracking-wider mt-0.5">In cloud</p>
          </div>
        </div>
      </section>

      {/* Cloud */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mv-text-muted)]">Cloud</h2>
        <Row icon={RefreshCw} tint="from-sky-500 to-cyan-700" title="Sync with cloud" body="Fetch your online library" onClick={syncCloud} disabled={!!busy} />
        <Row icon={DownloadCloud} tint="from-emerald-500 to-teal-700" title="Save all to phone" body="Make every cloud song playable offline" onClick={saveAllOffline} disabled={!!busy} />
        <Row icon={UploadCloud} tint="from-amber-500 to-orange-700" title="Back up phone songs" body="Upload songs that aren't in the cloud" onClick={backupAll} disabled={!!busy} />
      </section>

      {/* Backup */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mv-text-muted)]">Backup</h2>
        <Row icon={FileDown} tint="from-amber-600 to-yellow-700" title="Export library" body="Songs & playlists as a JSON file" onClick={exportJSON} disabled={!!busy} />
        <Row icon={FileUp} tint="from-teal-500 to-cyan-700" title="Restore from file" body="Import a JSON backup" onClick={() => importRef.current?.click()} disabled={!!busy} />
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={importJSON} />
      </section>

      {/* Danger zone */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mv-text-muted)]">Danger Zone</h2>
        <button
          onClick={() => setWipeOpen(true)}
          className="w-full flex items-center gap-4 p-3.5 rounded-3xl bg-rose-500/10 border border-rose-500/25 text-left active:scale-[0.98] cursor-pointer"
        >
          <span className="w-11 h-11 rounded-2xl bg-rose-500/85 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-white" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-rose-500">Clear phone library</span>
            <span className="block text-xs text-[var(--mv-text-muted)] mt-0.5">Cloud copies are kept</span>
          </span>
        </button>
      </section>

      <Sheet open={wipeOpen} onClose={() => setWipeOpen(false)}>
        <div className="p-2 space-y-4">
          <div>
            <p className="font-semibold text-lg text-[var(--mv-text)]">Clear the phone library?</p>
            <p className="text-sm text-[var(--mv-text-muted)] mt-1">
              Songs saved only on this phone will be lost. Trip Vault and Finance are not touched.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setWipeOpen(false)} className="py-3.5 rounded-2xl bg-[var(--mv-input)] border border-[var(--mv-border)] font-semibold text-[var(--mv-text)] cursor-pointer">Cancel</button>
            <button onClick={wipe} className="py-3.5 rounded-2xl bg-rose-500 font-semibold text-white cursor-pointer">Clear</button>
          </div>
        </div>
      </Sheet>

      <p className="text-center text-xs text-[var(--mv-text-subtle)] pb-4 flex items-center justify-center gap-1.5">
        <Cloud className="w-3 h-3" /> Atlas Sonic
      </p>
    </div>
  );
}
