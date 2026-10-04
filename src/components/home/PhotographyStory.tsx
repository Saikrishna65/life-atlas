import Link from "next/link";
import Image from "next/image";
import { Photo } from "@prisma/client";

export default function PhotographyStory({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto border-t border-muted">
      <div className="flex justify-between items-end mb-16">
        <h2 className="font-display text-3xl tracking-wide text-foreground">THE VISUAL DIARY</h2>
        <Link href="/photography" className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors">
          View all photographs &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {photos.map((photo, i) => {
          const rowSpan = i === 0 || i === 3 ? "md:col-span-2 aspect-[4/3]" : "md:col-span-1 aspect-square";
          
          return (
            <div key={photo.id} className={`group relative overflow-hidden bg-surface ${rowSpan}`}>
              <Image
                src={photo.url}
                alt={photo.caption || "Photograph"}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
                sizes={i === 0 || i === 3 ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end h-full bg-gradient-to-t from-black/80 to-transparent">
                  <p className="font-sans text-sm tracking-wide text-white">{photo.caption}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
