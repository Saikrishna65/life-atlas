"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  MapPin,
  Mountain,
  Plus,
} from "lucide-react";
import GalleryThumbnail from "./GalleryThumbnail";
import { deviceAsset } from "@/lib/gallery/model";
import "./gallery-wizard.css";
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
  const [tripId, setTripId] = useState(""),
    [placeId, setPlaceId] = useState(""),
    [placeName, setPlaceName] = useState(""),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState(""),
    [location, setLocation] = useState<WebsiteMapLocation>(),
    [slot, setSlot] = useState<"public" | "private">("public"),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [step, setStep] = useState(0),
    [uploadChoice, setUploadChoice] = useState(false);
  const canContinue = creating ? !!title.trim() && !!location : !!tripId;
  const canPlace = !!placeId || !!placeName.trim();
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
      className="pg-dialog ga-wizard"
    >
      <div className="ga-step-line">
        <span>{media.length} selected</span>
        <span>
          {step === 0
            ? "CHOOSE A DESTINATION"
            : slot === "private"
              ? "PRIVATE BACKUP"
              : `${step} OF 3`}
        </span>
      </div>
      {step > 0 && (
        <button
          className="ga-back"
          disabled={busy}
          onClick={() => {
            setStep(slot === "private" ? 0 : step - 1);
            setError("");
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
      )}
      {step === 0 && (
        <>
          <h3 className="ga-title">
            What would you
            <br />
            like to do?
          </h3>
          <p className="ga-description">
            Choose one. Your originals stay on your phone.
          </p>
          <button
            className="ga-intent"
            onClick={() => {
              setSlot("public");
              setStep(1);
            }}
          >
            <Mountain size={28} />
            <span>
              <strong>Add to a trip</strong>
              <small>
                Choose a trip and a place. Decide about uploading later.
              </small>
            </span>
            <ArrowRight size={19} />
          </button>
          <button
            className="ga-intent"
            onClick={() => {
              setSlot("private");
              setStep(3);
            }}
          >
            <LockKeyhole size={28} />
            <span>
              <strong>Back up privately</strong>
              <small>
                Encrypted cloud copies. Never added to your website.
              </small>
            </span>
            <ArrowRight size={19} />
          </button>
        </>
      )}
      {step === 1 && (
        <>
          <h3 className="ga-title">Which trip?</h3>
          <p className="ga-description">
            Each journey keeps its own photos and places.
          </p>
          <div className="ga-choices">
            {trips.map((t) => (
              <button
                key={t.id}
                aria-pressed={!creating && tripId === t.id}
                onClick={() => {
                  setTripId(t.id);
                  setCreating(false);
                  setPlaceId("");
                  setPlaceName("");
                }}
              >
                <Mountain size={20} />
                <span>{t.title}</span>
                {tripId === t.id && !creating && <Check size={17} />}
              </button>
            ))}
            <button
              aria-pressed={creating}
              onClick={() => {
                setCreating(true);
                setTripId("");
                setPlaceId("");
                setPlaceName("");
              }}
            >
              <Plus size={20} />
              <span>Create a new trip</span>
            </button>
          </div>
          {creating && (
            <div className="ga-new">
              <label>
                Trip name
                <input
                  aria-label="Trip title"
                  value={title}
                  maxLength={140}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <p className="ga-description">
                Choose the trip’s globe location.
              </p>
              <TripMapPicker value={location} onChange={setLocation} />
            </div>
          )}
          <button
            className="ga-next pg-primary"
            disabled={!canContinue}
            onClick={() => setStep(2)}
          >
            Choose a place
            <ArrowRight size={17} />
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <h3 className="ga-title">
            Where were
            <br />
            these taken?
          </h3>
          <p className="ga-description">
            Pick a place in {creating ? title : trip?.title}.
          </p>
          <div className="ga-choices">
            {!creating &&
              trip?.websitePlaces?.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={placeId === p.id}
                  onClick={() => {
                    setPlaceId(p.id);
                    setPlaceName("");
                  }}
                >
                  <MapPin size={20} />
                  <span>{p.name}</span>
                  {placeId === p.id && <Check size={17} />}
                </button>
              ))}
          </div>
          <label className="ga-place-label">
            Or add a new place
            <input
              aria-label="New place name"
              placeholder="The lake, the campsite…"
              value={placeName}
              maxLength={54}
              onChange={(e) => {
                setPlaceName(e.target.value);
                setPlaceId("");
              }}
            />
          </label>
          <button
            className="ga-next pg-primary"
            disabled={!canPlace}
            onClick={() => setStep(3)}
          >
            Review selection
            <ArrowRight size={17} />
          </button>
        </>
      )}
      {step === 3 && (
        <>
          <h3 className="ga-title">
            {slot === "private" ? "A safe second copy." : "Ready to collect."}
          </h3>
          <div className="ga-preview">
            {media.slice(0, 4).map((m) => (
              <div key={m.id}>
                <GalleryThumbnail asset={deviceAsset(m, [])} />
              </div>
            ))}
          </div>
          <p className="ga-summary">
            {media.length} original {media.length === 1 ? "file" : "files"}
            {slot === "public" && (
              <>
                {" "}
                · {creating ? title : trip?.title}
                <br />
                <MapPin size={13} />{" "}
                {placeId
                  ? trip?.websitePlaces?.find((p) => p.id === placeId)?.name
                  : placeName}
              </>
            )}
          </p>
          {slot === "public" ? (
            <>
              <div
                className="ga-delivery"
                role="group"
                aria-label="Upload choice"
              >
                <button
                  aria-pressed={!uploadChoice}
                  disabled={busy}
                  onClick={() => setUploadChoice(false)}
                >
                  <strong>Keep on my phone</strong>
                  <small>Organize now. No upload.</small>
                </button>
                <button
                  aria-pressed={uploadChoice}
                  disabled={busy}
                  onClick={() => setUploadChoice(true)}
                >
                  <strong>Upload a public copy</strong>
                  <small>Also queue originals in public storage.</small>
                </button>
              </div>
              {uploadChoice && (
                <label className="pg-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    disabled={busy}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I approve uploading these originals to public storage. Their
                  EXIF/location metadata may be readable. The trip journal is
                  published separately.
                </label>
              )}
              <button
                className="ga-next pg-primary"
                disabled={busy || (uploadChoice && !consent)}
                onClick={() => void save(uploadChoice)}
              >
                {busy
                  ? "Saving…"
                  : uploadChoice
                    ? "Upload & add to trip"
                    : "Add to trip"}
                <Check size={18} />
              </button>
            </>
          ) : (
            <>
              <p className="ga-description">
                Encrypted on your phone before upload. Your verified recovery
                kit is required. This does not publish or organize the files
                into a trip.
              </p>
              <button
                className="ga-next pg-primary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                {busy ? "Preparing backup…" : "Back up originals"}
                <LockKeyhole size={18} />
              </button>
              <Link className="ga-help" href="/secret/gallery/library#backup">
                Set up private backup ↗
              </Link>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="pg-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
