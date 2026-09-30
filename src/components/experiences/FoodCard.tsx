import Link from "next/link";
import { Experience, FoodExperience, Place, Trip } from "@prisma/client";

type FoodExperienceWithRelations = Experience & {
  foodExperience: FoodExperience | null;
  trip?: Pick<Trip, "title" | "slug"> | null;
  place?: Pick<Place, "name" | "slug" | "country"> | null;
};

export default function FoodCard({ experience }: { experience: FoodExperienceWithRelations }) {
  const dateStr = experience.date ? new Date(experience.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null;
  const locationText = experience.place ? `${experience.place.name}, ${experience.place.country}` : null;
  const food = experience.foodExperience;

  return (
    <article className="group flex flex-col gap-4 border-b border-muted/20 pb-12 last:border-0 last:pb-0">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start mb-2">
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-accent/80">FOOD</span>
          {dateStr && <span className="font-sans text-xs text-muted-foreground/80">{dateStr}</span>}
        </div>
        
        <h3 className="font-display text-3xl md:text-4xl text-foreground tracking-tight">
          {food?.restaurant || experience.title}
        </h3>
        
        {food?.dish && (
          <h4 className="font-sans text-lg text-foreground/90 font-light mt-1">{food.dish}</h4>
        )}
        
        <div className="flex items-center gap-4 mt-2">
          {locationText && (
            <span className="font-sans text-sm text-muted-foreground/80 tracking-wide">{locationText}</span>
          )}
          {food?.rating && (
            <span className="font-sans text-xs bg-muted/50 text-foreground px-2 py-1 rounded-sm">
              {food.rating}/5
            </span>
          )}
        </div>
        
        {experience.description && (
          <p className="font-body text-lg text-muted-foreground mt-4 leading-relaxed max-w-2xl font-light">
            {experience.description}
          </p>
        )}

        {experience.trip && (
          <div className="mt-6">
             <Link href={`/trips/${experience.trip.slug}`} className="inline-flex items-center font-sans text-xs uppercase tracking-[0.1em] text-foreground hover:text-accent transition-colors border-b border-muted hover:border-accent pb-0.5">
               Part of {experience.trip.title} <span className="ml-2 font-normal">&rarr;</span>
             </Link>
          </div>
        )}
      </div>
    </article>
  );
}
