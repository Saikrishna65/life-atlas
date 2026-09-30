import { getExploreItems } from "@/lib/queries/explore";
import { Metadata } from "next";
import ExploreItemCard from "@/components/explore/ExploreItemCard";
import ExploreFilters from "@/components/explore/ExploreFilters";

export const metadata: Metadata = {
  title: "Explore | Life Atlas",
  description: "Browse and filter the entire Life Atlas archive.",
};

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ExplorePage(props: { searchParams: Params }) {
  const searchParams = await props.searchParams;
  
  const category = typeof searchParams.category === 'string' ? searchParams.category : undefined;
  const year = typeof searchParams.year === 'string' ? searchParams.year : undefined;
  const country = typeof searchParams.country === 'string' ? searchParams.country : undefined;
  const region = typeof searchParams.region === 'string' ? searchParams.region : undefined;
  const city = typeof searchParams.city === 'string' ? searchParams.city : undefined;

  const items = await getExploreItems({ category, year, country, region, city });

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-5xl mx-auto px-6 md:px-12">
        <header className="mb-16">
          <h1 className="font-display text-5xl md:text-7xl tracking-tighter mb-6 text-foreground">Explore.</h1>
          <p className="font-sans text-muted-foreground text-lg md:text-xl font-light tracking-wide max-w-xl">
            A unified view across the entire archive.
          </p>
        </header>

        <ExploreFilters />

        {items.length === 0 ? (
          <div className="py-32 text-center border border-muted/20 rounded-sm">
            <p className="font-sans text-muted-foreground tracking-wide uppercase text-sm">No items found matching these filters.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Showing {items.length} result{items.length !== 1 ? 's' : ''}
            </div>
            {items.map((item) => (
              <ExploreItemCard key={`${item.category}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
