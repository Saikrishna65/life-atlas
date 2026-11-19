"use client";
import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/world/primitives";
import TripMapPicker from "@/components/studio/TripMapPicker";
import { savePastTrip } from "@/lib/studio/store";
import { addTripPlace } from "@/lib/studio/trip-places";
import {
  prepareGalleryTrip,
  uploadGalleryTrip,
  uploadGalleryPrivate,
} from "@/lib/gallery/actions";
import type { DeviceMedia } from "@/lib/gallery/types";
import type { TripRecord, WebsiteMapLocation } from "@/lib/vault/types";
import { storageError } from "@/lib/r2/native";
export default function GalleryAssign({
  media,
  trips,
  onClose,
  onSaved,
}: {
  media: DeviceMedia[];
  trips: TripRecord[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [tripId, setTripId] = useState(trips[0]?.id || ""),
    [placeId, setPlaceId] = useState(""),
    [placeName, setPlaceName] = useState(""),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState(""),
    [location, setLocation] = useState<WebsiteMapLocation>(),
    [slot, setSlot] = useState<"public" | "private">("public"),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const trip = trips.find((t) => t.id === tripId);
  async function save(upload: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (upload && slot === "private") {
        await uploadGalleryPrivate(media);
        onSaved(
          "Encrypted private uploads queued on Android. Nothing was published to the website.",
        );
        return;
      }
      let chosen = trip;
      if (creating) {
        if (!location) throw Error("Choose this trip’s map pin.");
        chosen = await savePastTrip({
          title,
          destination: title,
          startDate: "",
          endDate: "",
          mapLocation: location,
        });
        setTripId(chosen.id);
        setCreating(false);
      }
      if (!chosen) throw Error("Choose a trip or create one.");
      let place =
        chosen.websitePlaces?.find((p) => p.id === placeId) ||
        chosen.websitePlaces?.find(
          (p) =>
            p.name.toLocaleLowerCase() ===
            placeName.trim().normalize("NFC").toLocaleLowerCase(),
        );
      if (!place) {
        if (!placeName.trim()) throw Error("Choose a place or add its name.");
        const saved = await addTripPlace(chosen.id, placeName);
        place = saved.websitePlaces?.find(
          (p) =>
            p.name.toLocaleLowerCase() ===
            placeName.trim().normalize("NFC").toLocaleLowerCase(),
        );
      }
      if (!place) throw Error("Could not save this place.");
      setPlaceId(place.id);
      if (upload) {
        await uploadGalleryTrip(media, chosen.id, place.id);
        onSaved(
          "Originals queued on Android. Open the trip in Creator Studio when you’re ready to review and publish.",
        );
      } else {
        await prepareGalleryTrip(media, chosen.id, place.id);
        onSaved(
          "Selections saved under this trip and place. No files were uploaded or published.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error && !("code" in e) ? e.message : storageError(e),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Add to my atlas"
      onClose={() => {
        if (!busy) onClose();
      }}
      className="pg-dialog"
    >
      <p className="pg-muted">
        {media.length} selected originals. Keep each journey and its places
        together.
      </p>
      <div className="pg-storage-choice">
        <button
          aria-pressed={slot === "public"}
          disabled={busy}
          onClick={() => setSlot("public")}
        >
          Trip / public storage
        </button>
        <button
          aria-pressed={slot === "private"}
          disabled={busy}
          onClick={() => setSlot("private")}
        >
          Encrypted private storage
        </button>
      </div>
      {slot === "public" ? (
        <div className="pg-form">
          <label>
            Trip
            <select
              aria-label="Trip"
              value={creating ? "new" : tripId}
              disabled={busy}
              onChange={(e) => {
                setCreating(e.target.value === "new");
                setTripId(e.target.value === "new" ? "" : e.target.value);
                setPlaceId("");
                setPlaceName("");
              }}
            >
              <option value="">Choose a journey</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
              <option value="new">+ Create a trip</option>
            </select>
          </label>
          {creating && (
            <>
              <label>
                Trip title
                <input
                  value={title}
                  maxLength={140}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <TripMapPicker value={location} onChange={setLocation} />
            </>
          )}
          <label>
            Place
            <select
              aria-label="Place"
              value={placeId}
              disabled={busy}
              onChange={(e) => setPlaceId(e.target.value)}
            >
              <option value="">+ Add a place below</option>
              {trip?.websitePlaces?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {!placeId && (
            <label>
              New place name
              <input
                placeholder="The lake, the temple, the campsite…"
                value={placeName}
                maxLength={54}
                onChange={(e) => setPlaceName(e.target.value)}
              />
            </label>
          )}
          <label className="pg-consent">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            I approve uploading these originals to public storage. Original
            filenames and EXIF/location metadata may be readable. This does not
            publish the trip’s website journal.
          </label>
          <div className="pg-action-row">
            <button disabled={busy} onClick={() => void save(false)}>
              {busy ? "Saving…" : "Save selections only"}
            </button>
            <button
              className="pg-primary"
              disabled={busy || !consent}
              onClick={() => void save(true)}
            >
              {busy ? "Preparing queue…" : "Save & upload originals"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="pg-muted">
            Files are encrypted on the phone before upload. Recovery must be
            configured and verified in Cloud Storage. These files are not added
            to the website publishing queue.
          </p>
          <button
            className="pg-primary"
            disabled={busy}
            onClick={() => void save(true)}
          >
            {busy ? "Preparing queue…" : "Upload encrypted originals"}
          </button>
        </>
      )}
      <p className="pg-muted">
        Uploads use the existing background queue and duplicate detection.{" "}
        <Link href="/secret/studio">Creator Studio</Link> handles the final
        website review, publishing and trip cover.
      </p>
      {error && (
        <p role="alert" className="pg-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
