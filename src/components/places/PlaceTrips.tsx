import { TripPlace, Trip } from "@prisma/client";
import Link from "next/link";

type PlaceTrip = TripPlace & { trip: Trip };

export default function PlaceTrips({ tripPlaces }: { tripPlaces: PlaceTrip[] }) {
  if (tripPlaces.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-4xl mx-auto border-t border-white/10">
      <h2 className="font-display text-3xl mb-16 tracking-wide text-white text-center">RELATED JOURNEYS</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tripPlaces.map((tp) => (
          <Link href={`/trips/${tp.trip.slug}`} key={tp.id} className="group flex flex-col gap-4 border border-white/10 p-6">
            <span className="font-sans text-xs uppercase tracking-widest text-white/50">
              {tp.visitDate ? new Date(tp.visitDate).toLocaleDateString() : new Date(tp.trip.startDate).getFullYear()}
            </span>
            <h3 className="font-display text-2xl text-white group-hover:text-white/80 transition-colors">
              {tp.trip.title}
            </h3>
            {tp.trip.duration && <p className="font-sans text-xs text-white/40">{tp.trip.duration}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}
