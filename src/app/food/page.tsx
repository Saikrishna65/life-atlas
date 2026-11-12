import PublicPage from "@/components/world/PublicPage";
import EditorialCollections from "@/components/world/EditorialCollections";
export const metadata = {
  title: "A taste of somewhere",
  description: "Food, places, and the people around the table.",
};
export default function Page() {
  return (
    <PublicPage
      title="Some places begin at a table."
      kicker="A warm cup. An unfamiliar dish. One more story before you leave."
    >
      <EditorialCollections kind="food" />
    </PublicPage>
  );
}
