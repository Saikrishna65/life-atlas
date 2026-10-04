import { Trip, TripPlace, Place } from "@prisma/client";
import Link from "next/link";

type NextTrip = Trip & {
  tripPlaces: (TripPlace & { place: Place })[];
};

export default function NextJourney({ trip }: { trip: NextTrip }) {
  return (
    <section className="py-32 px-6 border-t border-muted text-center relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${trip.coverImage || '/placeholder-image.jpg'})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      
      <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
        <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-6">Continue the journey</span>
        <h2 className="font-display text-4xl md:text-5xl text-foreground mb-8">{trip.title}</h2>
        <Link href={`/trips/${trip.slug}`} className="inline-block border border-foreground/15 px-8 py-3 font-sans text-xs uppercase tracking-widest text-foreground/80 hover:bg-foreground hover:text-background hover:border-foreground transition-colors">
          Explore next trip
        </Link>
      </div>
    </section>
  );
}
