"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Plus,
  Star,
  ImagePlus,
  Share2,
  MapPin,
  Trash2,
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
  Navigation,
} from "lucide-react";
import { useMemories } from "@/lib/vault/useMemories";
import type { TripMemoryRecord } from "@/lib/vault/types";
import { TripSheet, EmptyTripState } from "@/components/trip-vault/shared";

const tripDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

export default function Memories() {
  const id = String(useParams().tripId);
  const {
    trip,
    memories,
    isLoading,
    error,
    addMemory,
    removeMemory,
    toggleHighlight,
    exportToPublicJournal,
    tripPlaces,
    addTripPlace,
  } = useMemories(id);

  // Filter state: 'All moments' | 'Highlights' | 'place:<PlaceName>'
  const [filter, setFilter] = useState<string>("All moments");
  const [adding, setAdding] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [selectedPlace, setSelectedPlace] = useState("");
  const [customPlace, setCustomPlace] = useState("");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isHighlight, setIsHighlight] = useState(false);

  // Viewing state
  const [viewing, setViewing] = useState<TripMemoryRecord | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);

  // Operation state
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setProblem("");
    try {
      await fn();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not save this memory.");
    } finally {
      setBusy(false);
    }
  }

  // Handle multi-image selection
  const handleImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProblem("");

    const newFiles = Array.from(files);
    // Limit to 12 images per memory to keep performance snappy
    if (images.length + newFiles.length > 12) {
      setProblem("You can select up to 12 photos per memory.");
      return;
    }

    const readers: Promise<string>[] = [];
    for (const file of newFiles) {
      if (file.size > 8 * 1024 * 1024) {
        setProblem(`Photo ${file.name} is larger than 8 MB. Please choose smaller photos.`);
        return;
      }
      readers.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        })
      );
    }

    Promise.all(readers).then((newUrls) => {
      setImages((prev) => [...prev, ...newUrls]);
    });
  };

  const removeSelectedImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const openAddModal = () => {
    setTitle("");
    setDate(new Date().toLocaleDateString("en-CA"));
    setSelectedPlace(trip?.destination || (tripPlaces[0]?.name ?? ""));
    setCustomPlace("");
    setCaption("");
    setImages([]);
    setIsHighlight(false);
    setProblem("");
    setAdding(true);
  };

  // Derive unique places that have memories
  const placesWithMemories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of memories) {
      const p = (m.placeName || m.location)?.trim();
      if (p) {
        counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [memories]);

  // Filtered memories
  const shown = useMemo(() => {
    if (filter === "All moments") return memories;
    if (filter === "Highlights") return memories.filter((m) => m.isHighlight);
    if (filter.startsWith("place:")) {
      const targetPlace = filter.slice(6).toLowerCase();
      return memories.filter(
        (m) => (m.placeName || m.location)?.trim().toLowerCase() === targetPlace
      );
    }
    return memories;
  }, [memories, filter]);

  if (isLoading) return <p role="status">Opening your memories…</p>;
  if (!trip) return <EmptyTripState title="Trip not found">Choose a saved journey.</EmptyTripState>;

  return (
    <section className="tv-memories">
      <div className="tv-page-title">
        <div>
          <p className="tv-eyebrow">BRING A LITTLE OF IT HOME</p>
          <h1>The moments you keep.</h1>
        </div>
        <button
          className="tv-round tv-cyan"
          aria-label="Add a memory"
          onClick={openAddModal}
        >
          <Plus size={21} />
        </button>
      </div>
      <p className="tv-subtitle">
        Photos, stories, and the specific places you never want to forget.
      </p>

      {/* Filter Chips: All, Highlights, and Place-specific chips */}
      <div className="tv-section-heading">
        <div className="tv-chips">
          {["All moments", "Highlights"].map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
          {placesWithMemories.map(({ name, count }) => {
            const key = `place:${name}`;
            return (
              <button
                key={key}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                📍 {name} ({count})
              </button>
            );
          })}
        </div>

        <button
          disabled={!memories.length || !trip.startDate || busy}
          onClick={() => {
            setSelected([]);
            setConsent(false);
            setResult("");
            setPublishing(true);
          }}
        >
          <Share2 size={16} /> Share to journal
        </button>
      </div>

      {(problem || error) && (
        <p className="tv-error" role="alert">
          {problem || error}
        </p>
      )}

      {/* Empty State */}
      {!shown.length ? (
        <EmptyTripState
          title={
            memories.length
              ? "No moments match this place filter."
              : "Every trip has a story."
          }
        >
          {memories.length
            ? "Switch back to 'All moments' or add a new photo for this place."
            : "Capture multiple photos, tag the specific place, and keep your adventure alive."}
        </EmptyTripState>
      ) : (
        /* Memory Grid */
        <div className="tv-memory-grid">
          {shown.map((memory) => {
            const memoryImages = memory.images?.length
              ? memory.images
              : memory.imageDataUrl
              ? [memory.imageDataUrl]
              : [];
            const primaryThumb = memoryImages[0] || memory.imageDataUrl;
            const placeTag = memory.placeName || memory.location;

            return (
              <article className="tv-memory-card" key={memory.id}>
                <button
                  className="tv-memory-photo"
                  aria-label={`Open memory ${memory.title}`}
                  onClick={() => {
                    setViewing(memory);
                    setCarouselIdx(0);
                  }}
                >
                  {/* Multi-Photo Count Badge */}
                  {memoryImages.length > 1 && (
                    <span className="tv-memory-photos-badge">
                      <Camera size={11} /> {memoryImages.length}
                    </span>
                  )}

                  {primaryThumb ? (
                    <img src={primaryThumb} alt={memory.title} loading="lazy" />
                  ) : (
                    <div>
                      <ImagePlus size={26} />
                      <p>{memory.caption || "A moment worth keeping."}</p>
                    </div>
                  )}
                  <span>{tripDate(memory.date)}</span>
                </button>

                <button
                  className="tv-memory-star"
                  aria-label={`${
                    memory.isHighlight ? "Remove highlight" : "Highlight"
                  } ${memory.title}`}
                  aria-pressed={memory.isHighlight}
                  disabled={busy}
                  onClick={() => void run(() => toggleHighlight(memory.id))}
                >
                  <Star
                    size={16}
                    fill={memory.isHighlight ? "currentColor" : "none"}
                  />
                </button>

                <h3>{memory.title}</h3>

                {placeTag && (
                  <p className="tv-memory-place-tag">
                    <MapPin size={11} />
                    {placeTag}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Keep a Memory Modal Sheet */}
      {adding && (
        <TripSheet
          title="Keep a memory"
          onClose={() => {
            if (!busy) setAdding(false);
          }}
        >
          <form
            className="tv-form"
            onSubmit={(e) => {
              e.preventDefault();
              const effectivePlace = (customPlace.trim() || selectedPlace.trim());

              void run(async () => {
                // If user typed a custom place, ensure it is added to the trip waypoints
                let placeId: string | undefined = undefined;
                if (customPlace.trim()) {
                  const wp = await addTripPlace(customPlace.trim(), "VIEWPOINT");
                  placeId = wp.id;
                } else if (selectedPlace) {
                  const match = tripPlaces.find(
                    (p) => p.name.toLowerCase() === selectedPlace.toLowerCase()
                  );
                  placeId = match?.id;
                }

                await addMemory({
                  title: title.trim(),
                  date: new Date(date + "T12:00:00").toISOString(),
                  location: effectivePlace,
                  placeId,
                  placeName: effectivePlace,
                  caption: caption.trim(),
                  imageDataUrl: images[0] || undefined,
                  images: images.length > 0 ? images : undefined,
                  isHighlight,
                });
                setAdding(false);
              });
            }}
          >
            <label>
              A name for this moment
              <input
                required
                maxLength={150}
                placeholder="e.g. Sangam Ghat Morning, Summit Push, Bonfire"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            {/* Multiple Photos Selector */}
            <label>
              Photos <small>(Select one or multiple photos)</small>
              <input
                type="file"
                multiple
                accept="image/*"
                aria-label="Select memory photos"
                onChange={(e) => handleImageSelect(e.target.files)}
              />
            </label>

            {/* Uploaded Photos Preview Strip */}
            {images.length > 0 && (
              <div>
                <p className="tv-fine" style={{ marginBottom: 6 }}>
                  📸 <strong>{images.length} {images.length === 1 ? "photo" : "photos"} selected</strong> · First photo will be the cover
                </p>
                <div className="tv-memory-multi-preview">
                  {images.map((imgSrc, idx) => (
                    <div className="tv-preview-thumb" key={idx}>
                      <img src={imgSrc} alt={`Selected photo ${idx + 1}`} />
                      <button
                        type="button"
                        className="tv-preview-thumb-remove"
                        aria-label={`Remove photo ${idx + 1}`}
                        onClick={() => removeSelectedImage(idx)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Place Selection & Custom Place Tagging */}
            <div>
              <label>Specific place for this moment</label>
              {tripPlaces.length > 0 && (
                <div className="tv-place-chips-select">
                  {tripPlaces.map((p) => {
                    const isSelected = selectedPlace.toLowerCase() === p.name.toLowerCase() && !customPlace;
                    return (
                      <button
                        type="button"
                        key={p.name}
                        className={`tv-place-chip ${isSelected ? "active" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedPlace(p.name);
                          setCustomPlace("");
                        }}
                      >
                        <MapPin size={11} /> {p.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Or Add / Type a Custom Place */}
              <div style={{ marginTop: 6 }}>
                <input
                  placeholder="Or type another place (e.g. Devprayag, Ukhimath)..."
                  value={customPlace}
                  onChange={(e) => {
                    setCustomPlace(e.target.value);
                    if (e.target.value) setSelectedPlace("");
                  }}
                />
              </div>
            </div>

            <div className="tv-form-grid">
              <label>
                Date
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>

            <label>
              A few words <small>optional</small>
              <textarea
                rows={3}
                placeholder="What made this moment unforgettable?"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>

            <label className="tv-inline-checkbox">
              <input
                type="checkbox"
                checked={isHighlight}
                onChange={(e) => setIsHighlight(e.target.checked)}
              />
              Make this a highlight moment
            </label>

            {problem && (
              <p role="alert" className="tv-error">
                {problem}
              </p>
            )}

            <button disabled={busy} className="tv-primary">
              {busy ? "Saving memory…" : "Save memory"}
            </button>
          </form>
        </TripSheet>
      )}

      {/* Viewing Modal Sheet (With Multi-Photo Carousel) */}
      {viewing && (
        <TripSheet
          title={viewing.title}
          onClose={() => {
            setViewing(null);
            setCarouselIdx(0);
          }}
        >
          {(() => {
            const memoryImages = viewing.images?.length
              ? viewing.images
              : viewing.imageDataUrl
              ? [viewing.imageDataUrl]
              : [];
            const hasMultiple = memoryImages.length > 1;
            const currentImg = memoryImages[carouselIdx] || memoryImages[0];
            const placeTag = viewing.placeName || viewing.location;

            return (
              <>
                {/* Image Carousel or Single Image */}
                {memoryImages.length > 0 && (
                  <div>
                    <div className="tv-memory-carousel">
                      <img
                        className="tv-carousel-main"
                        src={currentImg}
                        alt={`${viewing.title} photo ${carouselIdx + 1}`}
                      />

                      {hasMultiple && (
                        <>
                          <button
                            type="button"
                            className="tv-carousel-nav prev"
                            aria-label="Previous photo"
                            onClick={() =>
                              setCarouselIdx((i) =>
                                i > 0 ? i - 1 : memoryImages.length - 1
                              )
                            }
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <button
                            type="button"
                            className="tv-carousel-nav next"
                            aria-label="Next photo"
                            onClick={() =>
                              setCarouselIdx((i) =>
                                i < memoryImages.length - 1 ? i + 1 : 0
                              )
                            }
                          >
                            <ChevronRight size={20} />
                          </button>
                          <span className="tv-carousel-counter">
                            {carouselIdx + 1} / {memoryImages.length}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Thumbnail navigation strip for multi-photo memories */}
                    {hasMultiple && (
                      <div className="tv-carousel-thumbs">
                        {memoryImages.map((src, idx) => (
                          <button
                            type="button"
                            key={idx}
                            className="tv-carousel-thumb-btn"
                            aria-current={carouselIdx === idx ? "true" : undefined}
                            onClick={() => setCarouselIdx(idx)}
                          >
                            <img src={src} alt={`Thumbnail ${idx + 1}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Details */}
                <div style={{ marginTop: 10 }}>
                  <p className="tv-fine" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{tripDate(viewing.date)}</span>
                    {placeTag && (
                      <>
                        <span>·</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--tv-cyan, #06b6d4)", fontWeight: 600 }}>
                          <MapPin size={13} /> {placeTag}
                        </span>
                      </>
                    )}
                  </p>

                  {viewing.caption && (
                    <p style={{ marginTop: 8, lineHeight: 1.5 }}>{viewing.caption}</p>
                  )}

                  {viewing.rating && (
                    <p className="tv-fine" style={{ marginTop: 6 }}>
                      Your rating: {viewing.rating}/5
                    </p>
                  )}
                </div>

                <div style={{ marginTop: 20 }}>
                  <button
                    disabled={busy}
                    className="tv-text-danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete this saved memory and its photos from this trip?"
                        )
                      )
                        void run(async () => {
                          await removeMemory(viewing.id);
                          setViewing(null);
                        });
                    }}
                  >
                    <Trash2 size={15} /> Delete memory
                  </button>
                </div>
              </>
            );
          })()}
        </TripSheet>
      )}

      {/* Public Journal Publishing Modal Sheet */}
      {publishing && (
        <TripSheet
          title="Share to your public journal"
          onClose={() => {
            if (!busy) setPublishing(false);
          }}
        >
          <p className="tv-fine">
            Choose the memories to publish. This will publish the trip title,
            destination, dates, trip notes, and itinerary. Other vault sections
            remain private.
          </p>

          {memories.map((memory) => (
            <label className="tv-publish-choice" key={memory.id}>
              <input
                type="checkbox"
                checked={selected.includes(memory.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, memory.id]
                      : selected.filter((mid) => mid !== memory.id)
                  )
                }
              />
              <span>
                <strong>{memory.title}</strong>
                {(memory.placeName || memory.location) && (
                  <small style={{ display: "block", color: "var(--tv-sub)" }}>
                    📍 {memory.placeName || memory.location}
                  </small>
                )}
              </span>
            </label>
          ))}

          <label className="tv-publish-choice">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I want these selected memories and trip details to be public.
          </label>

          <button
            className="tv-primary"
            disabled={busy || !selected.length || !consent || !!result}
            onClick={() =>
              void run(async () => {
                const saved = await exportToPublicJournal(selected);
                setResult(saved.publicUrl || "Published to your public journal.");
              })
            }
          >
            Publish selected memories
          </button>

          {result && (
            <p className="tv-fine" role="status">
              {result}
            </p>
          )}

          {problem && (
            <p className="tv-error" role="alert">
              {problem}
            </p>
          )}
        </TripSheet>
      )}
    </section>
  );
}
