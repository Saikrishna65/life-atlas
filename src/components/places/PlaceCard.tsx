import Link from "next/link";
import { Place, TripPlace, Trip } from "@prisma/client";

type PlaceWithRelations = Place & {
  tripPlaces?: (TripPlace & { trip: Trip })[];
  _count?: { photos: number; experiences: number };
};

export default function PlaceCard({ place }: { place: PlaceWithRelations }) {
  const locationText = [place.city, place.region, place.country].filter(Boolean).join(", ");
  const tripCount = place.tripPlaces?.length || 0;
  
  // Try to find the most recent visit date
  const visitDates = place.tripPlaces
    ?.map(tp => tp.visitDate || tp.trip.startDate)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
  const lastVisited = visitDates && visitDates.length > 0 ? visitDates[0] : null;

  return (
    <Link href={`/places/${place.slug}`} className="group flex flex-col gap-4">
      <div className="aspect-[4/3] bg-surface relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
          style={{ backgroundImage: `url(${place.coverImage || '/placeholder-image.jpg'})` }}
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
      </div>
      <div>
        <div className="flex justify-between items-start mb-1">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">{place.country}</span>
          {lastVisited && <span className="font-sans text-xs text-muted-foreground">{new Date(lastVisited).getFullYear()}</span>}
        </div>
        <h3 className="font-display text-2xl text-foreground group-hover:text-accent transition-colors">{place.name}</h3>
        
        <p className="font-body text-sm text-muted-foreground mt-1 line-clamp-1">{locationText}</p>
        
        <div className="flex gap-4 mt-3">
          <span className="font-sans text-xs tracking-wide text-muted-foreground/80">{tripCount} {tripCount === 1 ? 'trip' : 'trips'}</span>
          {place._count !== undefined && place._count.photos > 0 && (
            <span className="font-sans text-xs tracking-wide text-muted-foreground/80">{place._count.photos} photos</span>
          )}
        </div>
      </div>
    </Link>
  );
}
