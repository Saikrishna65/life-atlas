import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import AtlasDirectory from "@/components/world/AtlasDirectory";
export const metadata: Metadata = {
  title: "Find your somewhere",
  description: "Search the public Life Atlas demonstration.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <PublicPage
      title="Follow your curiosity."
      kicker="A place, a road, or the beginning of a story."
    >
      <AtlasDirectory initialQuery={q ?? ""} />
    </PublicPage>
  );
}
