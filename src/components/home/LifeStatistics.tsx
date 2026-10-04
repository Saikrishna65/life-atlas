export default function LifeStatistics({ stats }: { stats: { trips: number, places: number, photos: number, memories: number } }) {
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto border-t border-muted">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Trips</span>
          <span className="font-display text-5xl text-foreground">{stats.trips}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Places</span>
          <span className="font-display text-5xl text-foreground">{stats.places}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Photographs</span>
          <span className="font-display text-5xl text-foreground">{stats.photos}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Memories</span>
          <span className="font-display text-5xl text-foreground">{stats.memories}</span>
        </div>
      </div>
    </section>
  );
}
