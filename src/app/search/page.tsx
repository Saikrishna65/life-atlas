import { Metadata } from "next";
import { searchGlobal } from "@/lib/queries/search";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Search | Life Atlas",
  description: "Search the archive.",
};

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function SearchPage(props: { searchParams: Params }) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  
  const results = await searchGlobal(q);

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <header className="mb-16 border-b border-muted/20 pb-12">
          <h1 className="font-display text-5xl tracking-tighter mb-6 text-foreground">Search.</h1>
          <form method="GET" action="/search" className="flex gap-4">
            <input 
              type="text" 
              name="q" 
              defaultValue={q}
              placeholder="Search..."
              className="flex-1 bg-transparent border-b border-muted/30 focus:border-foreground pb-2 font-sans text-xl text-foreground outline-none transition-colors"
            />
            <button type="submit" className="font-sans text-xs uppercase tracking-[0.1em] text-accent hover:text-accent/80 transition-colors">
              Search &rarr;
            </button>
          </form>
        </header>

        {q && results.length === 0 ? (
          <div className="py-20 text-center border border-muted/20 rounded-sm">
            <p className="font-sans text-muted-foreground tracking-wide text-sm">No results found for &quot;{q}&quot;.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {results.map((result) => (
              <Link key={result.id + result.type} href={result.url} className="group block border border-muted/20 p-6 rounded-sm hover:border-muted transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-accent/80">{result.type}</span>
                </div>
                <h3 className="font-display text-2xl text-foreground group-hover:text-accent transition-colors">{result.title}</h3>
                {(result.excerpt || result.location) && (
                  <p className="font-body text-muted-foreground mt-2 font-light">
                    {result.excerpt || result.location}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
