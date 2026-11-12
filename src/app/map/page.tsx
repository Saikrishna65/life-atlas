import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import Observatory from "@/components/world/Observatory";
export const metadata: Metadata = {
  title: "The world, within reach.",
  description: "Every coordinate opens a new chapter.",
};
export default function Page() {
  return (
    <PublicPage
      title={"The world, within reach."}
      kicker={"Every coordinate opens a new chapter."}
    >
      <Observatory />
    </PublicPage>
  );
}
