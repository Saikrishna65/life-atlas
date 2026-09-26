"use client";

import dynamic from "next/dynamic";
import { Place, TripPlace, Trip } from "@prisma/client";
import { useState, useMemo } from "react";

// Leaflet requires window/document, so we must disable SSR
const AtlasMap = dynamic(() => import("./AtlasMap"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <span className="font-sans text-xs uppercase tracking-widest text-white/40 animate-pulse">Loading Atlas...</span>
    </div>
  )
});

type MapPlace = Place & {
  tripPlaces: (TripPlace & { trip: Trip })[];
};

export default function MapWrapper({ places }: { places: MapPlace[] }) {
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredPlaces = useMemo(() => {
    if (activeFilter === "All") return places;
    if (activeFilter === "Trips") return places.filter(p => p.tripPlaces && p.tripPlaces.length > 0);
    if (activeFilter === "Places") return places.filter(p => !p.tripPlaces || p.tripPlaces.length === 0);
    if (activeFilter === "Food") return []; // Placeholder logic until food relations are mapped
    if (activeFilter === "Events") return []; // Placeholder logic
    if (activeFilter === "Photography") return []; // Placeholder logic
    return places;
  }, [places, activeFilter]);

  return (
    <>
      <AtlasMap places={filteredPlaces} />
      
      {/* Map Filters Overlay */}
      <div className="absolute top-24 left-6 right-6 md:right-auto md:w-64 pointer-events-none z-[1000] flex flex-col gap-4">
        <div className="bg-background/80 backdrop-blur-md border border-white/10 rounded-sm p-4 pointer-events-auto">
          <h3 className="font-sans text-xs uppercase tracking-widest text-white/50 mb-3">Filters</h3>
          <div className="flex flex-wrap md:flex-col gap-2">
            {['All', 'Trips', 'Places', 'Food', 'Events', 'Photography'].map((filter) => (
              <button 
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`text-left font-sans text-sm tracking-wide px-3 py-1.5 rounded-sm transition-colors ${
                  activeFilter === filter 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile-only overlay for info */}
      <div className="md:hidden absolute bottom-6 left-6 right-6 pointer-events-none flex justify-center z-[1000]">
        <div className="bg-background/90 backdrop-blur-md px-6 py-3 border border-white/10 rounded-full shadow-2xl pointer-events-auto">
          <span className="font-sans text-xs uppercase tracking-widest text-white/80">
            {filteredPlaces.length} Location{filteredPlaces.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </>
  );
}
