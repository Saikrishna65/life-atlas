import { getFoodExperiences } from "@/lib/queries/experiences";
import { Metadata } from "next";
import FoodCard from "@/components/experiences/FoodCard";

export const metadata: Metadata = {
  title: "Food | Life Atlas",
  description: "A personal archive of memorable meals and culinary experiences.",
};

export default async function FoodPage() {
  const foodExperiences = await getFoodExperiences();

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <header className="mb-24">
          <h1 className="font-display text-5xl md:text-7xl tracking-tighter mb-6 text-foreground">Food.</h1>
          <p className="font-sans text-muted-foreground text-lg md:text-xl font-light tracking-wide max-w-xl">
            A personal memory archive of memorable meals and culinary experiences around the world.
          </p>
        </header>

        {foodExperiences.length === 0 ? (
          <div className="py-20 text-center border border-muted/20 rounded-sm">
            <p className="font-sans text-muted-foreground">No food experiences recorded yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-12">
            {foodExperiences.map((exp) => (
              <FoodCard key={exp.id} experience={exp} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
