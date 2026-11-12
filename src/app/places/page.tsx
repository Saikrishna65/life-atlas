import type { Metadata } from "next";
import PublicPage from "@/components/world/PublicPage";
import AtlasDirectory from "@/components/world/AtlasDirectory";
export const metadata: Metadata = {
  title: "A world of somewhere.",
  description: "Thirty-six places to let your imagination wander.",
};
export default function Page() {
  return (
    <PublicPage
      title={"A world of somewhere."}
      kicker={"Thirty-six places to let your imagination wander."}
    >
      <AtlasDirectory initial="Places" />
    </PublicPage>
  );
}
