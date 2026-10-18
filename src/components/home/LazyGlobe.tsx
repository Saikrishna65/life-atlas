"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { GlobePlace } from "./InteractiveGlobe";

const Globe = dynamic(() => import("./InteractiveGlobe"), { ssr: false });

const emptySubscribe = () => () => {};

export default function LazyGlobe({ places }: { places: GlobePlace[] }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <div>
      {mounted ? (
        <Globe places={places} />
      ) : (
        <div className="relative py-28 md:py-36 flex flex-col items-center justify-center bg-background min-h-screen">
          <div className="w-12 h-12 border border-muted/30 rounded-full animate-pulse" />
          <p className="mt-4 font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
            Loading atmosphere...
          </p>
        </div>
      )}
    </div>
  );
}
