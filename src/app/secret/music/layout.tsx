"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Link2,
  Smartphone,
  CloudDownload,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Sheet, notifyLibraryChanged } from "@/components/music/ui";
import MiniPlayer from "@/components/music/MiniPlayer";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { importAudioFiles } from "@/lib/music/importLocal";
import { syncCloudToLocalStorage } from "@/lib/music/cloudSync";
import { openFilePicker, markPickerGotFile, triggerHaptic } from "@/lib/deviceAuth";
import { useMusicTheme } from "@/lib/music/theme";

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  const { currentTrack, isPlaying } = useMusicPlayer();
  useMusicTheme(); // Synchronizes active theme attribute across document
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
    <div
      style={{ background: "#050507", color: "#ffffff" }}
      className="music-theme fixed inset-0 z-20 overflow-hidden font-body select-none"
    >
      {/* Playback-reactive ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {currentTrack?.artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentTrack.artworkUrl}
            alt=""
            className={`absolute -top-20 inset-x-0 w-full h-[55%] object-cover blur-[120px] scale-125 transition-opacity duration-1000 ${
              isPlaying ? "opacity-25" : "opacity-10"
            }`}
          />
        )}
        <div
          className={`absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full blur-[130px] bg-[#f95721]/15 ${
            isPlaying ? "animate-pulse" : ""
          }`}
        />
        <div className="absolute top-1/4 -right-32 w-[380px] h-[380px] rounded-full blur-[140px] bg-[#ff6b35]/10" />
      </div>

      {/* Main Content Area */}
      <main className="relative h-full overflow-y-auto overscroll-contain pt-[max(env(safe-area-inset-top),1.25rem)] pb-[calc(env(safe-area-inset-bottom)+6.5rem)] px-4 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-2xl mx-auto">{children}</div>
      </main>

      {/* Status Toast */}
      {(busy || toast) && (
        <div className="fixed left-4 right-4 top-[max(env(safe-area-inset-top),0.75rem)] z-[70] max-w-md mx-auto">
          <div className="flex items-center gap-3 px-4.5 py-3 rounded-2xl bg-[#18181e]/95 border border-white/10 backdrop-blur-2xl shadow-2xl text-sm text-white animate-fade-in">
            {busy && <Loader2 className="w-4 h-4 animate-spin text-[#f95721] shrink-0" />}
            <span className="min-w-0">{busy || toast}</span>
          </div>
        </div>
      )}

      {/* Floating Now Playing Bar (MiniPlayer) */}
      <MiniPlayer embedded />

      {/* Hidden File Picker */}
      <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={onFiles} />

      {/* Add Music Sheet */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="px-1 mb-4">
          <p className="text-[10px] tracking-[0.22em] uppercase text-[#f95721] font-semibold">
            NEBULA MUSIC
          </p>
          <h3 className="font-display text-2xl text-white mt-0.5">Add Music</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Bring songs in from YouTube, phone storage, or cloud backup.
          </p>
        </div>
        <div className="space-y-2.5">
          <AddOption
            icon={Link2}
            tint="from-orange-500 to-rose-600"
            title="YouTube Audio"
            body="Paste any video, Short, or YouTube Music link"
            onClick={openYouTube}
          />
          <AddOption
            icon={Smartphone}
            tint="from-[#f95721] to-[#ff7a45]"
            title="From this phone"
            body="Import MP3, M4A, WAV, FLAC, or AAC files"
            onClick={pickFiles}
          />
          <AddOption
            icon={CloudDownload}
            tint="from-neutral-700 to-neutral-900"
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
      className="w-full flex items-center gap-4 p-4 rounded-3xl bg-[#141418] border border-white/[0.08] hover:bg-[#1a1a20] active:scale-[0.98] transition-all text-left cursor-pointer"
    >
      <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tint} flex items-center justify-center shrink-0 shadow-lg ring-1 ring-inset ring-white/20`}>
        <Icon className="w-6 h-6 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">{title}</span>
        <span className="block text-xs text-neutral-400 mt-0.5">{body}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
    </button>
  );
}
