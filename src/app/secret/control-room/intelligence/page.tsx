"use client";
import dynamic from "next/dynamic";
const IntelligenceLab = dynamic(
  () => import("@/components/intelligence-lab/IntelligenceLab"),
  {
    ssr: false,
    loading: () => <p style={{ padding: 24 }}>Opening Intelligence Lab…</p>,
  },
);
export default function IntelligencePage() {
  return <IntelligenceLab />;
}
