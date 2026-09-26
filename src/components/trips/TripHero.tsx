import { Trip } from "@prisma/client";

export default function TripHero({ trip }: { trip: Trip }) {
  const year = new Date(trip.startDate).getFullYear();

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${trip.coverImage || '/placeholder-image.jpg'})` }}
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center gap-6 mt-16">
        <div className="font-sans text-xs uppercase tracking-widest text-white/70 mb-4">
          {trip.destination}
        </div>
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-tight text-white">
          {trip.title}
        </h1>
        <div className="font-sans text-sm tracking-wide text-white/80 space-x-4 mt-6">
          <span>{year}</span>
          {trip.duration && (
            <>
              <span>&middot;</span>
              <span>{trip.duration}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <div className="w-[1px] h-12 bg-white/30" />
      </div>
    </section>
  );
}
