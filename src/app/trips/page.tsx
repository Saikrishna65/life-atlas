import { getTrips, TripSortOption } from "@/lib/queries/trips";
import TripCard from "@/components/trips/TripCard";
import TripSort from "@/components/trips/TripSort";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trips | Life Atlas",
  description: "An archive of journeys, roads, and destinations.",
};

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const validSorts: TripSortOption[] = ['latest', 'oldest', 'longest', 'most-photos'];
  const sortOption = validSorts.includes(sort as TripSortOption) ? (sort as TripSortOption) : 'latest';

  const trips = await getTrips(sortOption);

  return (
    <main className="bg-background text-foreground min-h-screen pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-24 md:mb-32">
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-white tracking-wide mb-6">
            Journeys
          </h1>
          <p className="font-body text-xl text-white/60 max-w-2xl">
            An archive of roads taken, mountains climbed, and places that changed the way I see the world.
          </p>
        </header>

        <div className="flex justify-between items-end border-b border-white/10 pb-6 mb-12">
          <div className="font-sans text-sm tracking-widest uppercase text-white/50">
            {trips.length} {trips.length === 1 ? 'Trip' : 'Trips'}
          </div>
          <TripSort />
        </div>

        {trips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center border-t border-white/5">
            <h3 className="font-display text-3xl text-white/40 mb-4">No journeys yet.</h3>
            <p className="font-sans text-sm text-white/30 uppercase tracking-widest">
              The archive is waiting for the first trip.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
