import { Trip, TripPlace, Place } from "@prisma/client";

type TripWithPlaces = Trip & {
  tripPlaces: (TripPlace & { place: Place })[];
};

export default function TripOverview({ trip, photoCount }: { trip: TripWithPlaces, photoCount: number }) {
  return (
    <section className="py-24 px-6 max-w-4xl mx-auto">
      {trip.description && (
        <div className="mb-24 text-center">
          <p className="font-display text-2xl md:text-3xl leading-relaxed text-foreground/80 italic">
            {trip.description}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-12 border-t border-muted pt-16 text-center">
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Destination</span>
          <span className="font-body text-lg text-foreground">{trip.destination}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Duration</span>
          <span className="font-body text-lg text-foreground">{trip.duration || 'N/A'}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Places</span>
          <span className="font-body text-lg text-foreground">{trip.tripPlaces.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Photographs</span>
          <span className="font-body text-lg text-foreground">{photoCount}</span>
        </div>
      </div>
    </section>
  );
}
