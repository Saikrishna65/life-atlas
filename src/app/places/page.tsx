import { getPlaces, PlaceSortOption } from "@/lib/queries/places";
import PlaceCard from "@/components/places/PlaceCard";
import PlaceSort from "@/components/places/PlaceSort";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Places | Life Atlas",
  description: "An archive of places visited and remembered.",
};

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const validSorts: PlaceSortOption[] = ['latest', 'oldest', 'name'];
  const sortOption = validSorts.includes(sort as PlaceSortOption) ? (sort as PlaceSortOption) : 'name';

  const places = await getPlaces(sortOption);

  return (
    <main className="bg-background text-foreground min-h-screen pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-24 md:mb-32">
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-white tracking-wide mb-6">
            Places
          </h1>
          <p className="font-body text-xl text-white/60 max-w-2xl">
            Coordinates, cities, and quiet corners of the world that mean something to me.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-white/10 pb-6 mb-12 gap-4">
          <div className="font-sans text-sm tracking-widest uppercase text-white/50">
            {places.length} {places.length === 1 ? 'Place' : 'Places'}
          </div>
          <PlaceSort />
        </div>

        {places.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center border-t border-white/5">
            <h3 className="font-display text-3xl text-white/40 mb-4">No places yet.</h3>
            <p className="font-sans text-sm text-white/30 uppercase tracking-widest">
              The map is waiting to be filled.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
