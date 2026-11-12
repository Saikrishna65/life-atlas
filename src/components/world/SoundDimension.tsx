"use client";
import { KineticHeading } from "./EditorialElements";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Pause,
  Sparkles,
} from "lucide-react";
import {
  playlists,
  tracks,
  artists,
  albums,
  musicStats,
} from "@/data/demo/music";
import { formatDuration, searchRecords } from "@/data/demo/selectors";
import {
  AlbumArt,
  ChapterLabel,
  DemoNote,
  Empty,
  Modal,
  SearchField,
} from "./primitives";
export default function SoundDimension() {
  const [mood, setMood] = useState("All frequencies");
  const [query, setQuery] = useState("");
  const root = useRef<HTMLElement>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [visual, setVisual] = useState(false);
  const [catalogTab, setCatalogTab] = useState("Playlists");
  const filtered = useMemo(
    () =>
      searchRecords(
        playlists,
        query,
        (p) =>
          `${p.title} ${p.description} ${p.genres.join(" ")} ${p.trackIds
            .map((id) => {
              const t = tracks.find((t) => t.id === id)!;
              return `${t.title} ${artists.find((a) => a.id === t.artistId)?.name}`;
            })
            .join(" ")}`,
      ).filter((p) => mood === "All frequencies" || p.mood === mood),
    [query, mood],
  );
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setVisual(false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const currentAlbum = albums.find((a) => a.id === selectedAlbum);
  const current = playlists.find((p) => p.id === selected);
  const focus = filtered[Math.min(index, Math.max(0, filtered.length - 1))];
  const nextCover =
    filtered[
      (Math.min(index, Math.max(0, filtered.length - 1)) + 1) % filtered.length
    ];
  const followingCover =
    filtered[
      (Math.min(index, Math.max(0, filtered.length - 1)) + 2) % filtered.length
    ];
  const catalog =
    catalogTab === "Artists"
      ? searchRecords(artists, query, (a) => `${a.name} ${a.genre}`)
      : catalogTab === "Tracks"
        ? searchRecords(
            tracks,
            query,
            (t) =>
              `${t.title} ${t.genre} ${artists.find((a) => a.id === t.artistId)?.name} ${albums.find((a) => a.id === t.albumId)?.title}`,
          ).filter((t) => mood === "All frequencies" || t.mood === mood)
        : searchRecords(
            albums,
            query,
            (a) =>
              `${a.title} ${artists.find((x) => x.id === a.artistId)?.name}`,
          );
  return (
    <section ref={root} id="sound" className="world-sound world-scene">
      <div className="world-section-bar">
        <ChapterLabel number="05">The Sound Dimension</ChapterLabel>
        <span className="world-eyebrow">
          <AudioLines size={14} /> Feel something different
        </span>
      </div>
      <header className="world-editorial-header" data-world-reveal>
        <div>
          <p className="world-eyebrow">A soundtrack for the in-between.</p>
          <KineticHeading
            lines={["Life has a", <em key="frequency">frequency.</em>]}
          />
        </div>
        <div>
          <p>
            For the road ahead.
            <br />
            For the world inside your head.
          </p>
          <DemoNote>Fictional music catalog / No audio playback.</DemoNote>
        </div>
      </header>
      <div className="sound-toolbar">
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v);
            setIndex(0);
          }}
          label="Search music collections"
          placeholder="Find a mood, a name, a frequency"
        />
        {(catalogTab === "Playlists" || catalogTab === "Tracks") && (
          <label>
            <span className="sr-only">Filter listening mood</span>
            <select
              value={mood}
              onChange={(e) => {
                setMood(e.target.value);
                setIndex(0);
              }}
            >
              {[
                "All frequencies",
                "Reflective",
                "Wandering",
                "Focused",
                "After dark",
                "Uplifting",
              ].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        )}
        <div className="world-filter-pills">
          {["Playlists", "Albums", "Artists", "Tracks"].map((t) => (
            <button
              aria-pressed={catalogTab === t}
              key={t}
              onClick={() => setCatalogTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {catalogTab === "Playlists" && focus ? (
        <div className={`sound-stage ${visual ? "is-previewing" : ""}`}>
          <div className="sound-orbits" aria-hidden="true" />
          <div className="sound-art-stack">
            <button
              className="sound-art-ghost back"
              disabled={filtered.length < 2}
              onClick={() => {
                setIndex(
                  (Math.min(index, filtered.length - 1) + 2) % filtered.length,
                );
                setVisual(false);
              }}
              aria-label={`Preview ${followingCover.title}`}
            >
              <AlbumArt
                variant={followingCover.artwork}
                color={followingCover.color}
                label={followingCover.title}
              />
            </button>
            <button
              className="sound-art-ghost middle"
              disabled={filtered.length < 2}
              onClick={() => {
                setIndex(
                  (Math.min(index, filtered.length - 1) + 1) % filtered.length,
                );
                setVisual(false);
              }}
              aria-label={`Preview ${nextCover.title}`}
            >
              <AlbumArt
                variant={nextCover.artwork}
                color={nextCover.color}
                label={nextCover.title}
              />
            </button>
            <button
              className="sound-art-main"
              data-world-tilt
              onClick={() => setSelected(focus.id)}
              aria-label={`Open ${focus.title}`}
            >
              <div className="sound-tilt-plane" data-tilt-plane>
                <AlbumArt
                  variant={focus.artwork}
                  color={focus.color}
                  label={focus.title}
                />
              </div>
              <span>
                <ArrowUpRight size={23} />
              </span>
            </button>
            <div className="sound-record" aria-hidden="true">
              <i />
            </div>
          </div>
          <div className="sound-stage-notes">
            <span className="world-eyebrow">
              CURATED CONCEPT /{" "}
              {String(playlists.indexOf(focus) + 1).padStart(2, "0")}
            </span>
            <h3>{focus.title}</h3>
            <p>{focus.description}</p>
            <span className="sound-meta">
              {focus.trackIds.length} tracks · {Math.round(focus.duration / 60)}{" "}
              min · {focus.mood}
            </span>
            <div className="sound-buttons">
              <button
                className="world-button light"
                onClick={() => setSelected(focus.id)}
              >
                Explore collection <ArrowUpRight size={16} />
              </button>
              <button
                className="world-link"
                onClick={() => setVisual(!visual)}
                aria-pressed={visual}
              >
                {visual ? <Pause size={15} /> : <Sparkles size={15} />}{" "}
                {visual ? "Pause visuals" : "Visual preview"}
              </button>
            </div>
            <div className="sound-wave" aria-hidden="true">
              {Array.from({ length: 48 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    height: `${8 + ((tracks.find((t) => t.id === focus.trackIds[i % focus.trackIds.length])!.duration + i * 7) % 37)}px`,
                    animationDelay: `${i * 0.04}s`,
                  }}
                />
              ))}
            </div>
            <span className="visual-disclaimer">
              Visual preview only. No sound is playing.
            </span>
          </div>
        </div>
      ) : catalogTab === "Playlists" ? (
        <Empty
          onReset={() => {
            setQuery("");
            setMood("All frequencies");
          }}
        >
          This frequency is quiet. Try another mood.
        </Empty>
      ) : (
        <div className="sound-catalog" data-lenis-prevent>
          {catalog.map((item) =>
            "name" in item ? (
              <div className="artist-row" key={item.id}>
                <span>
                  {String(artists.indexOf(item) + 1).padStart(2, "0")}
                </span>
                <h3>{item.name}</h3>
                <span>{item.genre}</span>
                <small>{item.origin}</small>
              </div>
            ) : "albumId" in item ? (
              <button
                key={item.id}
                className="track-row"
                onClick={() => setSelectedAlbum(item.albumId)}
              >
                <span>{String(tracks.indexOf(item) + 1).padStart(3, "0")}</span>
                <div>
                  <h3>{item.title}</h3>
                  <small>
                    {artists.find((a) => a.id === item.artistId)?.name} ·{" "}
                    {albums.find((a) => a.id === item.albumId)?.title}
                  </small>
                </div>
                <span>{item.genre}</span>
                <time>{formatDuration(item.duration)}</time>
              </button>
            ) : (
              <button
                key={item.id}
                className="album-catalog-item"
                onClick={() => setSelectedAlbum(item.id)}
              >
                <AlbumArt
                  variant={item.artwork}
                  color={item.color}
                  label={item.title}
                />
                <h3>{item.title}</h3>
                <p>
                  {artists.find((a) => a.id === item.artistId)?.name} /{" "}
                  {item.year}
                </p>
                <span>Explore album notes ↗</span>
              </button>
            ),
          )}
          {!catalog.length && (
            <Empty
              onReset={() => {
                setQuery("");
                setMood("All frequencies");
              }}
            >
              No matches in the sample catalog.
            </Empty>
          )}
        </div>
      )}
      <footer className="world-pagination">
        <span>
          {musicStats.playlists} collections / {musicStats.albums} albums /{" "}
          {musicStats.artists} artists / {musicStats.tracks} tracks
        </span>
        {catalogTab === "Playlists" && (
          <div>
            <span aria-live="polite">
              {filtered.length ? Math.min(index + 1, filtered.length) : 0} /{" "}
              {filtered.length}
            </span>
            <button
              className="world-icon"
              disabled={index === 0}
              aria-label="Previous playlist"
              onClick={() => {
                setIndex((n) => n - 1);
                setVisual(false);
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              className="world-icon"
              disabled={index >= filtered.length - 1}
              aria-label="Next playlist"
              onClick={() => {
                setIndex((n) => n + 1);
                setVisual(false);
              }}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </footer>
      {current && (
        <Modal
          title={current.title}
          className="playlist-modal"
          onClose={() => setSelected(null)}
        >
          <div className="playlist-heading">
            <AlbumArt
              variant={current.artwork}
              color={current.color}
              label={current.title}
            />
            <div>
              <span className="world-eyebrow">
                Fictional listening collection
              </span>
              <h2>{current.title}</h2>
              <p>{current.description}</p>
              <span>
                {current.trackIds.length} tracks ·{" "}
                {Math.round(current.duration / 60)} minutes
              </span>
            </div>
          </div>
          <DemoNote>
            Catalog concept. Track durations are illustrative. No playable
            audio.
          </DemoNote>
          <div className="playlist-tracks">
            {current.trackIds.map((id, i) => {
              const t = tracks.find((t) => t.id === id)!;
              return (
                <div key={id}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {artists.find((a) => a.id === t.artistId)?.name} ·{" "}
                      {albums.find((a) => a.id === t.albumId)?.title}
                    </small>
                  </div>
                  <span>{t.genre}</span>
                  <time>{formatDuration(t.duration)}</time>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
      {currentAlbum && (
        <Modal
          title={currentAlbum.title}
          className="playlist-modal"
          onClose={() => setSelectedAlbum(null)}
        >
          <div className="playlist-heading">
            <AlbumArt
              variant={currentAlbum.artwork}
              color={currentAlbum.color}
              label={currentAlbum.title}
            />
            <div>
              <span className="world-eyebrow">
                Fictional album / {currentAlbum.year}
              </span>
              <h2>{currentAlbum.title}</h2>
              <p>{artists.find((a) => a.id === currentAlbum.artistId)?.name}</p>
              <span>
                {tracks.filter((t) => t.albumId === currentAlbum.id).length}{" "}
                tracks · Catalog concept
              </span>
            </div>
          </div>
          <DemoNote>
            Original fictional catalog. No audio recordings or playback.
          </DemoNote>
          <div className="playlist-tracks">
            {tracks
              .filter((t) => t.albumId === currentAlbum.id)
              .map((t, i) => (
                <div key={t.id}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{t.title}</strong>
                    <small>{t.mood}</small>
                  </div>
                  <span>{t.genre}</span>
                  <time>{formatDuration(t.duration)}</time>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </section>
  );
}
