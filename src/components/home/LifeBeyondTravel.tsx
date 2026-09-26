import Link from "next/link";
import { Experience } from "@prisma/client";

export default function LifeBeyondTravel({ experiences }: { experiences: Experience[] }) {
  if (experiences.length === 0) return null;

  return (
    <section className="py-32 px-6 max-w-7xl mx-auto border-t border-white/10">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-4">
        <div>
          <h2 className="font-display text-4xl tracking-wide text-white mb-3">And everything else worth remembering.</h2>
          <p className="font-body text-lg text-white/60">Food, cinema, and moments closer to home.</p>
        </div>
        <Link href="/experiences" className="font-sans text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors">
          View all experiences &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {experiences.map((exp) => (
          <Link href={`/experiences`} key={exp.id} className="group flex flex-col gap-4">
            <div className="aspect-[4/5] bg-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
            </div>
            <div>
              <span className="font-sans text-xs uppercase tracking-widest text-white/50">{exp.type}</span>
              <h3 className="font-display text-xl text-white mt-1 group-hover:text-white/80 transition-colors">{exp.title}</h3>
              {exp.date && <p className="font-sans text-xs tracking-wide text-white/40 mt-2">{new Date(exp.date).toLocaleDateString()}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
