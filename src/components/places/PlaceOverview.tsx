import { Place } from "@prisma/client";

export default function PlaceOverview({ place }: { place: Place }) {
  return (
    <section className="py-24 px-6 max-w-4xl mx-auto">
      {place.description && (
        <div className="mb-24 text-center">
          <p className="font-display text-2xl md:text-3xl leading-relaxed text-white/90 italic">
            {place.description}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-12 border-t border-white/10 pt-16 text-center">
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-white/50">Coordinates</span>
          <span className="font-body text-lg text-white">
            {place.latitude && place.longitude 
              ? `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`
              : 'Unknown'
            }
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-white/50">Location</span>
          <span className="font-body text-lg text-white">
            {[place.city, place.region, place.country].filter(Boolean).join(", ")}
          </span>
        </div>
      </div>
    </section>
  );
}
