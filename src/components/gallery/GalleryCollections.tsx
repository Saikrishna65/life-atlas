"use client";
import { ArrowUpRight, MapPin, Mountain } from "lucide-react";
import Link from "next/link";
import AlbumCover from "./AlbumCover";

import type { DeviceMedia } from "@/lib/gallery/types";
import type { TripRecord } from "@/lib/vault/types";
export default function GalleryCollections({
  albums,
  items,
  trips,
  onAlbum,
  onTrip,
  onPlaces,
}: {
  albums: { name: string; count?: number }[];
  items: DeviceMedia[];
  trips: TripRecord[];
  onAlbum: (name: string) => void;
  onTrip: (id: string) => void;
  onPlaces: () => void;
}) {
  return (
    <section className="gc-home" aria-label="Organize your library">
      <p className="gc-plain-intro">Your albums, trips and places.</p>
      <button
        className="gc-location"
        onClick={onPlaces}
        aria-label="Places organizer"
      >
        <span className="gc-location-art">
          <MapPin size={45} />
          <i />
          <i />
        </span>
        <span>
          <strong>Places</strong>
          <p>See photos grouped by where you took them.</p>
        </span>
        <ArrowUpRight />
      </button>
      <div className="gc-section-title">
        <h2>On your phone</h2>
        <span>{albums.length} albums</span>
      </div>
      <div className="gc-albums">
        {albums.map((a) => {
          const photo = items.find((m) => m.album === a.name);
          return (
            <button
              key={a.name}
              onClick={() => onAlbum(a.name)}
              aria-label={`Open album ${a.name}`}
            >
              <AlbumCover name={a.name} initial={photo} />
              <strong>{a.name}</strong>
              <small>
                {a.count ? `${a.count} photos & videos` : "Open album"}
              </small>
            </button>
          );
        })}
      </div>
      {!albums.length && (
        <p className="gc-hint">
          Your accessible albums appear here after you allow photo access.
        </p>
      )}
      <div className="gc-section-title">
        <h2>Your journeys</h2>
        <Link href="/secret/studio">Create a trip ↗</Link>
      </div>
      <div className="gc-trips">
        {trips.map((t) => (
          <button key={t.id} onClick={() => onTrip(t.id)}>
            <Mountain size={25} />
            <span>
              <strong>{t.title}</strong>
              <small>
                {t.websitePlaces?.length || 0} places · Open collection
              </small>
            </span>
            <ArrowUpRight size={20} />
          </button>
        ))}
      </div>
      {!trips.length && (
        <p className="gc-hint">
          Your trip collections will live here. Create one in Studio, then add
          photos from your library.
        </p>
      )}
    </section>
  );
}
