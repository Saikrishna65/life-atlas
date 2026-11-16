"use client";
import { useEffect, useRef, useState } from "react";
import {
  PUBLIC_CATALOG_STORAGE,
  publicCatalogSource,
} from "@/lib/r2/public-catalog";
import {cachedPublicCatalog} from "./public-catalog-cache";
import {beginPublicTask} from "@/lib/public-loading/readiness";
import type { PublicMediaCatalog } from "@/lib/r2/types";

/** Only a public, validated catalog URL crosses this boundary. Never cloud credentials. */
export function usePublicCatalog() {
  const [source, setSource] = useState("");
  const [catalog, setCatalog] = useState<PublicMediaCatalog | null>(null);
  const [error, setError] = useState(false);
  const lastFetch = useRef(0);
  useEffect(() => {
    let alive = true;
    let address = "";
    try {
      address =
        new URLSearchParams(location.search).get("atlasCatalog") ||
        localStorage.getItem(PUBLIC_CATALOG_STORAGE) ||
        "";
    } catch {
      /* Storage is optional for public browsing. */
    }
    if (!address) return;
    try {
      address = publicCatalogSource(address);
    } catch {
      queueMicrotask(() => {
        if (alive) setError(true);
      });
      return;
    }
    queueMicrotask(() => {
      if (alive) setSource(address);
    });
    let finish=()=>{};
    const load = async () => {
      if (Date.now() - lastFetch.current < 30000) return;
      lastFetch.current = Date.now();
      finish();
      finish=beginPublicTask("Published media catalog");
      try {
        const next = await cachedPublicCatalog(address);
        if (!alive) return;
        setCatalog(next);
        setError(false);
        try {
          localStorage.setItem(PUBLIC_CATALOG_STORAGE, address);
        } catch {
          /* Optional. */
        }
      } catch {
        if (alive) setError(true);
      } finally {
        finish();
      }
    };
    void load();
    const focus = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      alive = false;
      lastFetch.current = 0;
      finish();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  return { source, catalog, error };
}
