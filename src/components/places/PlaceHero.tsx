import { Place } from "@prisma/client";

export default function PlaceHero({ place }: { place: Place }) {
  return (
    <section className="relative h-[70vh] w-full flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${place.coverImage || '/placeholder-image.jpg'})` }}
      />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center gap-6 mt-16">
        <div className="font-sans text-xs uppercase tracking-widest text-white/70 mb-4">
          {place.country}
        </div>
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-tight text-white">
          {place.name}
        </h1>
        <div className="font-sans text-sm tracking-wide text-white/80 space-x-4 mt-6">
          {place.region && <span>{place.region}</span>}
          {place.region && place.city && <span>&middot;</span>}
          {place.city && <span>{place.city}</span>}
        </div>
      </div>
    </section>
  );
}
