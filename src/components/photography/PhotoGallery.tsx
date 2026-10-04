"use client";

import { useState } from "react";
import Image from "next/image";
import { Photo, Place, Trip } from "@prisma/client";
import PhotoViewer from "./PhotoViewer";

type PhotoWithRelations = Photo & {
  trip?: Pick<Trip, "title" | "slug"> | null;
  place?: Pick<Place, "name" | "slug" | "country"> | null;
};

export default function PhotoGallery({ photos }: { photos: PhotoWithRelations[] }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openViewer = (index: number) => {
    setCurrentIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
        {photos.map((photo, index) => (
          <div 
            key={photo.id}
            className="relative group cursor-zoom-in break-inside-avoid"
            onClick={() => openViewer(index)}
          >
            <div className="bg-muted/10 relative overflow-hidden rounded-sm">
              <Image 
                src={photo.url} 
                alt={photo.caption || "Photograph"} 
                width={1200}
                height={1200}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                {photo.caption && (
                  <p className="font-body text-white text-lg font-light line-clamp-2">{photo.caption}</p>
                )}
                <span className="font-sans text-[10px] uppercase tracking-widest text-white/70 mt-2">
                  {photo.place?.name || photo.trip?.title || (photo.date ? new Date(photo.date).getFullYear() : '')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <PhotoViewer 
        photos={photos}
        currentIndex={currentIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        onNavigate={setCurrentIndex}
      />
    </>
  );
}
