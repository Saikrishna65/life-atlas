"use client";

import { useEffect, useCallback } from "react";
import { Photo, Place, Trip } from "@prisma/client";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type PhotoWithRelations = Photo & {
  trip?: Pick<Trip, "title" | "slug"> | null;
  place?: Pick<Place, "name" | "slug" | "country"> | null;
};

interface PhotoViewerProps {
  photos: PhotoWithRelations[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function PhotoViewer({ photos, currentIndex, isOpen, onClose, onNavigate }: PhotoViewerProps) {
  const photo = photos[currentIndex];

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, photos.length, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handlePrevious, handleNext]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen || !photo) return null;

  const dateStr = photo.date ? new Date(photo.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null;
  const locationText = photo.place ? `${photo.place.name}, ${photo.place.country}` : null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Photo Viewer"
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 text-foreground/50 hover:text-foreground transition-colors z-[110]"
        aria-label="Close viewer"
      >
        <X size={32} strokeWidth={1.5} />
      </button>

      {currentIndex > 0 && (
        <button 
          onClick={handlePrevious}
          className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-4 text-foreground/30 hover:text-foreground transition-colors z-[110] hidden md:block"
          aria-label="Previous photo"
        >
          <ChevronLeft size={48} strokeWidth={1} />
        </button>
      )}

      {currentIndex < photos.length - 1 && (
        <button 
          onClick={handleNext}
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-4 text-foreground/30 hover:text-foreground transition-colors z-[110] hidden md:block"
          aria-label="Next photo"
        >
          <ChevronRight size={48} strokeWidth={1} />
        </button>
      )}

      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-12 md:pb-24">
        <div className="relative max-w-[90vw] max-h-[75vh] flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={photo.url} 
            alt={photo.caption || "Photograph"} 
            className="max-w-full max-h-[75vh] object-contain shadow-2xl select-none"
            draggable={false}
          />
        </div>
        
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          {photo.caption && (
            <p className="font-body text-foreground/90 text-lg md:text-xl font-light">{photo.caption}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
            {dateStr && <span>{dateStr}</span>}
            {locationText && (
              <>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>{locationText}</span>
              </>
            )}
            {photo.trip && (
              <>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <Link href={`/trips/${photo.trip.slug}`} onClick={onClose} className="hover:text-foreground transition-colors">
                  {photo.trip.title}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
