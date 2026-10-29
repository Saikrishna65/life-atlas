"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Library,
  ListMusic,
  SlidersHorizontal,
  Plus,
  Link2,
  Smartphone,
  CloudDownload,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Sheet, gradientFor, notifyLibraryChanged } from "@/components/music/ui";
import MiniPlayer from "@/components/music/MiniPlayer";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { importAudioFiles } from "@/lib/music/importLocal";
import { syncCloudToLocalStorage } from "@/lib/music/cloudSync";
import { openFilePicker, markPickerGotFile, triggerHaptic } from "@/lib/deviceAuth";

const TABS = [
  { href: "/secret/music", label: "Home", icon: Home },
  { href: "/secret/music/library", label: "Library", icon: Library },
  { href: "__add__", label: "Add", icon: Plus },
  { href: "/secret/music/playlists", label: "Playlists", icon: ListMusic },
  { href: "/secret/music/settings", label: "Vault", icon: SlidersHorizontal },
];

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const { currentTrack, isPlaying } = useMusicPlayer();
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, ms = 4500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => {
    const open = () => setAddOpen(true);
    window.addEventListener("lifeatlas_music_add", open);
    return () => window.removeEventListener("lifeatlas_music_add", open);
  }, []);

  const pickFiles = () => {
    setAddOpen(false);
    openFilePicker(fileRef.current, () =>
      showToast(
        "No song received from the Android file picker. Open the picker menu, choose Audio or Files, and select your song.",
        7000
      )
    );
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    markPickerGotFile();
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (list.length === 0) return;
    setBusy(`Importing ${list.length} song${list.length > 1 ? "s" : ""}…`);
    try {
      const r = await importAudioFiles(list, (done, total, name) =>
        setBusy(name ? `Importing ${done + 1}/${total} · ${name}` : "Finishing…")
      );
      notifyLibraryChanged();
      const parts = [`Added ${r.imported} song${r.imported === 1 ? "" : "s"}`];
      if (r.duplicates) parts.push(`${r.duplicates} already in library`);
      if (r.failed.length) parts.push(`${r.failed.length} failed (${r.failed[0]})`);
      showToast(parts.join(" · "), 6000);
      triggerHaptic(r.imported ? "success" : "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openYouTube = () => {
    setAddOpen(false);
    triggerHaptic("tap");
    const win = window as unknown as { __openYouTubeModal?: (u?: string) => void };
    if (typeof win.__openYouTubeModal === "function") win.__openYouTubeModal("");
    else window.dispatchEvent(new CustomEvent("lifeatlas_youtube_share", { detail: { url: "" } }));
  };

  const syncCloud = async () => {
    setAddOpen(false);
    setBusy("Syncing with cloud…");
    try {
      const r = await syncCloudToLocalStorage();
      notifyLibraryChanged();
      showToast(`Cloud sync done · ${r.total} song${r.total === 1 ? "" : "s"} in cloud`);
    } catch {
      showToast("Could not reach the cloud.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sonic-dark fixed inset-0 z-20 bg-[#05050a] text-white overflow-hidden font-body">
      {/* Playback-reactive Obsidian Aurora ambience */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {currentTrack?.artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentTrack.artworkUrl}
            alt=""
            className={`absolute -top-20 inset-x-0 w-full h-[55%] object-cover blur-[110px] scale-125 transition-opacity duration-1000 ${
              isPlaying ? "opacity-25" : "opacity-10"
            }`}
          />
        )}
        <div
          className={`absolute -top-44 -left-28 w-[440px] h-[440px] rounded-full bg-gradient-to-br ${
            currentTrack ? gradientFor(currentTrack.id) : "from-fuchsia-600 via-purple-600 to-indigo-700"
          } opacity-25 blur-[120px] ${isPlaying ? "animate-aurora" : ""}`}
        />
        <div className="absolute top-1/3 -right-36 w-[400px] h-[400px] rounded-full bg-indigo-600/20 blur-[130px]" />
        <div className="absolute -bottom-44 left-8 w-[380px] h-[380px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,#05050a_75%)]" />
      </div>

      <main className="relative h-full overflow-y-auto overscroll-contain pt-[max(env(safe-area-inset-top),1.1rem)] pb-[calc(env(safe-area-inset-bottom)+11.5rem)] px-4 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-2xl mx-auto">{children}</div>
      </main>

      {/* Status toast */}
      {(busy || toast) && (
        <div className="fixed left-4 right-4 top-[max(env(safe-area-inset-top),0.75rem)] z-[70] max-w-md mx-auto">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#161622]/95 backdrop-blur-2xl border border-white/15 shadow-2xl text-sm text-white animate-fade-in">
            {busy && <Loader2 className="w-4 h-4 animate-spin text-fuchsia-300 shrink-0" />}
            <span className="min-w-0">{busy || toast}</span>
          </div>
        </div>
      )}

      {/* Floating Now Playing bar + Bottom Dock */}
      <MiniPlayer embedded />
      <nav
        className="fixed bottom-[max(env(safe-area-inset-bottom),0.75rem)] inset-x-4 z-30 max-w-md mx-auto"
        aria-label="Music navigation"
      >
        <div className="relative flex items-center justify-between rounded-[30px] bg-[#11111a]/92 backdrop-blur-2xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)] px-2 h-[4.25rem]">
          {TABS.map((tab) => {
            if (tab.href === "__add__") {
              return (
                <div key="add" className="w-16 flex justify-center">
                  <button
                    onClick={() => {
                      triggerHaptic("tap");
                      setAddOpen(true);
                    }}
                    className="group relative -mt-8 w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 text-white flex items-center justify-center shadow-[0_12px_32px_rgba(168,85,247,0.55)] border-4 border-[#05050a] active:scale-90 transition-transform cursor-pointer"
                    aria-label="Add music"
                  >
                    <span
                      className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/35"
                      aria-hidden="true"
                    />
                    <Plus className="w-7 h-7 stroke-[2.5]" />
                  </button>
                </div>
              );
            }
            const active =
              tab.href === "/secret/music" ? pathname === tab.href : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => triggerHaptic("tap")}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 h-full rounded-2xl transition-colors ${
                  active ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {active && (
                  <span
                    className="absolute top-1.5 w-5 h-[3px] rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 shadow-[0_0_10px_rgba(232,121,249,0.9)]"
                    aria-hidden="true"
                  />
                )}
                <Icon className={`w-[21px] h-[21px] transition-transform ${active ? "text-fuchsia-300 scale-105" : ""}`} />
                <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Hidden picker (single instance for the whole vault) */}
      <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={onFiles} />

      {/* Add sheet: the ONE place to bring music in */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="px-1 mb-4">
          <p className="text-[10px] tracking-[0.22em] uppercase text-fuchsia-300/80 font-semibold">Atlas Sonic</p>
          <h3 className="font-display text-2xl text-white mt-0.5">Add music</h3>
          <p className="text-xs text-white/45 mt-0.5">Bring songs in from YouTube, phone storage, or cloud backup.</p>
        </div>
        <div className="space-y-2.5">
          <AddOption
            icon={Link2}
            tint="from-rose-500 via-red-500 to-amber-500"
            title="YouTube audio"
            body="Paste any video, Short, or YouTube Music link"
            onClick={openYouTube}
          />
          <AddOption
            icon={Smartphone}
            tint="from-emerald-400 via-teal-500 to-cyan-600"
            title="From this phone"
            body="Import MP3, M4A, WAV, FLAC, or AAC files"
            onClick={pickFiles}
          />
          <AddOption
            icon={CloudDownload}
            tint="from-sky-400 via-indigo-500 to-purple-600"
            title="Sync from cloud"
            body="Restore tracks saved in your online vault"
            onClick={syncCloud}
          />
        </div>
      </Sheet>
    </div>
  );
}

function AddOption({
  icon: Icon,
  tint,
  title,
  body,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-3xl bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] active:scale-[0.98] transition-all text-left cursor-pointer"
    >
      <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tint} flex items-center justify-center shrink-0 shadow-lg ring-1 ring-inset ring-white/25`}>
        <Icon className="w-6 h-6 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">{title}</span>
        <span className="block text-xs text-white/50 mt-0.5">{body}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
    </button>
  );
}
