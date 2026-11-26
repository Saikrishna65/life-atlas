"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  Play,
  Search,
  Settings2,
  X,
  ExternalLink,
} from "lucide-react";
import { appServiceUrl } from "@/lib/appNetwork";
import { youtubeId, type VideoResult } from "@/lib/video/search";
import "./video-web.css";
let memoryTheme = "mono";
function currentTheme() {
  try {
    const saved = localStorage.getItem("atlas-video-web-theme");
    return saved && ["mono", "paper", "ink"].includes(saved)
      ? saved
      : memoryTheme;
  } catch {
    return memoryTheme;
  }
}
function subscribeTheme(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("atlas-video-theme", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("atlas-video-theme", listener);
  };
}
function chooseTheme(value: string) {
  memoryTheme = value;
  try {
    localStorage.setItem("atlas-video-web-theme", value);
  } catch {}
  window.dispatchEvent(new Event("atlas-video-theme"));
}
export default function AtlasVideoWeb() {
  const [query, setQuery] = useState(""),
    [videos, setVideos] = useState<VideoResult[]>([]),
    [selected, setSelected] = useState<VideoResult | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [searched, setSearched] = useState(false),
    [account, setAccount] = useState(false);
  const theme = useSyncExternalStore(
    subscribeTheme,
    currentTheme,
    () => "mono",
  );
  const controller = useRef<AbortController | null>(null),
    input = useRef<HTMLInputElement>(null),
    player = useRef<HTMLElement>(null);
  useEffect(() => {
    return () => controller.current?.abort();
  }, []);
  async function search() {
    const text = query.trim();
    if (!text) return;
    controller.current?.abort();
    setError("");
    setAccount(false);
    const id = youtubeId(text);
    if (id) {
      setSelected({
        id,
        title: "YouTube video",
        channel: "",
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration: "",
      });
      setBusy(false);
      return;
    }
    if (text.length > 120) {
      setError("Use up to 120 characters for search.");
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      const response = await fetch(appServiceUrl("/api/video/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
        signal: request.signal,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Search unavailable");
      if (!request.signal.aborted) {
        setVideos(data.videos);
        setSearched(true);
      }
    } catch (e) {
      if (!request.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Could not search right now.",
        );
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  return (
    <main className="video-web" data-theme={theme}>
      <header>
        <Link href="/secret/apps" aria-label="Back to Atlas Apps">
          <ArrowLeft size={22} />
        </Link>
        <span>
          atlas<span className="video-word">video</span>
        </span>
        <span className="video-web-label">WEB</span>
      </header>
      {!account ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
            className="video-search"
          >
            <Search size={19} />
            <input
              ref={input}
              aria-label="Search videos or paste a YouTube link"
              placeholder="Search, or paste a video link"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={2048}
              autoComplete="off"
            />
            <button type="submit" disabled={busy || !query.trim()}>
              {busy ? "Searching…" : "Search"}
            </button>
          </form>
          {selected && (
            <section
              ref={player}
              className="video-player"
              aria-label="Video player"
            >
              <div className="video-player-heading">
                <h1>{selected.title}</h1>
                <button
                  aria-label="Close video"
                  onClick={() => setSelected(null)}
                >
                  <X size={21} />
                </button>
              </div>
              <iframe
                key={selected.id}
                title={selected.title}
                src={`https://www.youtube-nocookie.com/embed/${selected.id}?autoplay=1&playsinline=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div className="video-player-meta">
                <span>{selected.channel}</span>
                <a
                  href={`https://www.youtube.com/watch?v=${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open on YouTube <ExternalLink size={14} />
                </a>
              </div>
              <small>
                YouTube playback may include ads or require opening on YouTube.
              </small>
            </section>
          )}
          {error && (
            <p role="alert" className="video-error">
              {error}
            </p>
          )}
          {busy && <p role="status">Finding videos…</p>}
          <section className="video-results" aria-label="Video search results">
            {videos.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelected(v);
                  player.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                <div className="video-thumbnail">
                  <div className="video-thumbnail-placeholder" aria-hidden="true"><Play size={30}/></div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.thumbnail}
                    onError={event => { event.currentTarget.style.visibility = "hidden"; }}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  {v.duration && <span>{v.duration}</span>}
                </div>
                <h2>{v.title}</h2>
                <p>{v.channel}</p>
              </button>
            ))}
          </section>
          {!busy && !selected && !videos.length && (
            <div className="video-empty">
              <span>
                <Play size={32} />
              </span>
              <h1>
                {searched
                  ? "Nothing found. Try another search."
                  : "Just press play."}
              </h1>
              <p>
                Find something worth watching.
                <br />
                Your searches and viewing history aren’t saved by Atlas.
              </p>
            </div>
          )}
        </>
      ) : (
        <section className="video-account">
          <h1>Your space.</h1>
          <p>A simple player, in your own style.</p>
          <fieldset>
            <legend>Appearance</legend>
            {["mono", "paper", "ink"].map((t) => (
              <label key={t}>
                <input
                  type="radio"
                  name="theme"
                  checked={theme === t}
                  onChange={() => {
                    chooseTheme(t);
                  }}
                />
                {t[0].toUpperCase() + t.slice(1)}
              </label>
            ))}
          </fieldset>
          <h2>No Atlas history</h2>
          <p>
            Searches, results and the current video stay in this tab’s memory
            and disappear when you leave. Only your theme preference is saved.
            YouTube receives playback requests and has its own privacy policies.
          </p>
          <h2>On the web</h2>
          <p>
            This is the browser player, not the full NewPipe-based Android app.
            Background playback, downloads and service availability follow
            browser and YouTube restrictions.
          </p>
          <Link href="/secret/apps">Get the Android app ↗</Link>
        </section>
      )}
      <nav className="video-bottom" aria-label="Atlas Video navigation">
        <button
          aria-current={!account ? "page" : undefined}
          onClick={() => {
            setAccount(false);
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          <Search size={20} />
          <span>Search</span>
        </button>
        <button
          disabled={!selected}
          onClick={() => {
            setAccount(false);
            requestAnimationFrame(() =>
              player.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              }),
            );
          }}
        >
          <Play size={20} />
          <span>Player</span>
        </button>
        <button
          aria-current={account ? "page" : undefined}
          onClick={() => {
            setSelected(null);
            setAccount(true);
          }}
        >
          <Settings2 size={20} />
          <span>You</span>
        </button>
      </nav>
    </main>
  );
}
