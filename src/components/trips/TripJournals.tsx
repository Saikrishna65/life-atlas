import { JournalEntry } from "@prisma/client";
import Link from "next/link";

export default function TripJournals({ journals }: { journals: JournalEntry[] }) {
  if (journals.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-4xl mx-auto border-t border-white/10">
      <h2 className="font-display text-3xl mb-16 tracking-wide text-white text-center">FIELD NOTES</h2>
      <div className="space-y-12">
        {journals.map((journal) => (
          <article key={journal.id} className="group flex flex-col gap-4 items-center text-center">
            <span className="font-sans text-xs uppercase tracking-widest text-white/50">{new Date(journal.date).toLocaleDateString()}</span>
            <Link href={`/journal/${journal.id}`}>
              <h3 className="font-display text-2xl md:text-3xl text-white group-hover:text-white/80 transition-colors">{journal.title}</h3>
            </Link>
            <p className="font-body text-white/60 leading-relaxed max-w-2xl line-clamp-3">{journal.content}</p>
            <Link href={`/journal/${journal.id}`} className="font-sans text-xs uppercase tracking-widest text-white/40 group-hover:text-white mt-4 transition-colors">
              Read entry &rarr;
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
