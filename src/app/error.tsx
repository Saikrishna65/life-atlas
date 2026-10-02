"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center pt-32">
      <h1 className="font-display text-4xl md:text-5xl text-white mb-6">A discontinuity occurred.</h1>
      <p className="font-body text-xl text-white/60 mb-12 max-w-md mx-auto">
        Something went wrong while trying to access this part of the archive.
      </p>
      <button
        onClick={() => reset()}
        className="font-sans text-sm uppercase tracking-widest text-white/50 hover:text-white transition-colors border-b border-white/20 hover:border-white pb-1"
      >
        Attempt recovery
      </button>
    </main>
  );
}
