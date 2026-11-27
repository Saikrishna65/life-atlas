"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowUpRight, Play, Search, Settings2, X, ExternalLink, LoaderCircle, Check, ShieldCheck } from "lucide-react";
import { appServiceUrl } from "@/lib/appNetwork";
import { youtubeId, type VideoResult } from "@/lib/video/search";
import "./video-web.css";
let memoryTheme = "paper";
function currentTheme() {
  try { const saved = localStorage.getItem("atlas-video-web-theme"); return saved && ["mono", "paper", "ink"].includes(saved) ? saved : memoryTheme; }
  catch { return memoryTheme; }
}
function subscribeTheme(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener("atlas-video-theme", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("atlas-video-theme", listener); };
}
function chooseTheme(value: string) {
  memoryTheme = value;
  try { localStorage.setItem("atlas-video-web-theme", value); } catch {}
  window.dispatchEvent(new Event("atlas-video-theme"));
}
type View = "search" | "player" | "you";
const suggestions = [
  { title: "Go somewhere", query: "cinematic travel films", caption: "A different point of view", number: "01" },
  { title: "Learn something", query: "architecture design documentary", caption: "Follow your curiosity", number: "02" },
  { title: "Find your sound", query: "live music sessions", caption: "A moment to tune in", number: "03" },
];
export default function AtlasVideoWeb({ standalone = false }: { standalone?: boolean }) {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [selected, setSelected] = useState<VideoResult | null>(null);
  const [view, setView] = useState<View>("search");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultQuery, setResultQuery] = useState("");
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "paper");
  const controller = useRef<AbortController | null>(null);
  const pendingQuery = useRef("");
  const input = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const inset = document.activeElement === input.current ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      const keyboard = inset > 120;
      root.current?.style.setProperty("--vw-keyboard", keyboard ? `${inset}px` : "0px");
      if (root.current) root.current.dataset.keyboard = String(keyboard);
    };
    viewport.addEventListener("resize", update); viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", update); document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update); viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update); document.removeEventListener("focusout", update);
    };
  }, []);
  useEffect(() => {
    if (view === "player") content.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [view, selected?.id]);
  function cancel() {
    if (busy) { setResultQuery(""); setVideos([]); }
    controller.current?.abort(); controller.current = null; pendingQuery.current = ""; setBusy(false);
  }
  async function search(value = query) {
    const text = value.trim();
    if (!text || (busy && pendingQuery.current === text)) return;
    cancel(); setError(""); setView("search");
    const id = youtubeId(text);
    if (id) {
      setSelected({ id, title: "YouTube video", channel: "", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration: "" });
      setView("player"); input.current?.blur(); return;
    }
    if (text.length > 120) { setError("Use up to 120 characters for search."); return; }
    const request = new AbortController(); controller.current = request; pendingQuery.current = text;
    setQuery(text); setResultQuery(text); setVideos([]); setBusy(true);
    let timedOut = false;
    const deadline = window.setTimeout(() => { timedOut = true; request.abort(); }, 12000);
    try {
      const response = await fetch(appServiceUrl("/api/video/search"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: text }), signal: request.signal, cache: "no-store",
      });
      const data = await response.json().catch(() => { throw Error("Search could not connect. Try again, or paste a YouTube link."); });
      if (!response.ok) throw Error(data.error || "Search is unavailable. Try again or paste a YouTube link.");
      if (!Array.isArray(data.videos)) throw Error("Results could not be read. Try searching again.");
      if (controller.current === request && !request.signal.aborted) {
        setVideos(data.videos.filter((video: VideoResult) => video && /^[A-Za-z0-9_-]{11}$/.test(video.id)).slice(0, 24));
      }
    } catch (failure) {
      if (controller.current === request && (!request.signal.aborted || timedOut))
        setError(timedOut ? "This search is taking too long. Try again, or paste a video link to open it directly." : failure instanceof TypeError ? "Could not connect. Check your connection and try again." : failure instanceof Error ? failure.message : "Search is unavailable. Try again.");
    } finally {
      clearTimeout(deadline);
      if (controller.current === request) { controller.current = null; pendingQuery.current = ""; setBusy(false); }
    }
  }
  function openVideo(video: VideoResult) { cancel(); setSelected(video); setView("player"); input.current?.blur(); }
  const home = standalone ? "/" : "/secret/apps";
  return <main ref={root} className="video-web" data-theme={theme} data-view={view} data-standalone={standalone || undefined}>
    <header className="video-masthead"><div className="video-brand"><span className="video-brand-mark" aria-hidden="true"><Play size={15} fill="currentColor"/></span><span>atlas<span className="video-word">video</span></span></div><span className="video-private-label"><span/>No Atlas history</span></header>
    <div className="video-content" ref={content}>
      {view === "search" && <>
        {!resultQuery && !busy && <section className="video-discover" aria-labelledby="video-welcome">
          <div className="video-discover-copy"><span className="video-eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span><h1 id="video-welcome">Something<br/>worth your time.</h1><p>A film. A fresh idea. A song you play twice.<br/>Start with whatever you’re curious about.</p><span className="video-discover-hint"><Search size={14}/> Search below, or paste a video link.</span></div>
          <div className="video-art" aria-hidden="true"><div className="video-art-outline"/><div className="video-art-frame video-art-back"><span>01:24</span></div><div className="video-art-frame video-art-front"><span className="video-art-play"><Play fill="currentColor" size={26}/></span><i/><i/><i/></div><span className="video-art-caption">PRESS PLAY. FOLLOW A THOUGHT.</span></div>
        </section>}
        {!resultQuery && !busy && <section className="video-suggestions" aria-label="Search inspiration">{suggestions.map((item) => <button key={item.number} onClick={() => void search(item.query)}><span>{item.number}</span><div><strong>{item.title}</strong><small>{item.caption}</small></div><ArrowUpRight size={18}/></button>)}</section>}
        {resultQuery && <div className="video-results-header"><div><span className="video-eyebrow">{busy ? "FINDING YOUR NEXT WATCH" : "SEARCH RESULTS"}</span><h1>{resultQuery}</h1></div>{!busy && !error && <span>{videos.length} {videos.length === 1 ? "video" : "videos"}</span>}</div>}
        {error && <div className="video-error" role="alert"><p>{error}</p><button onClick={() => void search()}>Try again <ArrowUpRight size={15}/></button></div>}
        {busy && <><p className="video-search-status" role="status"><LoaderCircle size={15}/>Finding videos…<button onClick={cancel}>Cancel search</button></p><div className="video-results video-skeletons" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i}><div/><span/><span/></div>)}</div></>}
        {!busy && videos.length > 0 && <section className="video-results" aria-label="Video search results">{videos.map((video, index) => <button className="video-result" key={video.id} onClick={() => openVideo(video)}>
          <div className="video-thumbnail"><div className="video-thumbnail-placeholder" aria-hidden="true"><Play size={28}/></div>{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={video.thumbnail} alt="" loading={index < 4 ? "eager" : "lazy"} decoding="async" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} referrerPolicy="no-referrer"/>{video.duration && <span>{video.duration}</span>}<i aria-hidden="true"><Play size={19} fill="currentColor"/></i></div>
          <div className="video-result-copy"><span className="video-result-avatar" aria-hidden="true">{video.channel?.slice(0, 1) || "▶"}</span><div><h2>{video.title}</h2><p>{video.channel}</p></div></div>
        </button>)}</section>}
        {!busy && resultQuery && !videos.length && !error && <div className="video-empty-results"><Search size={26}/><h2>Nothing found.</h2><p>Try a different name or a few simpler words.</p></div>}
      </>}
      {view === "player" && selected && <section className="video-watch" aria-label="Video player"><div className="video-watch-heading"><span className="video-eyebrow">NOW IN FOCUS</span><button aria-label="Close video" onClick={() => { setSelected(null); setView("search"); }}><X size={20}/></button></div><div className="video-player-frame"><iframe key={selected.id} title={selected.title} src={`https://www.youtube-nocookie.com/embed/${selected.id}?autoplay=1&playsinline=1&rel=0`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div><div className="video-player-meta"><div><h1>{selected.title}</h1><p>{selected.channel || "Opened from your video link"}</p></div><a href={`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noopener noreferrer">Open on YouTube <ExternalLink size={15}/></a></div><p className="video-playback-note">Playback is provided by YouTube and may include ads or require opening there.</p>
        {videos.length > 1 && <section className="video-up-next" aria-label="More from this search"><span className="video-eyebrow">FROM THIS SEARCH</span>{videos.filter((video) => video.id !== selected.id).slice(0, 5).map((video) => <button key={video.id} onClick={() => openVideo(video)}>{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={video.thumbnail} alt="" loading="lazy"/><span><strong>{video.title}</strong><small>{video.channel}</small></span><Play size={16}/></button>)}</section>}
      </section>}
      {view === "you" && <section className="video-account"><span className="video-eyebrow">MAKE YOURSELF AT HOME</span><h1>Your space.</h1><p>A quieter player. A look that feels like you.</p><fieldset><legend>Appearance</legend><div className="video-theme-grid">{[{id:"mono",name:"Mono",hint:"After hours"},{id:"paper",name:"Paper",hint:"A clean slate"},{id:"ink",name:"Ink",hint:"A deeper shade"}].map((option) => <label key={option.id} data-theme-option={option.id}><input aria-label={option.name} type="radio" name="theme" checked={theme === option.id} onChange={() => chooseTheme(option.id)}/><span className="video-theme-preview" aria-hidden="true"><i/><i/><i/></span><span><strong>{option.name}</strong><small>{option.hint}</small></span>{theme === option.id && <Check size={15}/>}</label>)}</div></fieldset><div className="video-privacy-note"><ShieldCheck size={20}/><div><h2>Just watching. No keeping track.</h2><p>Atlas saves no searches or watch history. Only your theme is saved. YouTube receives playback requests and has its own privacy policies.</p></div></div><Link className="video-android-link" href="/secret/apps"><span><strong>Take Atlas Video with you.</strong><small>Explore the Android app</small></span><ArrowUpRight size={20}/></Link></section>}
    </div>
    <div className="video-dock">
      {view === "search" && <form className="video-search" onSubmit={(event) => { event.preventDefault(); void search(); }}><Search size={19}/><input ref={input} aria-label="Search videos or paste a YouTube link" placeholder="Search anything, or paste a link" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={2048} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}/>{query && <button type="button" className="video-search-clear" aria-label="Clear search" onClick={() => { cancel(); setQuery(""); setResultQuery(""); setVideos([]); setError(""); input.current?.focus(); }}><X size={16}/></button>}<button className="video-search-submit" type="submit" disabled={!query.trim()} aria-label={busy ? "Search again" : "Search"}>{busy ? <LoaderCircle size={18}/> : <ArrowUpRight size={20}/>}</button></form>}
      <nav className="video-bottom" aria-label="Atlas Video navigation"><Link href={home} aria-label={standalone ? "Back to Atlas" : "Back to Atlas Apps"}><ArrowLeft size={19}/></Link><button aria-label="Search" aria-current={view === "search" ? "page" : undefined} onClick={() => { setView("search"); requestAnimationFrame(() => input.current?.focus()); }}><Search size={19}/><span>Search</span></button><button aria-label="Player" disabled={!selected} aria-current={view === "player" ? "page" : undefined} onClick={() => { cancel(); setView("player"); }}><Play size={19}/><span>Player</span></button><button aria-label="You" aria-current={view === "you" ? "page" : undefined} onClick={() => { cancel(); setView("you"); }}><Settings2 size={19}/><span>You</span></button></nav>
    </div>
  </main>;
}
