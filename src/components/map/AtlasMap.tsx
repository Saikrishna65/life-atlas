"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Place, TripPlace, Trip } from "@prisma/client";
import Link from "next/link";

type MapPlace = Place & {
  tripPlaces: (TripPlace & { trip: Trip })[];
};

// High-visibility glowing orb marker
function createMarkerIcon(isActive: boolean) {
  return L.divIcon({
    className: "atlas-glow-marker",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div class="glow-marker ${isActive ? 'active' : ''}">
        <div class="glow-core"></div>
        <div class="glow-ring"></div>
      </div>
    `,
  });
}



export default function AtlasMap({ places }: { places: MapPlace[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPlace = places.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="w-full h-full relative bg-black">
      {/* Map Layers */}
      <MapContainer
        center={[22.0, 79.0]}
        zoom={4.5}
        minZoom={3}
        maxZoom={17}
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#050505", zIndex: 1 }}
        attributionControl={false}
      >
        {/* OSM tiles with CSS invert filter for dark aesthetic — no API key needed */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="dark-tiles"
        />

        {places.map((place) => {
          if (place.latitude == null || place.longitude == null) return null;
          const active = selectedId === place.id;
          return (
            <Marker
              key={place.id}
              position={[place.latitude, place.longitude]}
              icon={createMarkerIcon(active)}
              eventHandlers={{
                click: () => setSelectedId(active ? null : place.id),
              }}
            >
              <Popup
                className="atlas-popup"
                closeButton={false}
                offset={[0, -6]}
              >
                <div className="bg-[#0a0a0a] border border-white/20 p-4 min-w-[200px] flex flex-col gap-3 shadow-2xl">
                  <div className="flex flex-col">
                    <span className="font-sans text-[10px] uppercase tracking-widest text-white/50">
                      {place.country}
                    </span>
                    <h3 className="font-display text-xl text-white">{place.name}</h3>
                  </div>

                  {place.coverImage && (
                    <div
                      className="w-full h-24 bg-cover bg-center rounded-sm"
                      style={{ backgroundImage: `url(${place.coverImage})` }}
                    />
                  )}

                  <div className="flex flex-col gap-2 mt-2">
                    <Link
                      href={`/places/${place.slug}`}
                      className="font-sans text-xs uppercase tracking-widest text-white/70 hover:text-white transition-colors"
                    >
                      View place &rarr;
                    </Link>
                    {place.tripPlaces?.[0]?.trip && (
                      <Link
                        href={`/trips/${place.tripPlaces[0].trip.slug}`}
                        className="font-sans text-xs uppercase tracking-widest text-accent hover:text-white transition-colors"
                      >
                        {place.tripPlaces[0].trip.title} &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}


      </MapContainer>

      {/* Cinematic Overlays */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] opacity-80" />
      <div className="absolute inset-0 z-10 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)' }} />

      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip-container {
          display: none !important;
        }
        .dark-tiles {
          filter: invert(100%) hue-rotate(180deg) brightness(80%) contrast(120%) sepia(20%) grayscale(40%);
        }
        
        /* High Visibility Glow Markers */
        .atlas-glow-marker {
          background: transparent;
          border: none;
        }
        .glow-marker {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .glow-core {
          width: 12px;
          height: 12px;
          background: #f5f5f0; /* Warm off-white / bone */
          border-radius: 50%;
          box-shadow: 0 0 20px 8px rgba(245, 245, 240, 0.5);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2;
        }
        
        .glow-ring {
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245, 245, 240, 0.4) 0%, rgba(245, 245, 240, 0) 70%);
          animation: glow-pulse 2s infinite ease-in-out;
          transition: all 0.4s ease;
        }

        /* Hover & Active States */
        .glow-marker:hover .glow-core, 
        .glow-marker.active .glow-core {
          background: #ffffff;
          transform: scale(1.5);
          box-shadow: 0 0 30px 12px rgba(255, 255, 255, 0.8);
        }

        .glow-marker:hover .glow-ring,
        .glow-marker.active .glow-ring {
          width: 50px;
          height: 50px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 70%);
          animation-duration: 1s;
        }

        @keyframes glow-pulse {
          0% { transform: scale(0.7); opacity: 0.6; }
          50% { transform: scale(1.4); opacity: 1; }
          100% { transform: scale(0.7); opacity: 0.6; }
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-control-zoom a {
          background: rgba(10, 10, 10, 0.8) !important;
          color: rgba(255, 255, 255, 0.7) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-zoom a:hover {
          background: rgba(10, 10, 10, 0.95) !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}
