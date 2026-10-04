import { TripDay } from "@prisma/client";

export default function TripDays({ days }: { days: TripDay[] }) {
  if (days.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-4xl mx-auto border-t border-muted">
      <h2 className="font-display text-3xl mb-16 tracking-wide text-foreground">THE ITINERARY</h2>
      <div className="space-y-16">
        {days.map((day) => (
          <div key={day.id} className="grid grid-cols-1 md:grid-cols-12 gap-8 border-l border-foreground/15 pl-8 relative">
            <div className="absolute top-0 left-0 w-[5px] h-[5px] rounded-full bg-accent -translate-x-[3px] mt-2" />
            <div className="md:col-span-3">
              <span className="font-sans text-xs tracking-widest uppercase text-muted-foreground block mb-2">Day {day.dayIndex}</span>
              {day.date && <span className="font-sans text-sm text-foreground/80">{new Date(day.date).toLocaleDateString()}</span>}
            </div>
            <div className="md:col-span-9">
              {day.title && <h3 className="font-display text-2xl text-foreground mb-4">{day.title}</h3>}
              <p className="font-body text-foreground/80 leading-relaxed whitespace-pre-wrap">{day.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
