import { getCinemaExperiences } from "@/lib/queries/experiences";
import { Metadata } from "next";
import CinemaCard from "@/components/experiences/CinemaCard";

export const metadata: Metadata = {
  title: "Cinema | Life Atlas",
  description: "A personal archive of films watched and cinemas visited.",
};

export default async function CinemaPage() {
  const cinemaExperiences = await getCinemaExperiences();

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <header className="mb-24">
          <h1 className="font-display text-5xl md:text-7xl tracking-tighter mb-6 text-foreground">Cinema.</h1>
          <p className="font-sans text-muted-foreground text-lg md:text-xl font-light tracking-wide max-w-xl">
            A personal archive of films watched, cinemas visited, and stories experienced.
          </p>
        </header>

        {cinemaExperiences.length === 0 ? (
          <div className="py-20 text-center border border-muted/20 rounded-sm">
            <p className="font-sans text-muted-foreground">No cinema experiences recorded yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-12">
            {cinemaExperiences.map((exp) => (
              <CinemaCard key={exp.id} experience={exp} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
