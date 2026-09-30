import { getExperiences } from "@/lib/queries/experiences";
import { Metadata } from "next";
import ExperienceCard from "@/components/experiences/ExperienceCard";

export const metadata: Metadata = {
  title: "Experiences | Life Atlas",
  description: "An archive of memorable experiences and events.",
};

export default async function ExperiencesPage() {
  const experiences = await getExperiences();

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <header className="mb-24">
          <h1 className="font-display text-5xl md:text-7xl tracking-tighter mb-6 text-foreground">Experiences.</h1>
          <p className="font-sans text-muted-foreground text-lg md:text-xl font-light tracking-wide max-w-xl">
            Moments, events, and activities that left an impression.
          </p>
        </header>

        {experiences.length === 0 ? (
          <div className="py-20 text-center border border-muted/20 rounded-sm">
            <p className="font-sans text-muted-foreground">No experiences recorded yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-12">
            {experiences.map((exp) => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
