"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Pencil,
  Ticket,
  Map,
  Wallet,
  CheckSquare,
  Images,
  Music,
  Cloud,
  Globe,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useTripVault } from "@/lib/vault/useTripVault";
import { useItinerary } from "@/lib/vault/useItinerary";
import { useBookings } from "@/lib/vault/useBookings";
import { usePackingList } from "@/lib/vault/usePackingList";
import type { TripStatus } from "@/lib/vault/types";
import { tripScheduleLabel, tripScheduleInput } from "@/lib/vault/tripSchedule";
import TripEditor from "@/components/trip-vault/TripEditor";
import LiveExpeditionTracker from "@/components/trip-vault/LiveExpeditionTracker";
import { publishTripToWebsite } from "@/lib/vault/publishTrip";
import {
  TripSheet,
  tripCover,
  EmptyTripState,
} from "@/components/trip-vault/shared";

export default function TripOverview() {
  const params = useParams();
  const id = String(params.tripId || "");
  const router = useRouter();

  const { trips, isLoading, error, changeTripStatus, deleteTrip } = useTripVault();
  const trip = trips.find((t) => t.id === id);

  const itinerary = useItinerary(id);
  const packing = usePackingList(id);
  const { bookings } = useBookings(id);

  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState("");
  const [publishError, setPublishError] = useState("");

  if (isLoading) return <p role="status">Opening your trip…</p>;
  if (!trip)
    return (
      <EmptyTripState title="Trip not found">
        {error || "Return to your journeys and choose a saved trip."}
      </EmptyTripState>
    );

  const base = `/secret/vault/${id}`;
  const next = itinerary.days
    .flatMap((day) =>
      day.activities
        .filter((a) => a.status === "PLANNED" || a.status === "IN_PROGRESS")
        .map((activity) => ({ day, activity }))
    )[0];

  const booking = bookings
    .filter((b) => b.status !== "CANCELLED")
    .sort((a, b) =>
      (a.departureOrCheckInTime || "").localeCompare(b.departureOrCheckInTime || "")
    )[0];

  async function handlePublishToWebsite() {
    setPublishing(true);
    setPublishError("");
    setPublishSuccess("");
    try {
      const res = await publishTripToWebsite(id);
      setPublishSuccess(
        `Expedition published! ${res.placesCount} places, ${res.photoCount} photos, and ${itinerary.days.length} itinerary days are now live on your website.`
      );
    } catch (err) {
      setPublishError(
        err instanceof Error
          ? err.message
          : "Could not publish to website. Please check your internet connection."
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="tv-overview">
      {/* Hero Header */}
      <section className="tv-destination-hero">
        <img src={tripCover(trip.coverImage)} alt="" />
        <div className="tv-photo-scrim" />
        <span className="tv-glass-tag">
          <MapPin size={13} />
          {trip.destination}
        </span>
        <button
          className="tv-hero-edit"
          onClick={() => setEditing(true)}
          aria-label="Edit trip details"
        >
          <Pencil size={16} />
        </button>
        <div className="tv-destination-copy">
          <p>YOUR JOURNEY</p>
          <h1>{trip.title}</h1>
          <span>
            <CalendarDays size={15} />
            {tripScheduleLabel(trip)}
            {trip.companions?.length
              ? ` · ${trip.companions.length + 1} travellers`
              : ""}
          </span>
        </div>
      </section>

      {trip.startDate && (
        <p className="tv-fine">
          Travel times in {tripScheduleInput(trip).timeZone}
        </p>
      )}

      {/* Trip Identity & Status Switcher */}
      <div className="tv-trip-identity">
        <span className="tv-online-dot">Saved on device</span>
        <label>
          <span className="tv-sr-only">Trip status</span>
          <select
            aria-label="Trip status"
            value={trip.status}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              setProblem("");
              try {
                await changeTripStatus(id, e.target.value as TripStatus);
              } catch (err) {
                setProblem(
                  err instanceof Error ? err.message : "Could not change status."
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {["DRAFT", "PLANNING", "ACTIVE", "COMPLETED", "ARCHIVED"].map((s) => (
              <option
                key={s}
                value={s}
                disabled={!trip.startDate && ["ACTIVE", "COMPLETED"].includes(s)}
              >
                {s === "ACTIVE" ? "On the road" : s.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Hybrid Live Expedition GPS Tracker */}
      <LiveExpeditionTracker tripId={id} tripDestination={trip.destination} />

      {/* Post Trip Directly to Public Website Card */}
      <section className="tv-publish-card">
        <div className="tv-publish-header">
          <div className="tv-publish-title">
            <Globe size={18} style={{ color: "var(--tv-cyan, #06b6d4)" }} />
            <span>
              {trip.publishedSlug ? "Published to Public Website" : "Post Trip to Website"}
            </span>
          </div>
          {trip.publishedSlug && (
            <span className="tv-publish-badge">
              <CheckCircle2 size={12} /> Live on Web
            </span>
          )}
        </div>

        <p className="tv-publish-desc">
          {trip.publishedSlug
            ? `Your expedition is live on the public website. You can view the live journal, photo gallery, and visited places or update the post anytime.`
            : "Post this trip directly to your public Life Atlas website to publish your visited places, itinerary days, photo memories, and expedition stats."}
        </p>

        {publishError && (
          <p className="tv-error" role="alert">
            {publishError}
          </p>
        )}
        {publishSuccess && (
          <p className="tv-fine" style={{ color: "#10b981", fontWeight: 600 }}>
            {publishSuccess}
          </p>
        )}

        <div className="tv-publish-actions">
          <button
            className="tv-publish-btn"
            disabled={publishing || !trip.startDate}
            onClick={handlePublishToWebsite}
          >
            <Globe size={15} />
            {publishing
              ? "Publishing to Website…"
              : trip.publishedSlug
              ? "Update Website Post"
              : "Post Trip to Website"}
          </button>

          {trip.publishedSlug && (
            <a
              className="tv-publish-link"
              href={`/trips/${trip.publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>View on Website</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </section>

      {problem && (
        <p className="tv-error" role="alert">
          {problem}
        </p>
      )}

      {/* Overview Metric Tiles */}
      <div className="tv-overview-metrics">
        <Link href={base + "/plan"}>
          <span>THE PLAN</span>
          <strong>
            {itinerary.days.length}
            <small> days</small>
          </strong>
          <p>{itinerary.stats.completedActivities} activities done</p>
        </Link>
        <Link href={base + "/money"}>
          <span>TRIP BUDGET</span>
          <strong>
            {trip.budgetTotal
              ? new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: trip.currency,
                  maximumFractionDigits: 0,
                }).format(trip.budgetTotal)
              : "Not set"}
          </strong>
          <p>Open your spending</p>
        </Link>
        <Link href={base + "/checklist"}>
          <span>READY TO GO</span>
          <strong>
            {packing.stats.percentPacked}
            <small>%</small>
          </strong>
          <p>
            {packing.stats.packedItems} of {packing.stats.totalItems} packed
          </p>
        </Link>
      </div>

      {/* Next Up Activity / Bookings */}
      <div className="tv-section-heading">
        <h2>A little closer to going.</h2>
      </div>

      <div className="tv-next-grid">
        <Link className="tv-next-card" href={base + "/plan"}>
          <span className="tv-mini-icon">
            <Map size={19} />
          </span>
          <div>
            <small>NEXT IN YOUR PLAN</small>
            <h3>{next?.activity.title || "Make room for a good day."}</h3>
            <p>
              {next
                ? `Day ${next.day.dayIndex} · ${
                    next.activity.startTime || next.activity.timeSlot.toLowerCase()
                  }${next.activity.location ? " · " + next.activity.location : ""}`
                : "Add your first activity. Keep the day as open as you like."}
            </p>
          </div>
          <ArrowUpRight size={17} />
        </Link>

        <Link className="tv-next-card" href={base + "/bookings"}>
          <span className="tv-mini-icon">
            <Ticket size={19} />
          </span>
          <div>
            <small>TICKETS & STAYS</small>
            <h3>{booking?.title || "Everything, in your pocket."}</h3>
            <p>
              {booking
                ? `${booking.type.toLowerCase()} · ${
                    booking.bookingReference || booking.status.toLowerCase()
                  }`
                : "Save a booking or attach a ticket for offline access."}
            </p>
          </div>
          <ArrowUpRight size={17} />
        </Link>
      </div>

      {/* Trip Sections Directory */}
      <section className="tv-organise">
        <div className="tv-section-heading">
          <h2>Your trip, neatly together.</h2>
        </div>
        {[
          {
            key: "plan",
            name: "Plan",
            text: "Your days, places and food discoveries",
            Icon: Map,
          },
          {
            key: "bookings",
            name: "Bookings",
            text: "Tickets, stays, files and their reminders",
            Icon: Ticket,
          },
          {
            key: "money",
            name: "Money",
            text: "One place for your trip spending",
            Icon: Wallet,
          },
          {
            key: "checklist",
            name: "Checklist",
            text: "The things to pack and remember",
            Icon: CheckSquare,
          },
          {
            key: "memories",
            name: "Memories",
            text: "The moments worth coming back to",
            Icon: Images,
          },
        ].map(({ key, name, text, Icon }) => (
          <Link className="tv-organise-row" key={key} href={base + "/" + key}>
            <span className="tv-mini-icon">
              <Icon size={20} />
            </span>
            <div>
              <h3>{name}</h3>
              <p>{text}</p>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </section>

      {/* Extras & Danger Zone */}
      <details className="tv-details tv-trip-extras">
        <summary>Trip details & extras</summary>
        {trip.notes && <p>{trip.notes}</p>}
        <button className="tv-secondary" onClick={() => setEditing(true)}>
          <Pencil size={15} /> Edit trip details
        </button>
        <Link className="tv-secondary" href="/secret/music/playlists">
          <Music size={15} /> Choose a soundtrack
        </Link>
        <Link className="tv-secondary" href="/secret/control-room?tab=cloud">
          <Cloud size={15} /> Cloud copies
        </Link>
        <button
          className="tv-text-danger"
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                "Delete this trip and its local plans, bookings, documents and memories? Finance payments remain in Finance."
              )
            )
              return;
            setBusy(true);
            try {
              await deleteTrip(id);
              router.push("/secret/vault");
            } catch (e) {
              setProblem(
                e instanceof Error ? e.message : "Could not delete this trip."
              );
              setBusy(false);
            }
          }}
        >
          Delete this trip
        </button>
      </details>

      {/* Edit Modal */}
      {editing && (
        <TripSheet title="Trip details" onClose={() => setEditing(false)}>
          <TripEditor trip={trip} onSaved={() => setEditing(false)} />
        </TripSheet>
      )}
    </div>
  );
}
