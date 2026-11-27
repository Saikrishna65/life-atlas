"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { appServiceUrl } from "../appNetwork";
import type { VideoResult } from "./search";
import { readContinuation, readVideoPage, type SearchContinuation } from "./pagination";
export function useVideoPagination(query: string, videos: VideoResult[], enabled: boolean, scope: string, onAppend: (page: VideoResult[]) => void) {
  const [cursor, setCursor] = useState<SearchContinuation | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null), generation = useRef(0), locked = useRef(false);
  const activeCursor = useRef<SearchContinuation | null>(null), suspended = useRef(false);
  const lastToken = useRef<string | null>(null), emptyPages = useRef(0), sentinel = useRef<HTMLDivElement>(null);
  const pause = useCallback(() => {
    suspended.current = true; generation.current++; controller.current?.abort(); controller.current = null; locked.current = false; lastToken.current = null; setLoading(false);
  }, []);
  const reset = useCallback(() => { pause(); activeCursor.current = null; setCursor(null); setError(""); emptyPages.current = 0; }, [pause]);
  const seed = useCallback((value: unknown) => { reset(); const next = readContinuation(value); activeCursor.current = next; suspended.current = false; setCursor(next); }, [reset]);
  useEffect(() => {
    const gate = generation, request = controller, suspension = suspended;
    return () => { suspension.current = true; gate.current++; request.current?.abort(); };
  }, []);
  const loadMore = useCallback(async (retry = false) => {
    if (!enabled || suspended.current || !query || !cursor || activeCursor.current !== cursor || locked.current || lastToken.current === cursor.token || error && !retry) return;
    const revision = generation.current, request = new AbortController();
    controller.current = request; locked.current = true; lastToken.current = cursor.token;
    setLoading(true); setError(""); if (retry) emptyPages.current = 0;
    let timedOut = false;
    const deadline = setTimeout(() => { timedOut = true; request.abort(); }, 12000);
    try {
      const response = await fetch(appServiceUrl("/api/video/search"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, continuation: cursor }), signal: request.signal, cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.videos)) throw Error("Page unavailable");
      if (generation.current !== revision || request.signal.aborted) return;
      const page = readVideoPage(data.videos), known = new Set(videos.map((video) => video.id));
      const added = page.filter((video) => !known.has(video.id));
      onAppend(added);
      emptyPages.current = added.length ? 0 : emptyPages.current + 1;
      const next = readContinuation(data.continuation);
      activeCursor.current = next?.token === cursor.token ? null : next;
      setCursor(activeCursor.current);
      if (emptyPages.current >= 2 && next && next.token !== cursor.token) setError("No new videos arrived on these pages. Try loading again.");
    } catch {
      if (generation.current === revision && (!request.signal.aborted || timedOut)) {
        lastToken.current = null;
        setError("More videos couldn’t load. Your current results are still here.");
      }
    } finally {
      clearTimeout(deadline);
      if (generation.current === revision && controller.current === request) { controller.current = null; locked.current = false; setLoading(false); }
    }
  }, [cursor, enabled, error, onAppend, query, videos]);
  useEffect(() => {
    suspended.current = !enabled;
    const target = sentinel.current;
    if (!target || !enabled || !cursor || error || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) void loadMore(); }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, enabled, error, loadMore, scope]);
  const attachSentinel = useCallback((element: HTMLDivElement | null) => { sentinel.current = element; }, []);
  return { cursor, loading, error, attachSentinel, reset, seed, pause, loadMore };
}
