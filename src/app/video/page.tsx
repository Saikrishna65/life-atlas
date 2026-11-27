import type { Metadata } from "next";
import AtlasVideoWeb from "@/components/video/AtlasVideoWeb";
export const metadata: Metadata = {
  title: "Atlas Video",
  description: "Search videos or open a YouTube link in Atlas Video.",
  robots: { index: false, follow: false },
};
export default function VideoPage() {
  return <AtlasVideoWeb standalone />;
}
