import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center pt-32">
      <h1 className="font-display text-6xl md:text-8xl text-foreground mb-6">404</h1>
      <p className="font-body text-xl text-muted-foreground mb-12 max-w-md mx-auto">
        This coordinate is missing from the atlas. The page you are looking for might have been moved or doesn&apos;t exist.
      </p>
      <Link 
        href="/" 
        className="font-sans text-sm uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors border-b border-foreground/15 hover:border-accent pb-1"
      >
        Return to the map
      </Link>
    </main>
  );
}
