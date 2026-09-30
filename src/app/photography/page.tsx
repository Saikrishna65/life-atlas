import { getPhotos } from "@/lib/queries/photography";
import { Metadata } from "next";
import PhotoGallery from "@/components/photography/PhotoGallery";

export const metadata: Metadata = {
  title: "Photography | Life Atlas",
  description: "A visual archive of travels, nature, and street photography.",
};

export default async function PhotographyPage() {
  const photos = await getPhotos();

  return (
    <main className="min-h-screen bg-background pt-32 pb-32">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        <header className="mb-24 md:flex md:items-end justify-between gap-12">
          <div>
            <h1 className="font-display text-5xl md:text-7xl tracking-tighter mb-6 text-foreground">Photography.</h1>
            <p className="font-sans text-muted-foreground text-lg md:text-xl font-light tracking-wide max-w-xl">
              A curated visual archive capturing atmospheres, structures, and moments.
            </p>
          </div>
          
          <div className="mt-12 md:mt-0 flex flex-wrap gap-6 font-sans text-xs uppercase tracking-widest text-muted-foreground/50">
            <span className="text-foreground border-b border-foreground pb-1">All</span>
            <span className="hover:text-foreground cursor-not-allowed transition-colors" title="Categories filter not enabled in schema">Travel</span>
            <span className="hover:text-foreground cursor-not-allowed transition-colors" title="Categories filter not enabled in schema">Nature</span>
            <span className="hover:text-foreground cursor-not-allowed transition-colors" title="Categories filter not enabled in schema">Architecture</span>
          </div>
        </header>

        {photos.length === 0 ? (
          <div className="py-32 text-center border border-muted/20 rounded-sm">
            <p className="font-sans text-muted-foreground tracking-wide uppercase text-sm">No photographs found in the archive.</p>
          </div>
        ) : (
          <PhotoGallery photos={photos} />
        )}
      </div>
    </main>
  );
}
