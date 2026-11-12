import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import PublishedMedia from "@/components/world/PublishedMedia";
import MemoryArchive from "@/components/world/MemoryArchive";
export const metadata: Metadata = {
  title: "A moment, held.",
  description: "Not everything that matters fits inside a frame.",
};
export default function Page() {
  return (
    <PublicPage
      title={"A moment, held."}
      kicker={"Not everything that matters fits inside a frame."}
    >
      <MemoryArchive />
      <PublishedMedia />
    </PublicPage>
  );
}
