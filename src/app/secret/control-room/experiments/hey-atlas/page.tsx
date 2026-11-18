"use client";

import dynamic from "next/dynamic";

const HeyAtlasExperiment = dynamic(() => import("@/components/control-room/HeyAtlasExperiment"), { ssr: false });

export default function HeyAtlasExperimentPage() {
  return <HeyAtlasExperiment />;
}
