import Link from "next/link";
import { JournalEntry, Trip } from "@prisma/client";

type JournalWithTrip = JournalEntry & {
  trip?: Pick<Trip, "title" | "slug" | "coverImage"> | null;
};

export default function JournalCard({ entry }: { entry: JournalWithTrip }) {
  const dateStr = new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const excerpt = entry.content.length > 200 ? entry.content.substring(0, 200) + '...' : entry.content;
  const coverImage = entry.trip?.coverImage;

  return (
    <article className="group flex flex-col md:flex-row gap-8 items-start border-b border-muted/20 pb-12 last:border-0 last:pb-0">
      {coverImage && (
        <div className="w-full md:w-1/3 aspect-[4/3] bg-muted/10 overflow-hidden rounded-sm flex-shrink-0">
          <Link href={`/journal/${entry.slug}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={coverImage} 
              alt={entry.title} 
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
            />
          </Link>
        </div>
      )}
      
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-accent/80">{dateStr}</span>
          {entry.trip && (
            <>
              <span className="w-4 h-[1px] bg-muted/50" />
              <Link href={`/trips/${entry.trip.slug}`} className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
                {entry.trip.title}
              </Link>
            </>
          )}
        </div>
        
        <Link href={`/journal/${entry.slug}`}>
          <h2 className="font-display text-3xl md:text-4xl text-foreground group-hover:text-accent transition-colors leading-tight">
            {entry.title}
          </h2>
        </Link>
        
        <p className="font-body text-lg text-muted-foreground leading-relaxed font-light mt-2 max-w-2xl">
          {excerpt}
        </p>
        
        <div className="mt-4">
          <Link href={`/journal/${entry.slug}`} className="inline-flex items-center font-sans text-xs uppercase tracking-[0.1em] text-foreground hover:text-accent transition-colors border-b border-muted hover:border-accent pb-0.5">
            Read Entry <span className="ml-2 font-normal">&rarr;</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
