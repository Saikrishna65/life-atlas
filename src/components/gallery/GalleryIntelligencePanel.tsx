"use client";
import { useGalleryBack } from "@/lib/gallery/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Brain,
  ScanText,
  Sparkles,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Images,
  Users,
} from "lucide-react";
import { R2 } from "@/lib/r2/native";
import { Modal } from "@/components/world/primitives";
import {
  defaultIntelligenceSettings,
  intelligenceStateText,
  type GalleryIntelligenceSettings,
  type GalleryIntelligenceStatus,
} from "@/lib/gallery/intelligence";
import "./gallery-intelligence.css";

export default function GalleryIntelligencePanel({
  albums,
  onClose,
  onChange,
  initialFeature,
}: {
  albums: { name: string; count: number }[];
  onClose: () => void;
  onChange: (status: GalleryIntelligenceStatus) => void;
  initialFeature?: "similar" | "people";
}) {
  useGalleryBack(true, onClose, 96);
  const [status, setStatus] = useState<GalleryIntelligenceStatus>();
  const [settings, setSettings] = useState<GalleryIntelligenceSettings>(
    defaultIntelligenceSettings,
  );
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [clear, setClear] = useState(false);
  const [limitAlbums, setLimitAlbums] = useState(false);
  const [peopleConsent, setPeopleConsent] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (document.hidden) return;
      void R2.getGalleryIntelligence()
        .then((v) => {
          if (!alive) return;
          setStatus(v);
          if (initialFeature && !initialized.current) {
            initialized.current = true;
            setSettings({
              ocr: v.state === "off" ? false : v.ocr,
              visual: v.visual,
              similar: !!v.similar || initialFeature === "similar",
              people: !!v.people || initialFeature === "people",
              chargingOnly: v.chargingOnly,
              wifiOnly: v.wifiOnly,
              albums: v.albums,
            });
            setLimitAlbums(!!v.albums.length);
            setEditing(true);
          }
        })
        .catch((error: unknown) => {
          const code =
            error && typeof error === "object" && "code" in error
              ? String(error.code)
              : "";
          if (alive)
            setError(
              code === "UNIMPLEMENTED"
                ? "Smart search needs the next Android app update. Your gallery still works as usual."
                : "Smart search storage couldn’t be opened. Your photos are unchanged. Close and reopen search settings to try again.",
            );
        });
    };
    refresh();
    const timer = setInterval(refresh, 3500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [initialFeature]);
  const run = async (
    action: "start" | "pause" | "resume" | "scan" | "clear",
  ) => {
    setBusy(true);
    setError("");
    try {
      const value =
        action === "start"
          ? await R2.configureGalleryIntelligence({
              ...settings,
              approved: true,
              peopleApproved: peopleConsent,
            })
          : await R2.controlGalleryIntelligence({ action });
      setStatus(value);
      onChange(value);
      setEditing(false);
      setClear(false);
      setPeopleConsent(false);
    } catch {
      setError(
        "Couldn’t update smart search. Check photo access and try again. Your originals are unchanged.",
      );
    } finally {
      setBusy(false);
    }
  };
  const setup = !!status && (status.state === "off" || editing);
  const modelMB = Math.ceil((status?.modelBytes ?? 153621508) / 1000000);
  return (
    <Modal
      title="Find more in your photos"
      onClose={onClose}
      className="pg-dialog gi-modal"
    >
      <div className="gi-intro">
        <Brain size={30} />
        <h2>Memories, easier to find.</h2>
        <p>
          Search the words inside your photos, or describe what you remember.
          Analysis stays on this phone.
        </p>
      </div>
      <div role="status" className="gi-status">
        {status
          ? intelligenceStateText(status)
          : error
            ? "Smart search unavailable"
            : "Checking smart search…"}
        {status && (
          <small>
            {status.indexed.toLocaleString()} photos analyzed
            {status.failed
              ? ` · ${status.failed} couldn’t be read; a new scan will retry`
              : ""}
          </small>
        )}
      </div>
      {error && (
        <p role="alert" className="gi-error">
          {error}
        </p>
      )}
      {setup ? (
        <fieldset disabled={busy} className="gi-setup">
          <legend>Photo settings</legend>
          <p>
            New photos update automatically. Only new or changed files need
            analysis.
          </p>
          <label>
            <input
              type="checkbox"
              checked={settings.ocr}
              onChange={(e) =>
                setSettings((v) => ({ ...v, ocr: e.target.checked }))
              }
            />
            <ScanText />
            <span>
              <strong>Words in photos</strong>
              <small>
                Tickets, signs, screenshots and receipts. English text; works
                offline.
              </small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.visual}
              onChange={(e) =>
                setSettings((v) => ({ ...v, visual: e.target.checked }))
              }
            />
            <Sparkles />
            <span>
              <strong>Search by description</strong>
              <small>
                Try “mountains at sunset” or “friends outdoors”. English works
                best.{" "}
                {status?.modelReady
                  ? "Model already downloaded."
                  : `Downloads a ${modelMB} MB model once.`}{" "}
                Results can be imperfect.
              </small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!settings.similar}
              onChange={(e) =>
                setSettings((v) => ({ ...v, similar: e.target.checked }))
              }
            />
            <Images />
            <span>
              <strong>Similar photos & suggested picks</strong>
              <small>
                Small fingerprints compare nearby shots. Clarity, lighting and
                resolution help suggest a pick. No extra download and no
                automatic deletion.
              </small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!settings.people}
              onChange={(e) => {
                setSettings((v) => ({ ...v, people: e.target.checked }));
                setPeopleConsent(false);
              }}
            />
            <Users />
            <span>
              <strong>People, named by you</strong>
              <small>
                Suggest face groups privately on this phone. You review matches
                and confirm names.{" "}
                {status?.peopleModelReady
                  ? "Small models already downloaded."
                  : "A separate, small 10.1 MB download."}
              </small>
            </span>
          </label>
          {settings.people && !status?.people && (
            <label className="gi-consent">
              <input
                type="checkbox"
                checked={peopleConsent}
                onChange={(e) => setPeopleConsent(e.target.checked)}
              />
              <span>
                I agree to analyze faces in my selected photos on this phone.
                Face data and names stay private.
              </span>
            </label>
          )}
          {!settings.people && status?.people && (
            <p>
              Saving with people grouping turned off removes its face data,
              names and downloaded models. Originals stay untouched.
            </p>
          )}
          <details>
            <summary>Photos and battery preferences</summary>
            <label>
              <input
                type="checkbox"
                checked={settings.chargingOnly}
                onChange={(e) =>
                  setSettings((v) => ({ ...v, chargingOnly: e.target.checked }))
                }
              />
              <span>
                Charging only{" "}
                <small>
                  Turn off for Balanced: analyse new photos when battery and
                  temperature allow.
                </small>
              </span>
            </label>
            {(settings.visual || settings.people) && (
              <label>
                <input
                  type="checkbox"
                  checked={settings.wifiOnly}
                  onChange={(e) =>
                    setSettings((v) => ({ ...v, wifiOnly: e.target.checked }))
                  }
                />
                <span>Download model on unmetered Wi-Fi only</span>
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={!limitAlbums}
                onChange={(e) => {
                  setLimitAlbums(!e.target.checked);
                  setSettings((v) => ({ ...v, albums: [] }));
                }}
              />
              <span>All accessible albums</span>
            </label>
            <p>Choose specific albums below, or keep all accessible albums.</p>
            <div className="gi-albums">
              {albums.map((a) => (
                <label key={a.name}>
                  <input
                    type="checkbox"
                    checked={!limitAlbums || settings.albums.includes(a.name)}
                    onChange={(e) => {
                      setLimitAlbums(true);
                      setSettings((v) => ({
                        ...v,
                        albums: e.target.checked
                          ? [...new Set([...v.albums, a.name])]
                          : (limitAlbums
                              ? v.albums
                              : albums.map((a) => a.name)
                            ).filter((n) => n !== a.name),
                      }));
                    }}
                  />
                  <span>
                    {a.name}
                    <small>{a.count.toLocaleString()} items</small>
                  </span>
                </label>
              ))}
            </div>
          </details>
          <p className="gi-privacy">
            Enabling this creates an encrypted, rebuildable search index on your
            phone. Photos and search queries are never sent to a server.
            Optional model downloads use internet. Videos and cloud-only files
            are not analyzed yet.
          </p>
          {limitAlbums && !settings.albums.length && (
            <p role="status">
              Choose at least one album, or turn on all accessible albums.
            </p>
          )}
          <button
            className="gi-primary"
            disabled={
              (!settings.ocr &&
                !settings.visual &&
                !settings.similar &&
                !settings.people) ||
              (!!settings.people && !status?.people && !peopleConsent) ||
              (limitAlbums && !settings.albums.length)
            }
            onClick={() => void run("start")}
          >
            {busy
              ? "Starting…"
              : editing
                ? status?.state === "off" && initialFeature === "people"
                  ? "Enable people grouping"
                  : status?.state === "off" && initialFeature === "similar"
                    ? "Find similar photos"
                    : "Save preferences"
                : "Enable smart search"}
          </button>
          {editing && <button onClick={() => setEditing(false)}>Cancel</button>}
        </fieldset>
      ) : (
        status && (
          <div className="gi-controls">
            {status.enabled && !["ready", "error"].includes(status.state) ? (
              <button disabled={busy} onClick={() => void run("pause")}>
                <Pause />
                Pause analysis
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  void run(status.state === "ready" ? "scan" : "resume")
                }
              >
                {status.state === "ready" ? <RefreshCw /> : <Play />}
                {status.state === "ready"
                  ? "Scan for new photos"
                  : "Resume analysis"}
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => {
                setSettings({
                  ocr: status.ocr,
                  visual: status.visual,
                  similar: !!status.similar,
                  people: !!status.people,
                  chargingOnly: status.chargingOnly,
                  wifiOnly: status.wifiOnly,
                  albums: status.albums,
                });
                setLimitAlbums(!!status.albums.length);
                setEditing(true);
              }}
            >
              Change preferences
            </button>
            <p>
              Search works with photos already analyzed, even when analysis is
              paused. New photos are checked about every 12 hours when battery
              preferences allow it. Android may defer background work.
            </p>
            {!clear ? (
              <button
                className="gi-remove"
                disabled={busy}
                onClick={() => setClear(true)}
              >
                <Trash2 />
                Remove analysis data
              </button>
            ) : (
              <div className="gi-confirm">
                <p>
                  Remove local search and similarity analysis, saved picks, face
                  groups and names, and downloaded models? Your photos, trips
                  and cloud copies will stay.
                </p>
                <button disabled={busy} onClick={() => void run("clear")}>
                  Remove analysis data
                </button>
                <button disabled={busy} onClick={() => setClear(false)}>
                  Keep it
                </button>
              </div>
            )}
          </div>
        )
      )}
    </Modal>
  );
}
