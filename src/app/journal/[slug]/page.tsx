import { getJournalEntryBySlug, getNextJournalEntry } from "@/lib/queries/journal";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getJournalEntryBySlug(slug);
  if (!entry) return { title: "Not Found" };
  
  return {
    title: `${entry.title} | Journal`,
    description: entry.content.substring(0, 160) + '...',
    openGraph: {
      title: `${entry.title} | Journal`,
      description: entry.content.substring(0, 160) + '...',
      images: entry.trip?.coverImage ? [entry.trip.coverImage] : undefined,
    }
  };
}

export default async function JournalEntryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const entry = await getJournalEntryBySlug(slug);
  
  if (!entry) {
    notFound();
  }

  const nextEntry = await getNextJournalEntry(entry.date);
  const dateStr = new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Simple paragraph splitting for rendering the body
  const paragraphs = entry.content.split('\n\n').filter(p => p.trim() !== '');

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <article className="max-w-3xl mx-auto px-6 md:px-12">
        
        <Link href="/journal" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-12 font-sans text-xs uppercase tracking-widest">
          <ChevronLeft size={14} className="mr-2" /> Back to Journal
        </Link>
        
        <header className="mb-16">
          <div className="flex flex-wrap items-center gap-4 mb-6">
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
          
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground leading-tight tracking-tight">
            {entry.title}
          </h1>
        </header>

        {entry.trip?.coverImage && (
          <div className="w-full aspect-[21/9] bg-muted/10 mb-16 overflow-hidden rounded-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={entry.trip.coverImage} 
              alt="Cover" 
              className="w-full h-full object-cover" 
            />
          </div>
        )}

        {/* The reading column */}
        <div className="max-w-2xl mx-auto">
          {paragraphs.map((p, i) => (
            <p key={i} className="font-body text-xl font-light leading-relaxed text-foreground/85 mb-8">
              {p}
            </p>
          ))}
        </div>

        {/* Related Media */}
        {entry.trip?.photos && entry.trip.photos.length > 0 && (
          <div className="mt-24 pt-16 border-t border-muted/20">
            <h3 className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-8">From this journey</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {entry.trip.photos.map(photo => (
                <div key={photo.id} className="aspect-square bg-muted/10 rounded-sm overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption || ''} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Entry */}
        {nextEntry && (
          <div className="mt-24 pt-16 border-t border-muted/20 flex flex-col items-center text-center">
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Next Entry</span>
            <Link href={`/journal/${nextEntry.slug}`} className="group">
              <h3 className="font-display text-3xl text-foreground group-hover:text-accent transition-colors">
                {nextEntry.title}
              </h3>
            </Link>
          </div>
        )}

      </article>
    </main>
  );
}
