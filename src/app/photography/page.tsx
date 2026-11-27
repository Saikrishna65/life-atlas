export const revalidate=300;
import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import PublishedGallery from "@/components/world/PublishedGallery";
import {getScrapbookMedia} from "@/lib/queries/scrapbook";
export const metadata: Metadata = {
  title: "Frames & films",
  description: "Photographs, films and the moments in between. The Atlas visual journal.",
};
export default async function Page() {
  const frames=await getScrapbookMedia();
  return (
    <PublicPage
      title={"Frames & films."}
      kicker={"Still photographs. Moving memories. A life, in the making."}
    >
      <PublishedGallery frames={frames}/>
    </PublicPage>
  );
}
