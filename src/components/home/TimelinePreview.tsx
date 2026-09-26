import Link from "next/link";
import { TimelineEvent } from "@prisma/client";

export default function TimelinePreview({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-4xl mx-auto border-t border-white/10">
      <div className="flex justify-between items-end mb-16">
        <h2 className="font-display text-3xl tracking-wide text-white">RECENT HISTORY</h2>
        <Link href="/timeline" className="font-sans text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors">
          Explore the timeline &rarr;
        </Link>
      </div>
      
      <div className="space-y-12">
        {events.map((event) => {
          const date = new Date(event.date);
          const month = date.toLocaleString('default', { month: 'long' });
          const year = date.getFullYear();
          
          return (
            <div key={event.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 group">
              <div className="md:col-span-3 pt-1">
                <span className="font-sans text-sm tracking-widest uppercase text-white/50">{month} {year}</span>
              </div>
              <div className="md:col-span-9">
                <h3 className="font-display text-2xl text-white group-hover:text-white/80 transition-colors">{event.title}</h3>
                {event.description && (
                  <p className="font-body text-white/60 mt-2 max-w-2xl">{event.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
