import { getJournalEntries } from "@/lib/queries/journal";
import { Metadata } from "next";
import JournalCard from "@/components/journal/JournalCard";

export const metadata: Metadata = {
  title: "Journal | Life Atlas",
  description: "Personal essays, thoughts, and reflections.",
};

export default async function JournalPage() {
  const entries = await getJournalEntries();

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-5xl mx-auto px-6 md:px-12">
        <header className="mb-24 md:w-2/3">
          <h1 className="font-display text-5xl md:text-7xl tracking-tighter mb-6 text-foreground">Journal.</h1>
          <p className="font-sans text-muted-foreground text-lg md:text-xl font-light tracking-wide">
            Essays, field notes, and reflections written along the way.
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="py-32 text-center border border-muted/20 rounded-sm">
            <p className="font-sans text-muted-foreground tracking-wide uppercase text-sm">No journal entries found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-16">
            {entries.map((entry) => (
              <JournalCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
