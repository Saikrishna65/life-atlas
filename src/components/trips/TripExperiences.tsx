import { Experience, FoodExperience, Movie } from "@prisma/client";

type FullExperience = Experience & {
  foodExperience?: FoodExperience | null;
  movie?: Movie | null;
};

export default function TripExperiences({ experiences }: { experiences: FullExperience[] }) {
  if (experiences.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-4xl mx-auto border-t border-muted">
      <h2 className="font-display text-3xl mb-16 tracking-wide text-foreground">BEYOND THE ITINERARY</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {experiences.map((exp) => {
          const rating = exp.foodExperience?.rating ?? exp.movie?.rating ?? null;
          const reviewText = exp.description ?? exp.movie?.review ?? null;

          return (
            <div key={exp.id} className="border border-muted p-6 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">{exp.type}</span>
                {exp.date && <span className="font-sans text-xs text-muted-foreground/80">{new Date(exp.date).toLocaleDateString()}</span>}
              </div>
              <h3 className="font-display text-xl text-foreground">{exp.title}</h3>
              {reviewText && <p className="font-body text-foreground/80 italic text-sm">{reviewText}</p>}
              {rating !== null && (
                <div className="font-sans text-xs text-muted-foreground tracking-widest mt-auto pt-4">
                  {rating} / 10
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
