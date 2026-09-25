import Hero from "@/components/home/Hero";
import GlobePlaceholder from "@/components/home/GlobePlaceholder";

export default function Home() {
  return (
    <>
      <Hero />
      <GlobePlaceholder />
      
      {/* Temporary spacing to demonstrate scrolling */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <h2 className="font-display text-3xl mb-8">Selected Journeys</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] bg-muted relative group overflow-hidden" style={{ borderRadius: '4px' }}>
              <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <span className="font-sans text-xs uppercase tracking-widest mb-2">2026</span>
                <h3 className="font-display text-2xl">Journey {i}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
