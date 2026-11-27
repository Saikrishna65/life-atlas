"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { appServiceUrl } from "../appNetwork";
import { suggestionList, suggestionQuery } from "./suggestions";
export function useVideoSuggestions(value: string, enabled: boolean) {
  const query = enabled ? suggestionQuery(value) : null;
  const [response, setResponse] = useState<{ query: string; items: string[] } | null>(null);
  const serial = useRef(0), controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dismiss = useCallback(() => {
    serial.current++; controller.current?.abort(); controller.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined; setResponse(null);
  }, []);
  useEffect(() => {
    const gate = serial, activeController = controller, activeTimer = timer;
    const generation = ++gate.current;
    if (!query) return;
    const request = new AbortController(); activeController.current = request;
    const pending = setTimeout(async () => {
      const deadline = setTimeout(() => request.abort(), 4000);
      try {
        const result = await fetch(appServiceUrl("/api/video/suggestions"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }), cache: "no-store", signal: request.signal,
        });
        const data = result.ok ? await result.json() : null;
        if (gate.current === generation && !request.signal.aborted)
          setResponse({ query, items: suggestionList(data?.suggestions) });
      } catch {
        if (gate.current === generation && !request.signal.aborted) setResponse(null);
      } finally { clearTimeout(deadline); }
    }, 250);
    activeTimer.current = pending;
    return () => {
      clearTimeout(pending); request.abort();
      if (gate.current === generation) gate.current++;
      if (activeController.current === request) activeController.current = null;
      if (activeTimer.current === pending) activeTimer.current = undefined;
    };
  }, [query]);
  return { items: query && response?.query === query ? response.items : [], dismiss };
}
