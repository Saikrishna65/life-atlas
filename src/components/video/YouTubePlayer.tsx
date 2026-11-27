"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play, RotateCcw, WifiOff } from "lucide-react";
import { embedUrl, loadYouTubeApi, playerFailure, type EmbeddedPlayer } from "@/lib/video/player";
type Status = "connecting" | "ready" | "playing" | "paused" | "buffering" | "ended" | "blocked" | "slow" | "offline" | "error";
const labels: Record<Status, string> = {
  connecting: "Connecting to the player…", ready: "Ready to play", playing: "Playing", paused: "Paused", buffering: "Buffering…",
  ended: "Video finished", blocked: "Tap Play to start this video.", slow: "The player is taking longer than usual. You can try its controls or reload it.",
  offline: "You’re offline. Reconnect, then reload the player.", error: "The player couldn’t connect. You can try its controls or reload it.",
};
export default function YouTubePlayer({ id, title, autoplay }: { id: string; title: string; autoplay: boolean }) {
  const host = useRef<HTMLDivElement>(null), player = useRef<EmbeddedPlayer | null>(null);
  const resumeAt = useRef(0), autoplayAtOpen = useRef(autoplay);
  const [attempt, setAttempt] = useState(0), [status, setStatus] = useState<Status>("connecting"), [message, setMessage] = useState("");
  const metrics = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, apiPlayer: EmbeddedPlayer | null = null, slowTimer: ReturnType<typeof setTimeout>;
    const started = performance.now();
    const metricElement = metrics.current;
    const update = (value: Status, detail = "") => {
      if (disposed) return;
      clearTimeout(slowTimer); setStatus(value); setMessage(detail);
      if (["connecting", "buffering"].includes(value)) slowTimer = setTimeout(() => update("slow"), 15000);
    };
    const iframe = document.createElement("iframe");
    iframe.title = title;
    iframe.src = embedUrl(id, window.location.origin, autoplayAtOpen.current, resumeAt.current);
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true; iframe.referrerPolicy = "strict-origin-when-cross-origin";
    element.append(iframe);
    // The embed starts immediately; API loading never gates the media request.
    const online = () => update("slow", "You’re back online. Reload the player to reconnect.");
    const offline = () => update("offline");
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    slowTimer = setTimeout(() => update("slow"), 15000);
    if (!navigator.onLine) queueMicrotask(offline);
    void loadYouTubeApi().then((api) => {
      if (disposed) return;
      apiPlayer = new api.Player(iframe, { events: {
        onReady: () => {
          if (disposed) return;
          if (metricElement) metricElement.dataset.readyMs = String(Math.round(performance.now() - started));
          update("ready");
        },
        onStateChange: ({ data }) => {
          if (disposed) return;
          if (data === 1 && metricElement && !metricElement.dataset.startupMs) metricElement.dataset.startupMs = String(Math.round(performance.now() - started));
          const states: Record<number, Status> = { [-1]: "ready", 0: "ended", 1: "playing", 2: "paused", 3: "buffering", 5: "ready" };
          if (states[data]) update(states[data]);
        },
        onAutoplayBlocked: () => update("blocked"),
        onError: ({ data }) => update("error", playerFailure(data)),
      } });
      player.current = apiPlayer;
    }).catch(() => update(navigator.onLine ? "error" : "offline"));
    return () => {
      disposed = true; clearTimeout(slowTimer);
      window.removeEventListener("online", online); window.removeEventListener("offline", offline);
      player.current = null;
      try { apiPlayer?.destroy(); } catch {}
      element.replaceChildren();
    };
  }, [id, title, attempt]);
  const needsRetry = ["error", "offline", "slow"].includes(status);
  const canPlay = ["ready", "paused", "blocked", "ended"].includes(status);
  return <div className="video-playback" ref={metrics} data-playback-state={status}>
    <div className="video-player-frame" ref={host}/>
    <div className="video-playback-status" data-error={needsRetry}>
      <p role="status" aria-live="polite">{["connecting", "buffering"].includes(status) && <LoaderCircle size={14}/ >}{status === "offline" && <WifiOff size={14}/ >}{message || labels[status]}</p>
      {canPlay && <button onClick={() => { try { player.current?.playVideo(); } catch { setStatus("error"); } }}><Play size={14}/> {status === "ended" ? "Play again" : "Play video"}</button>}
      {needsRetry && <button onClick={() => {
        try { const time = player.current?.getCurrentTime(); if (typeof time === "number" && Number.isFinite(time)) resumeAt.current = Math.max(0, time); } catch {}
        if (metrics.current) { delete metrics.current.dataset.startupMs; delete metrics.current.dataset.readyMs; }
        setStatus("connecting"); setMessage(""); setAttempt((value) => value + 1);
      }}><RotateCcw size={14}/>Reload player</button>}
    </div>
  </div>;
}
