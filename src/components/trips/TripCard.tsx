import Link from "next/link";
import { Trip, TripPlace, Place } from "@prisma/client";

type TripWithRelations = Trip & {
  tripPlaces?: (TripPlace & { place: Place })[];
  _count?: { photos: number };
};

export default function TripCard({ trip }: { trip: TripWithRelations }) {
  const year = new Date(trip.startDate).getFullYear();
  const placesStr = trip.tripPlaces?.map(tp => tp.place.name).join(", ");
  const locationText = placesStr || trip.destination;

  return (
    <Link href={`/trips/${trip.slug}`} className="group flex flex-col gap-4">
      <div className="aspect-[4/3] bg-white/5 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
          style={{ backgroundImage: `url(${trip.coverImage || '/placeholder-image.jpg'})` }}
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
      </div>
      <div>
        <div className="flex justify-between items-start mb-1">
          <span className="font-sans text-xs uppercase tracking-widest text-white/50">{locationText}</span>
          <span className="font-sans text-xs text-white/50">{year}</span>
        </div>
        <h3 className="font-display text-2xl text-white group-hover:text-white/80 transition-colors">{trip.title}</h3>
        
        <div className="flex gap-4 mt-3">
          {trip.duration && (
            <span className="font-sans text-xs tracking-wide text-white/40">{trip.duration}</span>
          )}
          {trip._count !== undefined && trip._count.photos > 0 && (
            <span className="font-sans text-xs tracking-wide text-white/40">{trip._count.photos} photos</span>
          )}
        </div>
        
        {trip.description && (
          <p className="font-body text-sm text-white/70 mt-3 line-clamp-2">
            {trip.description}
          </p>
        )}
      </div>
    </Link>
  );
}
