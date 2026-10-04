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
    <div className="w-full h-full relative bg-surface">
      {/* Map Layers */}
      <MapContainer
        center={[22.0, 79.0]}
        zoom={4.5}
        minZoom={3}
        maxZoom={17}
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#f5f7fb", zIndex: 1 }}
        attributionControl={false}
      >
        {/* OSM tiles with a soft desaturation filter for a clean, editorial light look — no API key needed */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="light-tiles"
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
                <div className="bg-background border border-muted rounded-lg p-4 min-w-[220px] flex flex-col gap-3 shadow-lift">
                  <div className="flex flex-col">
                    <span className="font-sans text-[10px] uppercase tracking-widest text-accent-green font-semibold">
                      {place.country}
                    </span>
                    <h3 className="font-display text-xl text-foreground">{place.name}</h3>
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
                      className="font-sans text-xs uppercase tracking-widest text-foreground/80 hover:text-accent transition-colors"
                    >
                      View place &rarr;
                    </Link>
                    {place.tripPlaces?.[0]?.trip && (
                      <Link
                        href={`/trips/${place.tripPlaces[0].trip.slug}`}
                        className="font-sans text-xs uppercase tracking-widest text-accent hover:text-accent-red transition-colors"
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

      {/* Soft edge vignette to blend the map into the page */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_55%,rgba(245,247,251,0.85)_100%)]" />

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
        .light-tiles {
          filter: saturate(55%) contrast(95%) brightness(103%);
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
          background: #e5484d; /* Coral red pin */
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 0 1px rgba(229, 72, 77, 0.35), 0 4px 12px rgba(229, 72, 77, 0.45);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2;
        }
        
        .glow-ring {
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(229, 72, 77, 0.35) 0%, rgba(229, 72, 77, 0) 70%);
          animation: glow-pulse 2s infinite ease-in-out;
          transition: all 0.4s ease;
        }

        /* Hover & Active States */
        .glow-marker:hover .glow-core, 
        .glow-marker.active .glow-core {
          background: #1f4fd8; /* Cobalt when active */
          transform: scale(1.5);
          box-shadow: 0 0 0 1px rgba(31, 79, 216, 0.35), 0 6px 18px rgba(31, 79, 216, 0.5);
        }

        .glow-marker:hover .glow-ring,
        .glow-marker.active .glow-ring {
          width: 50px;
          height: 50px;
          background: radial-gradient(circle, rgba(31, 79, 216, 0.3) 0%, rgba(31, 79, 216, 0) 70%);
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
          background: rgba(255, 255, 255, 0.9) !important;
          color: #0b1220 !important;
          border: 1px solid #e4e9f1 !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-zoom a:hover {
          background: #1f4fd8 !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}
