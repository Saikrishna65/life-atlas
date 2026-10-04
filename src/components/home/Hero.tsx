"use client";

// Hero component

export default function Hero() {
  return (
    <section 
      className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-background text-foreground"
    >
      <div 
        className="absolute inset-0 z-0 bg-background opacity-0 hero-fade-in"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-hover/30 z-10" />
      </div>
      
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto flex flex-col items-center gap-8 mt-16">
        <h1 
          className="font-display text-5xl md:text-7xl lg:text-8xl xl:text-9xl leading-[0.9] opacity-0 hero-fade-in-up hero-delay-1 tracking-[-0.03em] font-bold"
        >
          A place for the <span className="text-accent italic">moments</span> I want to <span className="text-accent-red italic">remember</span>.
        </h1>
        <p 
          className="font-body text-lg md:text-2xl max-w-2xl text-muted-foreground opacity-0 hero-fade-in-up hero-delay-2 leading-relaxed"
        >
          Travels, places, people, food, films and everything in between.
        </p>
      </div>
      
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4 opacity-0 hero-fade-in-up hero-delay-2">
        <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-semibold">Scroll to explore</span>
        <div className="w-[1px] h-16 bg-muted-foreground/40" />
      </div>
    </section>
  );
}
