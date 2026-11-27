"use client";
/* eslint-disable @next/next/no-img-element -- Provider avatars are small public thumbnails. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { appServiceUrl } from "@/lib/appNetwork";
import { readChannel, type VideoChannel } from "@/lib/video/channel";
import { appendVideoPage, readVideoPage } from "@/lib/video/pagination";
import type { VideoResult } from "@/lib/video/search";
import { useVideoPagination } from "@/lib/video/use-pagination";
import VideoGrid from "./VideoGrid";
import PaginationFooter from "./PaginationFooter";
export default function ChannelPage({ id, name, active, onBack, onOpen }: { id: string; name: string; active: boolean; onBack(): void; onOpen(video: VideoResult, videos: VideoResult[]): void }) {
  const [channel, setChannel] = useState<VideoChannel | null>(null), [videos, setVideos] = useState<VideoResult[]>([]);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null), started = useRef(false), scroll = useRef(0), wasActive = useRef(false);
  const append = useCallback((page: VideoResult[]) => setVideos((current) => appendVideoPage(current, page.map((video) => ({ ...video, channel: video.channel || channel?.title || name, channelId: id })))), [channel?.title, name, id]);
  const pagination = useVideoPagination(id, videos, active && !busy, "channel", append, "channel");
  const { reset, seed } = pagination;
  const load = useCallback(async () => {
    request.current?.abort(); reset();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    const deadline = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(appServiceUrl("/api/video/channel"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: id }), signal: controller.signal, cache: "no-store" });
      const data = await response.json(), summary = readChannel(data.channel);
      if (!response.ok || !summary || summary.id !== id || !Array.isArray(data.videos)) throw Error("Unavailable");
      if (request.current !== controller || controller.signal.aborted) return;
      setChannel(summary); setVideos(readVideoPage(data.videos)); seed(data.continuation);
    } catch { if (request.current === controller) setError("This channel couldn’t load. Check your connection and try again."); }
    finally { clearTimeout(deadline); if (request.current === controller) { request.current = null; setBusy(false); } }
  }, [id, reset, seed]);
  useEffect(() => {
    if (active && !started.current) { started.current = true; void load(); }
  }, [active, load]);
  useEffect(() => () => { request.current?.abort(); request.current = null; started.current = false; }, []);
  useEffect(() => {
    const frame = active && !wasActive.current ? requestAnimationFrame(() => window.scrollTo(0, scroll.current)) : 0;
    wasActive.current = active;
    const remember = () => { scroll.current = window.scrollY; };
    if (active) window.addEventListener("scroll", remember, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", remember); };
  }, [active]);
  const open = useCallback((video: VideoResult) => onOpen(video, videos), [onOpen, videos]);
  return <section hidden={!active} className="video-channel-page" aria-label="Channel page">
    <button className="video-channel-back" onClick={onBack}><ArrowLeft size={17}/>Back to videos</button>
    <header className="video-channel-header">{channel?.avatar && <img src={channel.avatar} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }}/>}<div><span className="video-eyebrow">CHANNEL</span><h1>{channel?.title || name || "Channel"}</h1>{channel?.description && <details><summary>About this channel</summary><p>{channel.description}</p></details>}</div></header>
    {busy && <p role="status" className="video-search-status">Loading channel videos…</p>}
    {error && <div role="alert" className="video-error"><p>{error}</p><button onClick={() => void load()}>Try again</button></div>}
    {!busy && !error && <><h2 className="video-channel-videos-title">Videos</h2><VideoGrid videos={videos} onOpen={open}/><PaginationFooter hasMore={!!pagination.cursor} loading={pagination.loading} error={pagination.error} attachSentinel={pagination.attachSentinel} onLoad={pagination.loadMore}/>{!videos.length && !pagination.cursor && <p>This channel has no public videos available here.</p>}</>}
  </section>;
}
