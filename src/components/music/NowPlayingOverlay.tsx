"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
const NowPlayingModal = dynamic(() => import("./NowPlayingModal"));

export default function NowPlayingOverlay() {
  const { isNowPlayingOpen } = useMusicPlayer();
  const [visited, setVisited] = useState(false);
  if (isNowPlayingOpen && !visited) setVisited(true);
  // Once opened, retain sleep-timer and queue state when the overlay is hidden.
  return isNowPlayingOpen || visited ? <NowPlayingModal /> : null;
}
