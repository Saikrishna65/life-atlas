import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Life Atlas",
  description: "The philosophy and technology behind this personal archive.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <header className="mb-24">
          <h1 className="font-display text-5xl md:text-7xl tracking-tighter mb-6 text-foreground leading-tight">
            About the Atlas.
          </h1>
          <p className="font-sans text-muted-foreground text-lg md:text-xl font-light tracking-wide max-w-xl">
            A digital monument to the places, people, and moments that shape a life.
          </p>
        </header>

        <article className="prose prose-lg prose-invert max-w-none">
          <section className="mb-16">
            <h2 className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-6">The Purpose</h2>
            <p className="font-body text-xl font-light leading-relaxed text-foreground/85 mb-6">
              Life Atlas exists because human memory is beautifully flawed. We remember the feeling of a place, the color of the sky, or the taste of a meal, but the exact coordinates and dates slip away over time. This project is an attempt to anchor those fleeting moments.
            </p>
            <p className="font-body text-xl font-light leading-relaxed text-foreground/85">
              It is not a social network or a travel blog meant for public consumption and algorithmic optimization. It is a deeply personal archive. A way to look back at the topography of a life and see the interconnected web of journeys, conversations, and discoveries.
            </p>
          </section>

          <section className="mb-16">
            <h2 className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-6">Photography & Observation</h2>
            <p className="font-body text-xl font-light leading-relaxed text-foreground/85 mb-6">
              Photography here serves as a tool for observation rather than exhibition. The images scattered across this atlas are fragments of atmospheres—the geometry of an unknown city, the quiet of an early morning flight, or the chaotic energy of a night market. 
            </p>
            <p className="font-body text-xl font-light leading-relaxed text-foreground/85">
              By collecting places, stories, and photographs in one unified space, the relationships between them become clear. A cup of coffee in Tokyo is no longer just an isolated image; it is tied to a coordinate on a map, and a specific trip.
            </p>
          </section>

          <section className="mb-16">
            <h2 className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-6">The Technology</h2>
            <p className="font-body text-xl font-light leading-relaxed text-foreground/85 mb-6">
              Life Atlas is built on modern web primitives. It is powered by <strong>Next.js</strong> for seamless routing and server-rendered performance, allowing the archive to remain fast regardless of how many memories it holds.
            </p>
            <p className="font-body text-xl font-light leading-relaxed text-foreground/85 mb-6">
              The data—every trip, coordinate, and photograph—is modeled using <strong>Prisma</strong> and stored securely in a <strong>PostgreSQL</strong> database. 
            </p>
            <p className="font-body text-xl font-light leading-relaxed text-foreground/85">
              For interactions and fluidity, the interface uses <strong>Tailwind CSS</strong> for styling, <strong>Lenis</strong> for buttery smooth scrolling, and <strong>GSAP</strong> to craft cinematic, meaningful motion without overwhelming the senses.
            </p>
          </section>
        </article>

        <div className="mt-32 pt-16 border-t border-muted/20 flex justify-center">
          <div className="w-16 h-16 rounded-full border border-muted/30 flex items-center justify-center text-muted-foreground/50">
            <span className="font-display text-2xl tracking-tighter">LA</span>
          </div>
        </div>
      </div>
    </main>
  );
}
