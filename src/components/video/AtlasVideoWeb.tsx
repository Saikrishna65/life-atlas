"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowUpRight, Play, Search, Settings2, X, LoaderCircle, Check, ShieldCheck, Compass, Maximize2, Minimize2, PictureInPicture2 } from "lucide-react";
import { appServiceUrl } from "@/lib/appNetwork";
import { type VideoResult } from "@/lib/video/search";
import { directVideoId } from "@/lib/video/suggestions";
import { useVideoSuggestions } from "@/lib/video/use-suggestions";
import { appendVideoPage, readVideoPage } from "@/lib/video/pagination";
import { useVideoPagination } from "@/lib/video/use-pagination";
import YouTubePlayer from "./YouTubePlayer";
import { usePlaybackPreferences } from "@/lib/video/playback-preferences";
import ChannelPage from "./ChannelPage";
import DiscoverFeed from "./DiscoverFeed";
import VideoGrid from "./VideoGrid";
import PaginationFooter from "./PaginationFooter";
import SearchSuggestions from "./SearchSuggestions";
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
type View = "search" | "player" | "you" | "discover" | "channel";
const suggestions = [
  { title: "Go somewhere", query: "cinematic travel films", caption: "A different point of view", number: "01" },
  { title: "Learn something", query: "architecture design documentary", caption: "Follow your curiosity", number: "02" },
  { title: "Find your sound", query: "live music sessions", caption: "A moment to tune in", number: "03" },
];
export default function AtlasVideoWeb({ standalone = false }: { standalone?: boolean }) {
  const playback = usePlaybackPreferences();
  const [theater, setTheater] = useState(false);
  const [searchOpen, setSearchOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [playerOrigin, setPlayerOrigin] = useState<"search" | "discover" | "channel">("search");
  const [watchReturn, setWatchReturn] = useState<Exclude<View, "player">>("search");
  const [channel, setChannel] = useState<{ id: string; name: string } | null>(null);
  const [channelVideos, setChannelVideos] = useState<VideoResult[]>([]);
  const channelReturn = useRef<View>("search");
  const [discoverVideos, setDiscoverVideos] = useState<VideoResult[]>([]);
  const [selected, setSelected] = useState<VideoResult | null>(null);
  const [view, setView] = useState<View>("search");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultQuery, setResultQuery] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const completionId = useId();
  const { items: completionItems, dismiss: dismissCompletions } = useVideoSuggestions(query, view === "search" && searchOpen && inputFocused && !dismissed && !composing && !busy);
  const popupOpen = completionItems.length > 0;
  const searchBox = useRef<HTMLDivElement>(null);
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "paper");
  const controller = useRef<AbortController | null>(null);
  const pendingQuery = useRef("");
  const input = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const resultsScroll = useRef(0), previousView = useRef<View>("search");
  const append = useCallback((page: VideoResult[]) => setVideos((current) => appendVideoPage(current, page)), []);
  const pagination = useVideoPagination(resultQuery, videos, !busy && (view === "search" || view === "player" && playerOrigin === "search"), view, append);
  const pausePagination = pagination.pause;
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);
  useEffect(() => {
    if (!inputFocused) return;
    const outside = (event: PointerEvent) => {
      if (!searchBox.current?.contains(event.target as Node)) {
        setInputFocused(false); setDismissed(true); dismissCompletions(); input.current?.blur();
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [inputFocused, dismissCompletions]);
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
    let frame = 0;
    if (view === "player") content.current?.scrollIntoView({ block: "start", behavior: "auto" });
    else if (view === "search" && previousView.current !== "search") frame = requestAnimationFrame(() => window.scrollTo(0, resultsScroll.current));
    previousView.current = view;
    return () => cancelAnimationFrame(frame);
  }, [view, selected?.id]);
  const cancel = useCallback(() => {
    if (busy) { setResultQuery(""); setVideos([]); }
    controller.current?.abort(); controller.current = null; pendingQuery.current = ""; setBusy(false);
  }, [busy]);
  async function search(value = query) {
    const text = value.trim();
    if (!text || (busy && pendingQuery.current === text)) return;
    dismissCompletions(); setDismissed(true); setActiveSuggestion(-1); input.current?.blur();
    cancel(); pagination.reset(); setError(""); setView("search"); setSearchOpen(false); resultsScroll.current = 0; window.scrollTo(0, 0);
    const id = directVideoId(text);
    if (id) {
      setVideos([]); setResultQuery("");
      setWatchReturn("search"); setPlayerOrigin("search"); setSelected({ id, title: "YouTube video", channel: "", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration: "" });
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
        setVideos(readVideoPage(data.videos)); pagination.seed(data.continuation);
      }
    } catch (failure) {
      if (controller.current === request && (!request.signal.aborted || timedOut))
        setError(timedOut ? "This search is taking too long. Try again, or paste a video link to open it directly." : failure instanceof TypeError ? "Could not connect. Check your connection and try again." : failure instanceof Error ? failure.message : "Search is unavailable. Try again.");
    } finally {
      clearTimeout(deadline);
      if (controller.current === request) { controller.current = null; pendingQuery.current = ""; setBusy(false); }
    }
  }
  const openVideo = useCallback((video: VideoResult) => {
    if (view === "search") resultsScroll.current = window.scrollY;
    cancel(); if (view !== "player") setWatchReturn(view); setPlayerOrigin("search"); setSelected(video); setView("player"); setSearchOpen(false); input.current?.blur();
  }, [cancel, view]);
  const openDiscoverVideo = useCallback((video: VideoResult, items: VideoResult[]) => {
    setWatchReturn("discover"); setDiscoverVideos(items); setPlayerOrigin("discover"); setSelected(video); setView("player"); setSearchOpen(false);
  }, []);
  const openChannelVideo = useCallback((video: VideoResult, items: VideoResult[]) => {
    setWatchReturn("channel"); setChannelVideos(items); setPlayerOrigin("channel"); setSelected(video); setView("player"); setSearchOpen(false);
  }, []);
  const openChannel = useCallback((id: string, name: string) => {
    if (view === "search") resultsScroll.current = window.scrollY;
    if (view !== "channel") channelReturn.current = view;
    cancel(); pausePagination(); setChannel({ id, name }); setView("channel"); setSearchOpen(false); window.scrollTo(0, 0);
  }, [view, cancel, pausePagination]);
  const playerVideos = playerOrigin === "discover" ? discoverVideos : playerOrigin === "channel" ? channelVideos : videos;
  function toggleSearch() {
    if (view === "search" && searchOpen) {
      setSearchOpen(false); setInputFocused(false); setDismissed(true); dismissCompletions(); input.current?.blur();
    } else {
      setView("search"); setSearchOpen(true); setDismissed(false); requestAnimationFrame(() => input.current?.focus());
    }
  }
  function fillSuggestion(text: string) {
    dismissCompletions(); setQuery(text); setActiveSuggestion(-1); setDismissed(false); setInputFocused(true);
    input.current?.focus();
    requestAnimationFrame(() => input.current?.setSelectionRange(text.length, text.length));
  }
  const home = standalone ? "/" : "/secret/apps";
  return <main ref={root} className="video-web" data-theme={theme} data-view={view} data-search-open={searchOpen} data-standalone={standalone || undefined}>
    <header className="video-masthead"><div className="video-brand"><span className="video-brand-mark" aria-hidden="true"><Play size={15} fill="currentColor"/></span><span>atlas<span className="video-word">video</span></span></div><span className="video-private-label"><span/>No Atlas history</span></header>
    <div className="video-content" ref={content}>
      <DiscoverFeed active={view === "discover"} onOpen={openDiscoverVideo} onChannel={openChannel}/>
      {channel && <ChannelPage key={channel.id} id={channel.id} name={channel.name} active={view === "channel"} onBack={() => setView(channelReturn.current === "player" && !selected ? "search" : channelReturn.current)} onOpen={openChannelVideo}/>}
      {view === "search" && <>
        {!resultQuery && !busy && <section className="video-discover" aria-labelledby="video-welcome">
          <div className="video-discover-copy"><span className="video-eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span><h1 id="video-welcome">Something<br/>worth your time.</h1><p>A film. A fresh idea. A song you play twice.<br/>Start with whatever you’re curious about.</p><span className="video-discover-hint"><Search size={14}/> Search below, or paste a video link.</span></div>
          <div className="video-art" aria-hidden="true"><div className="video-art-outline"/><div className="video-art-frame video-art-back"><span>01:24</span></div><div className="video-art-frame video-art-front"><span className="video-art-play"><Play fill="currentColor" size={26}/></span><i/><i/><i/></div><span className="video-art-caption">PRESS PLAY. FOLLOW A THOUGHT.</span></div>
        </section>}
        {!resultQuery && !busy && <section className="video-suggestions" aria-label="Search inspiration">{suggestions.map((item) => <button key={item.number} onClick={() => void search(item.query)}><span>{item.number}</span><div><strong>{item.title}</strong><small>{item.caption}</small></div><ArrowUpRight size={18}/></button>)}</section>}
        {resultQuery && <div className="video-results-header"><div><span className="video-eyebrow">{busy ? "SEARCHING" : "VIDEOS"}</span><h1>{resultQuery}</h1></div>{!busy && !error && <span aria-live="polite">{videos.length} loaded</span>}</div>}
        {error && <div className="video-error" role="alert"><p>{error}</p><button onClick={() => void search()}>Try again <ArrowUpRight size={15}/></button></div>}
        {busy && <><p className="video-search-status" role="status"><LoaderCircle size={15}/>Finding videos…<button onClick={cancel}>Cancel search</button></p><div className="video-results video-skeletons" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i}><div/><span/><span/></div>)}</div></>}
        {!busy && videos.length > 0 && <VideoGrid videos={videos} onOpen={openVideo} onChannel={openChannel}/>}
        {!busy && (videos.length > 0 || !!pagination.cursor) && <PaginationFooter hasMore={!!pagination.cursor} loading={pagination.loading} error={pagination.error} attachSentinel={pagination.attachSentinel} onLoad={pagination.loadMore}/>}
        {!busy && resultQuery && !videos.length && !pagination.cursor && !error && <div className="video-empty-results"><Search size={26}/><h2>Nothing found.</h2><p>Try a different name or a few simpler words.</p></div>}
      </>}
      {selected && <section className="video-watch" data-related={playback.related && playerVideos.length > 1} data-theater={theater} data-mini={view !== "player"} aria-label={view === "player" ? "Video player" : "Mini player"}>
        <div className="video-watch-main"><div className="video-watch-heading">{view === "player" ? <><button className="video-watch-return" aria-label="Close video" onClick={() => { setSelected(null); setView(watchReturn); }}><ArrowLeft size={18}/><span>Back to {watchReturn === "discover" ? "Discover" : watchReturn === "channel" ? "channel" : watchReturn === "you" ? "You" : resultQuery ? "results" : "search"}</span></button><div className="video-watch-actions"><button aria-label="Minimize video" onClick={() => { setView(watchReturn); setSearchOpen(false); }}><PictureInPicture2 size={18}/></button><button className="video-watch-theater" aria-label={theater ? "Exit theater view" : "Theater view"} aria-pressed={theater} onClick={() => setTheater((current) => !current)}>{theater ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button></div></> : <><button className="video-mini-expand" aria-label="Expand mini player" onClick={() => { if (view === "search") resultsScroll.current = window.scrollY; setWatchReturn(view); setView("player"); setSearchOpen(false); }}><Maximize2 size={15}/><span>{selected.title}</span></button><button aria-label="Close mini player" onClick={() => setSelected(null)}><X size={17}/></button></>}</div>
          <YouTubePlayer key={selected.id} id={selected.id} title={selected.title} autoplay={playback.autoplay}/>
          <div className="video-player-meta"><h1>{selected.title}</h1>{selected.channelId ? <button className="video-watch-channel" onClick={() => openChannel(selected.channelId!, selected.channel)}>{selected.channel || "View channel"}<ArrowUpRight size={14}/></button> : <p>{selected.channel || "Opened from your video link"}</p>}</div>
        </div>
        {view === "player" && playback.related && playerVideos.length > 1 && <aside className="video-up-next" aria-label={playerOrigin === "discover" ? "More from this topic" : playerOrigin === "channel" ? "More from this channel" : "More from this search"}><h2>More videos</h2>{playerVideos.filter((video) => video.id !== selected.id).map((video) => <button key={video.id} onClick={() => playerOrigin !== "search" ? setSelected(video) : openVideo(video)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="video-related-thumbnail"><span className="video-related-placeholder" aria-hidden="true"><Play size={20}/></span><img src={video.thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}/>{video.duration && <small aria-hidden="true">{video.duration}</small>}</div><span><strong>{video.title}</strong><small>{video.channel}</small></span>
        </button>)}{playerOrigin === "search" && <PaginationFooter hasMore={!!pagination.cursor} loading={pagination.loading} error={pagination.error} attachSentinel={pagination.attachSentinel} onLoad={pagination.loadMore}/>}</aside>}
      </section>}
      {view === "you" && <section className="video-account"><span className="video-eyebrow">MAKE YOURSELF AT HOME</span><h1>Your space.</h1><p>A quieter player. A look that feels like you.</p><button className="video-topic-reset" onClick={() => { setView("discover"); setSearchOpen(false); }}>Choose my Discover topic</button><fieldset><legend>Appearance</legend><div className="video-theme-grid">{[{id:"mono",name:"Mono",hint:"After hours"},{id:"paper",name:"Paper",hint:"A clean slate"},{id:"ink",name:"Ink",hint:"A deeper shade"}].map((option) => <label key={option.id} data-theme-option={option.id}><input aria-label={option.name} type="radio" name="theme" checked={theme === option.id} onChange={() => chooseTheme(option.id)}/><span className="video-theme-preview" aria-hidden="true"><i/><i/><i/></span><span><strong>{option.name}</strong><small>{option.hint}</small></span>{theme === option.id && <Check size={15}/>}</label>)}</div></fieldset><fieldset className="video-playback-settings"><legend>Playback</legend><label><span><strong>Play when opened</strong><small>Start the video when your browser allows autoplay.</small></span><input type="checkbox" checked={playback.autoplay} onChange={(event) => playback.update("autoplay", event.target.checked)}/></label><label><span><strong>Show more videos</strong><small>Display other videos from your current search or topic.</small></span><input type="checkbox" checked={playback.related} onChange={(event) => playback.update("related", event.target.checked)}/></label></fieldset><div className="video-privacy-note"><ShieldCheck size={20}/><div><h2>Just watching. No keeping track.</h2><p>Atlas saves no searches or watch history. Only your theme, playback preferences and explicitly chosen Discover topic are saved. Typed text is sent to YouTube for suggestions. YouTube also receives playback requests and has its own privacy policies.</p></div></div><Link className="video-android-link" href="/secret/apps"><span><strong>Take Atlas Video with you.</strong><small>Explore the Android app</small></span><ArrowUpRight size={20}/></Link></section>}
    </div>
    <div className="video-dock">
      {view === "search" && searchOpen && <div id={`${completionId}-search`} className="video-search-box" ref={searchBox} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) { setInputFocused(false); dismissCompletions(); setActiveSuggestion(-1); }
      }} onKeyDown={(event) => {
        if (event.key === "Escape" && !composing) { event.preventDefault(); setDismissed(true); setActiveSuggestion(-1); dismissCompletions(); }
      }}>
        {popupOpen && <SearchSuggestions id={completionId} items={completionItems} active={activeSuggestion} onActive={setActiveSuggestion} onChoose={(text) => { setQuery(text); void search(text); }} onFill={fillSuggestion}/>}
        <form className="video-search" onSubmit={(event) => { event.preventDefault(); if (!composing) void search(); }}><Search size={19}/>
          <input ref={input} role="combobox" aria-label="Search videos or paste a YouTube link" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={popupOpen} aria-controls={popupOpen ? completionId : undefined}
            aria-activedescendant={popupOpen && activeSuggestion >= 0 ? `${completionId}-${activeSuggestion}` : undefined} aria-describedby={`${completionId}-help`}
            placeholder="Search anything, or paste a link" value={query} onChange={(event) => { setQuery(event.target.value); setActiveSuggestion(-1); setDismissed(false); }}
            onClick={() => setDismissed(false)} onFocus={() => { setInputFocused(true); setDismissed(false); setActiveSuggestion(-1); }}
            onCompositionStart={() => { setComposing(true); dismissCompletions(); }} onCompositionEnd={(event) => { setQuery(event.currentTarget.value); setComposing(false); setDismissed(false); }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || composing || event.nativeEvent.keyCode === 229) return;
              if (!popupOpen) return;
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveSuggestion((index) => (index + 1) % completionItems.length); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setActiveSuggestion((index) => index <= 0 ? completionItems.length - 1 : index - 1); }
              else if (event.key === "Enter" && activeSuggestion >= 0) { event.preventDefault(); const text = completionItems[activeSuggestion]; setQuery(text); void search(text); }
              else if (event.key === "ArrowRight" && activeSuggestion >= 0 && event.currentTarget.selectionStart === query.length) { event.preventDefault(); fillSuggestion(completionItems[activeSuggestion]); }
            }} maxLength={2048} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}/>
          {query && <button type="button" className="video-search-clear" aria-label="Clear search" onClick={() => { dismissCompletions(); cancel(); pagination.reset(); setQuery(""); setResultQuery(""); setVideos([]); setError(""); setDismissed(false); input.current?.focus(); }}><X size={16}/></button>}
          <button className="video-search-submit" type="submit" disabled={!query.trim()} aria-label={busy ? "Search again" : "Search"}>{busy ? <LoaderCircle size={18}/> : <ArrowUpRight size={20}/>}</button>
        </form>
        <span id={`${completionId}-help`} className="video-completion-sr">Use Up or Down to choose a suggestion, Enter to search, Right Arrow to fill, and Escape to dismiss.</span>
        <span className="video-completion-sr" role="status">{popupOpen ? `${completionItems.length} search suggestions available.` : ""}</span>
      </div>}

      <nav className="video-bottom" aria-label="Atlas Video navigation"><Link href={home} aria-label={standalone ? "Back to Atlas" : "Back to Atlas Apps"}><ArrowLeft size={19}/></Link><button aria-label="Discover" aria-current={view === "discover" ? "page" : undefined} onClick={() => { if (view === "search") resultsScroll.current = window.scrollY; cancel(); pagination.pause(); setSearchOpen(false); setView("discover"); }}><Compass size={19}/><span>Discover</span></button><button aria-label="Search" aria-current={view === "search" && searchOpen ? "page" : undefined} aria-pressed={view === "search" && searchOpen} aria-expanded={view === "search" && searchOpen} aria-controls={view === "search" && searchOpen ? `${completionId}-search` : undefined} onClick={toggleSearch}><Search size={19}/><span>Search</span></button><button aria-label="Player" disabled={!selected} aria-current={view === "player" ? "page" : undefined} onClick={() => { if (view === "search") resultsScroll.current = window.scrollY; if (view !== "player") setWatchReturn(view); cancel(); setSearchOpen(false); setView("player"); }}><Play size={19}/><span>Player</span></button><button aria-label="You" aria-current={view === "you" ? "page" : undefined} onClick={() => { if (view === "search") resultsScroll.current = window.scrollY; cancel(); pagination.pause(); setSearchOpen(false); setView("you"); }}><Settings2 size={19}/><span>You</span></button></nav>
    </div>
  </main>;
}
