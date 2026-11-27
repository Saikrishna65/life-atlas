"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { appServiceUrl } from "@/lib/appNetwork";
import { appendVideoPage, readVideoPage } from "@/lib/video/pagination";
import type { VideoResult } from "@/lib/video/search";
import { readTopic, TOPIC_STORAGE_KEY, VIDEO_TOPICS } from "@/lib/video/topics";
import { useVideoPagination } from "@/lib/video/use-pagination";
import VideoGrid from "./VideoGrid";
import PaginationFooter from "./PaginationFooter";
let memoryTopic: string | null = null;
function topicSnapshot() {
  try { return readTopic(localStorage.getItem(TOPIC_STORAGE_KEY))?.id ?? null; } catch { return memoryTopic; }
}
function subscribeTopic(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener("atlas-video-topic", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("atlas-video-topic", listener); };
}
function saveTopic(value: string | null) {
  memoryTopic = value;
  try { if (value) localStorage.setItem(TOPIC_STORAGE_KEY, value); else localStorage.removeItem(TOPIC_STORAGE_KEY); } catch {}
  window.dispatchEvent(new Event("atlas-video-topic"));
}
export default function DiscoverFeed({ active, onOpen, onChannel }: { active: boolean; onOpen: (video: VideoResult, videos: VideoResult[]) => void; onChannel?(id: string, name: string): void }) {
  const topicId = useSyncExternalStore(subscribeTopic, topicSnapshot, () => null);
  const topic = readTopic(topicId);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null), loaded = useRef("");
  const scroll = useRef(0), wasActive = useRef(false);
  const append = useCallback((page: VideoResult[]) => setVideos((current) => appendVideoPage(current, page)), []);
  const pagination = useVideoPagination(topic?.query ?? "", videos, active && !busy, "discover", append);
  const { reset, seed } = pagination;
  useEffect(() => {
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    const frame = active && !wasActive.current ? requestAnimationFrame(() => window.scrollTo(0, scroll.current)) : 0;
    wasActive.current = active;
    if (!active) return () => cancelAnimationFrame(frame);
    const remember = () => { scroll.current = window.scrollY; };
    window.addEventListener("scroll", remember, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", remember); };
  }, [active]);
  const load = useCallback(async () => {
    if (!topic) return;
    request.current?.abort(); reset();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setVideos([]);
    const deadline = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(appServiceUrl("/api/video/search"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: topic.query }), cache: "no-store", signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.videos)) throw Error("Unavailable");
      if (request.current !== controller || controller.signal.aborted) return;
      setVideos(readVideoPage(data.videos)); seed(data.continuation);
    } catch {
      if (request.current === controller) setError("These videos couldn’t load. Check your connection and try again.");
    } finally {
      clearTimeout(deadline);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }, [topic, reset, seed]);
  useEffect(() => {
    if (!active || !topic || loaded.current === topic.id) return;
    loaded.current = topic.id;
    void load();
  }, [active, topic, load]);
  function choose(id: string) {
    const next = readTopic(id);
    if (!next || next.id === topic?.id) return;
    request.current?.abort(); request.current = null; reset(); setBusy(false); setVideos([]); setError("");
    loaded.current = ""; scroll.current = 0; saveTopic(next.id); window.scrollTo(0, 0);
  }
  const open = useCallback((video: VideoResult) => onOpen(video, videos), [onOpen, videos]);
  return <section hidden={!active} className="video-discover-feed" aria-label="Discover videos">
    <div className="video-results-header"><div><span className="video-eyebrow">YOUR TOPICS. NO WATCH HISTORY.</span><h1>Discover.</h1></div>{topic && <button className="video-topic-reset" onClick={() => {
      request.current?.abort(); request.current = null; reset(); loaded.current = ""; saveTopic(null); setVideos([]); setBusy(false); setError("");
    }}>Forget my topic</button>}</div>
    <p className="video-topic-note">{topic ? "Videos from your chosen topic, without tracking what you watch." : "Choose a topic to find something worth watching. Only your topic preference is saved."}</p>
    <div className="video-topic-list" role="group" aria-label="Choose a topic">{VIDEO_TOPICS.map((item) => <button key={item.id} aria-pressed={topic?.id === item.id} onClick={() => choose(item.id)}>{item.title}</button>)}</div>
    {busy && <p role="status" className="video-search-status">Finding {topic?.title.toLowerCase()} videos…</p>}
    {error && <div role="alert" className="video-error"><p>{error}</p><button onClick={() => void load()}>Try again</button></div>}
    {!busy && videos.length > 0 && <VideoGrid videos={videos} onOpen={open} onChannel={onChannel}/>}
    {!busy && !error && topic && !videos.length && !pagination.cursor && <p>No videos arrived. Choose another topic or try again later.</p>}
    {!busy && !error && (videos.length > 0 || !!pagination.cursor) && <PaginationFooter hasMore={!!pagination.cursor} loading={pagination.loading} error={pagination.error} attachSentinel={pagination.attachSentinel} onLoad={pagination.loadMore}/>}
  </section>;
}
