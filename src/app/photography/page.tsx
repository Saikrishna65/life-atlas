import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import PublishedMedia from "@/components/world/PublishedMedia";
import MemoryArchive from "@/components/world/MemoryArchive";
export const metadata: Metadata = {
  title: "Frames & films",
  description: "Photographs, films and the moments in between. The Life Atlas visual journal.",
};
export default function Page() {
  return (
    <PublicPage
      title={"Frames & films."}
      kicker={"Still photographs. Moving memories. A life, in the making."}
    >
      <MemoryArchive />
      <PublishedMedia />
    </PublicPage>
  );
}
