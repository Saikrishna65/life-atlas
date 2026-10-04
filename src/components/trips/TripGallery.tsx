import { Photo } from "@prisma/client";

export default function TripGallery({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto border-t border-muted">
      <h2 className="font-display text-3xl mb-16 tracking-wide text-foreground text-center">THE ARCHIVE</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative aspect-square overflow-hidden bg-surface">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
              style={{ backgroundImage: `url(${photo.url})` }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end h-full bg-gradient-to-t from-black/80 to-transparent">
                <p className="font-sans text-xs tracking-wide text-white line-clamp-3">{photo.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
