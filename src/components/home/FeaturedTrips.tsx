import Link from "next/link";
import Image from "next/image";
import { Trip } from "@prisma/client";

export default function FeaturedTrips({ trips }: { trips: Trip[] }) {
  if (trips.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto border-t border-muted">
      <h2 className="font-display text-4xl mb-12 tracking-wide text-foreground">SELECTED JOURNEYS</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {trips.map((trip, index) => {
          // A simple editorial layout: first trip is large (span 8), next is smaller (span 4), etc.
          const isLarge = index % 3 === 0;
          const colSpan = isLarge ? "md:col-span-8" : "md:col-span-4";
          
          return (
            <Link 
              key={trip.id} 
              href={`/trips/${trip.slug}`}
              className={`group relative overflow-hidden flex flex-col justify-end aspect-[4/3] ${isLarge ? 'md:aspect-[16/9]' : 'md:aspect-[3/4]'} ${colSpan}`}
            >
              <Image
                src={trip.coverImage || '/placeholder-image.jpg'}
                alt={trip.title}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
                sizes={isLarge ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <div className="relative z-10 p-8 flex flex-col h-full justify-between opacity-90 group-hover:opacity-100 transition-opacity">
                <span className="font-sans text-xs tracking-widest text-white/70">
                  {String(index + 1).padStart(2, '0')}
                </span>
                
                <div>
                  <h3 className="font-display text-3xl md:text-4xl text-white mb-3">
                    {trip.title}
                  </h3>
                  <div className="font-sans text-sm tracking-wide text-white/80 space-y-1 mb-4">
                    <p>{trip.destination}</p>
                    <p>{trip.duration} &middot; {new Date(trip.startDate).getFullYear()}</p>
                  </div>
                  {trip.description && (
                    <p className="font-body text-base text-white/90 max-w-md hidden md:block">
                      {trip.description}
                    </p>
                  )}
                  <div className="mt-6 flex items-center text-sm tracking-widest uppercase font-sans text-white/70 group-hover:text-white transition-colors">
                    Explore journey &rarr;
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
