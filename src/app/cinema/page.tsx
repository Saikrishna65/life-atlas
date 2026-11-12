import PublicPage from "@/components/world/PublicPage";
import EditorialCollections from "@/components/world/EditorialCollections";
export const metadata = {
  title: "Other lives, other worlds",
  description: "An editorial collection of films for the curious.",
};
export default function Page() {
  return (
    <PublicPage
      title="A window into another world."
      kicker="Films that make an ordinary day look a little different."
    >
      <EditorialCollections kind="cinema" />
    </PublicPage>
  );
}
