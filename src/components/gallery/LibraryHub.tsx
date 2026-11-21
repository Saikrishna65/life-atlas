"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Cloud,
  ShieldCheck,
  Settings,
  Trash2,
  Upload,
  LockKeyhole,
  RefreshCw,
  Download,
  Play,
  X,
  ImageIcon,
} from "lucide-react";
import {
  R2,
  nativeR2Available,
  systemAction,
  storageError,
  bytes,
} from "@/lib/r2/native";
import { gallerySource } from "@/lib/gallery/actions";
import {
  defaultBackup,
  validateBackupSettings,
  importProgress,
  type BackupSettings,
  type LibraryItem,
  type LibraryStatus,
} from "@/lib/gallery/library";
import type { StorageSummary } from "@/lib/r2/types";
import PhotoViewer from "./PhotoViewer";
import LibraryThumbnail from "./LibraryThumbnail";
import PhoneTrash from "./PhoneTrash";
import "./library-hub.css";
export default function LibraryHub() {
  const supported = nativeR2Available(),
    [tab, setTab] = useState<"backup" | "library" | "trash" | "import">(() => {
      const hash =
        typeof window === "undefined" ? "" : window.location.hash.slice(1);
      return ["backup", "library", "trash", "import"].includes(hash)
        ? (hash as "backup" | "library" | "trash" | "import")
        : "backup";
    }),
    [status, setStatus] = useState<LibraryStatus>(),
    [summary, setSummary] = useState<StorageSummary>(),
    [settings, setSettings] = useState<BackupSettings>(defaultBackup),
    [albums, setAlbums] = useState<
      { id: string; name: string; count: number }[]
    >([]),
    [session, setSession] = useState(""),
    [items, setItems] = useState<LibraryItem[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [days, setDays] = useState(30),
    [pendingDeletes, setPendingDeletes] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [consent, setConsent] = useState(false),
    [viewer, setViewer] = useState<{
      item: LibraryItem;
      url: string;
      clip: boolean;
    }>();
  const token = useRef(""),
    alive = useRef(true);
  const closeViewer = useCallback(() => {
    setViewer(undefined);
    const value = token.current;
    token.current = "";
    if (value) void R2.releaseGalleryPreview({ token: value }).catch(() => {});
  }, []);
  const report = (e: unknown) =>
    setError(
      e instanceof Error && !("code" in e) ? e.message : storageError(e),
    );
  const refresh = useCallback(async () => {
    if (!supported) return;
    const next = await R2.getLibraryStatus();
    if (alive.current) setStatus(next);
  }, [supported]);
  useEffect(() => {
    alive.current = true;
    if (supported) {
      void R2.getLibraryStatus()
        .then((value) => {
          if (alive.current) {
            setStatus(value);
            setDays(value.trashDays || 30);
            setSettings({ ...defaultBackup, ...value.autoBackup });
          }
        })
        .catch(report);
      void R2.getConfigurationSummary().then(setSummary).catch(report);
      void R2.getBackupAlbums()
        .then((result) => {
          if (alive.current) setAlbums(result.albums);
        })
        .catch(report);
      void R2.setSensitiveScreen({ enabled: true }).catch(() => {});
    }
    const timer = setInterval(() => void refresh().catch(() => {}), 3000);
    const hide = () => {
      if (document.hidden) {
        closeViewer();
        setSession("");
        setItems([]);
        setSelected([]);
        void R2.endLibrarySession().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      const value = token.current;
      if (value)
        void R2.releaseGalleryPreview({ token: value }).catch(() => {});
      if (supported) void R2.endLibrarySession().catch(() => {});
    };
  }, [supported, refresh, closeViewer]);
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      await refresh();
    } catch (e) {
      report(e);
      if ((e as { code?: string }).code === "LIBRARY_UNLOCK_REQUIRED") {
        setSession("");
        setItems([]);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function load(
    append = false,
    auth = session,
    nextTab = tab,
    pending = pendingDeletes,
  ) {
    const result = await R2.listLibrary({
      session: auth,
      slot: "private",
      state: nextTab === "trash" ? (pending ? "deleted" : "trashed") : "active",
      offset: append ? offset : 0,
    });
    if (alive.current) {
      setItems((old) => (append ? [...old, ...result.items] : result.items));
      setOffset(result.offset);
      setMore(!result.complete);
    }
  }
  async function open(item: LibraryItem, clip: boolean) {
    closeViewer();
    const result = await R2.libraryPreview({
      session,
      id: item.id,
      variant: clip ? "clip" : "original",
    });
    if (!alive.current) {
      if (result.token) await R2.releaseGalleryPreview({ token: result.token });
      return;
    }
    token.current = result.token || "";
    setViewer({ item, url: result.url || gallerySource(result.path!), clip });
  }
  async function changeTrash(action: "trash" | "restore" | "purge") {
    if (!selected.length) return;
    const prompt =
      action === "purge"
        ? `Permanently delete ${selected.length} encrypted cloud originals and their managed previews? Phone files and trip albums are not deleted. This cannot be undone.`
        : action === "trash"
          ? `Move ${selected.length} cloud copies to Atlas trash? Phone originals and trip memberships stay in place. Nothing is permanently deleted now.`
          : `Restore ${selected.length} cloud copies to the library?`;
    if (!confirm(prompt)) return;
    const result = await systemAction(() =>
      R2.changeLibraryTrash({ action, ids: selected, days }),
    );
    setSession(result.session);
    setSelected([]);
    await load(false, result.session);
    setNotice(
      action === "purge"
        ? "Cloud deletion completed."
        : "Cloud library updated.",
    );
  }
  return (
    <main className="gallery-library">
      <header className="gl-top">
        <Link href="/secret/gallery">
          <ArrowLeft size={20} /> Gallery
        </Link>
        <span>
          <Cloud size={23} /> Atlas library
        </span>
        <Link href="/secret/control-room">Cloud Storage ↗</Link>
      </header>
      <section className="gl-heading">
        <div>
          <h1>Your library. Your rules.</h1>
          <p>Choose what to keep, where it goes, and when it uploads.</p>
        </div>
        <button
          disabled={busy}
          onClick={() => void run(refresh)}
          aria-label="Refresh library status"
        >
          <RefreshCw size={18} />
        </button>
      </section>
      <nav className="gl-tabs" aria-label="Library tools">
        {(["backup", "library", "trash", "import"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            disabled={busy}
            onClick={() => {
              setTab(value);
              setItems([]);
              setOffset(0);
              setSelected([]);
              closeViewer();
              if (session && (value === "library" || value === "trash"))
                void run(() => load(false, session, value));
            }}
          >
            {value === "backup" ? (
              <Settings size={18} />
            ) : value === "library" ? (
              <ImageIcon size={18} />
            ) : value === "trash" ? (
              <Trash2 size={18} />
            ) : (
              <Upload size={18} />
            )}{" "}
            {value === "backup"
              ? "Backup"
              : value === "library"
                ? "Cloud photos"
                : value === "trash"
                  ? "Cloud trash"
                  : "Takeout import"}
          </button>
        ))}
      </nav>
      {!supported ? (
        <p>
          Open Atlas Next on Android to manage your phone library and direct R2
          backups.
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="gl-error">
              {error}
              <button
                aria-label="Dismiss library error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </p>
          )}
          {notice && (
            <p role="status" className="gl-notice">
              {notice}
            </p>
          )}
          {tab === "backup" && (
            <>
              <section className="gl-panel gl-backup-state">
                <ShieldCheck size={28} />
                <div>
                  <h2>
                    {status?.autoBackup.enabled
                      ? "Private backup is enabled"
                      : "Private backup is off"}
                  </h2>
                  <p>
                    {status?.autoBackup.error
                      ? storageError({ code: status.autoBackup.error })
                      : status?.autoBackup.lastScan
                        ? `Last scan ${new Date(status.autoBackup.lastScan).toLocaleString()}. Android schedules background work when your conditions are met.`
                        : "Choose the albums to back up. Files are encrypted before they leave your phone."}
                  </p>
                </div>
              </section>
              <section className="gl-panel">
                <h2>Backup preferences</h2>
                {status?.backupTransfers && (
                  <p role="status">
                    {status.backupTransfers.active} automatic uploads queued or
                    active · {status.backupTransfers.failed} need attention.{" "}
                    <Link href="/secret/control-room">Open transfers</Link>
                  </p>
                )}
                <p>
                  Requires a connected private bucket, a verified recovery kit,
                  and full access to the selected media types and original
                  metadata.{" "}
                  <Link href="/secret/control-room">
                    Configure Cloud Storage
                  </Link>
                </p>
                <label className="gl-check">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) =>
                      setSettings({ ...settings, enabled: e.target.checked })
                    }
                  />{" "}
                  Enable automatic encrypted private backup
                </label>
                <h3>What and when</h3>
                <p>
                  Choose your media, then the conditions for automatic uploads.
                </p>
                <div className="gl-options">
                  {(
                    [
                      "photos",
                      "videos",
                      "wifiOnly",
                      "chargingOnly",
                      "includeExisting",
                      "videoPreviews",
                    ] as const
                  ).map((key) => (
                    <label className="gl-check" key={key}>
                      <input
                        type="checkbox"
                        checked={settings[key]}
                        onChange={(e) =>
                          setSettings({ ...settings, [key]: e.target.checked })
                        }
                      />
                      {
                        {
                          photos: "Photos",
                          videos: "Videos",
                          wifiOnly: "Unmetered network only (usually Wi-Fi)",
                          chargingOnly: "Upload only while charging",
                          includeExisting: "Include existing photos and videos",
                          videoPreviews:
                            "Create short 720p video previews (on unmetered network while charging)",
                        }[key]
                      }
                    </label>
                  ))}
                </div>
                <h3>Device albums</h3>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await systemAction(() => R2.requestGalleryAccess());
                      const result = await R2.getBackupAlbums();
                      setAlbums(result.albums);
                    })
                  }
                >
                  Review photo access & refresh albums
                </button>
                <div className="gl-albums">
                  {albums.map((album) => (
                    <label className="gl-check" key={album.id}>
                      <input
                        type="checkbox"
                        checked={settings.albums.includes(album.id)}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            albums: e.target.checked
                              ? [...settings.albums, album.id]
                              : settings.albums.filter((id) => id !== album.id),
                          })
                        }
                      />
                      <span>
                        {album.name}
                        <small>
                          {album.count} accessible files ·{" "}
                          {album.id.split(":")[0]}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                {!albums.length && (
                  <p>
                    Allow full photo/video access in Gallery, then reopen this
                    page to choose albums.
                  </p>
                )}
                <label className="gl-check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />{" "}
                  I approve automatic uploads from these albums to my encrypted
                  private bucket and have independently saved my verified
                  recovery kit.
                </label>
                <div className="gl-actions">
                  <button
                    className="gl-primary"
                    disabled={busy || (settings.enabled && !consent)}
                    onClick={() =>
                      void run(async () => {
                        validateBackupSettings(settings);
                        const saved = await systemAction(() =>
                          R2.configureAutoBackup({ settings }),
                        );
                        setSettings({ ...defaultBackup, ...saved });
                        setNotice(
                          saved.enabled
                            ? "Private backup configured. Android will run it when your conditions allow."
                            : "Automatic backup paused. Originals and cloud copies are retained.",
                        );
                      })
                    }
                  >
                    Save backup settings
                  </button>
                  <button
                    disabled={busy || !status?.autoBackup.enabled}
                    onClick={() =>
                      void run(async () => {
                        await R2.scanBackupNow();
                        setNotice(
                          "Backup scan requested. Your network and charging preferences still apply.",
                        );
                      })
                    }
                  >
                    Scan now
                  </button>
                </div>
                <p className="gl-muted">
                  Backup never publishes to the website or deletes phone
                  originals. Force-stopping the app or Android battery
                  restrictions can delay work.
                </p>
              </section>
              <section className="gl-panel">
                <h2>Recoverable cloud index</h2>
                <p>
                  Verified uploads include encrypted recovery records with
                  original names, integrity information and preview references.
                  Restore your recovery key first after changing phones or
                  reinstalling.
                </p>
                <div className="gl-actions">
                  <button
                    disabled={busy || !summary?.recoveryVerified}
                    onClick={() =>
                      void run(async () => {
                        await systemAction(() =>
                          R2.startLibraryTask({ action: "restore" }),
                        );
                        setNotice("Cloud index restoration queued.");
                      })
                    }
                  >
                    Restore index from R2
                  </button>
                  <button
                    disabled={busy || !summary?.recoveryVerified}
                    onClick={() =>
                      void run(async () => {
                        await systemAction(() =>
                          R2.startLibraryTask({ action: "reconcile" }),
                        );
                        setNotice(
                          "Checking existing upload history and saving recovery records.",
                        );
                      })
                    }
                  >
                    Index existing uploads
                  </button>
                  <button
                    disabled={busy || !summary?.recoveryVerified}
                    onClick={() =>
                      void run(async () => {
                        await systemAction(() =>
                          R2.startLibraryTask({ action: "sync" }),
                        );
                        setNotice("Recovery record synchronization queued.");
                      })
                    }
                  >
                    Sync pending records
                  </button>
                </div>
                {status?.task.status && (
                  <p role="status">
                    {status.task.action}: {status.task.status} ·{" "}
                    {status.task.processed || 0} records{" "}
                    {status.task.error
                      ? `· ${storageError({ code: status.task.error })}`
                      : ""}
                  </p>
                )}
              </section>
            </>
          )}
          {(tab === "library" || tab === "trash") && (
            <>
              <section className="gl-panel gl-library-intro">
                <div>
                  <h2>
                    {tab === "trash"
                      ? "Private cloud trash"
                      : "Verified private library"}
                  </h2>
                  <p>
                    {tab === "trash"
                      ? "Cloud trash is separate from Android phone trash. Originals stay recoverable here until you explicitly delete them permanently."
                      : "Browse indexed backups with encrypted thumbnails. Verification dates refer to the completed upload; files removed outside Atlas may require reconciliation."}
                  </p>
                </div>
                {!session ? (
                  <button
                    className="gl-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await systemAction(() =>
                          R2.beginLibrarySession(),
                        );
                        setSession(result.session);
                        await load(false, result.session);
                      })
                    }
                  >
                    <LockKeyhole size={17} /> Unlock cloud library
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => void run(() => load())}
                  >
                    Refresh photos
                  </button>
                )}
              </section>
              {tab === "trash" && (
                <label className="gl-retention">
                  Trash recovery preference
                  <select
                    aria-label="Trash recovery period"
                    value={days}
                    disabled={busy}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      void run(async () => {
                        await R2.saveLibraryPreferences({ trashDays: next });
                        setDays(next);
                      });
                    }}
                  >
                    {[7, 30, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} days
                      </option>
                    ))}
                  </select>
                  <span>
                    Expiry is a reminder; Atlas does not silently purge files.
                  </span>
                </label>
              )}
              {tab === "trash" && (
                <div className="gl-actions">
                  <button
                    disabled={busy}
                    aria-pressed={pendingDeletes}
                    onClick={() => {
                      const next = !pendingDeletes;
                      setPendingDeletes(next);
                      setSelected([]);
                      setItems([]);
                      if (session)
                        void run(() => load(false, session, tab, next));
                    }}
                  >
                    {pendingDeletes
                      ? "Show recoverable trash"
                      : "Show deletion records"}
                  </button>
                  {pendingDeletes && (
                    <p>
                      Deleted items cannot be restored. Interrupted deletions
                      stay here with a Retry cleanup action.
                    </p>
                  )}
                </div>
              )}
              {selected.length > 0 && (
                <div className="gl-selection">
                  <strong>{selected.length} selected</strong>
                  {tab === "library" ? (
                    <button
                      disabled={busy}
                      onClick={() => void run(() => changeTrash("trash"))}
                    >
                      Move cloud copies to trash
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={busy || pendingDeletes}
                        onClick={() => void run(() => changeTrash("restore"))}
                      >
                        Restore
                      </button>
                      <button
                        disabled={busy}
                        className="gl-danger"
                        onClick={() => void run(() => changeTrash("purge"))}
                      >
                        {pendingDeletes
                          ? "Retry cleanup"
                          : "Delete permanently"}
                      </button>
                    </>
                  )}
                  <button onClick={() => setSelected([])}>Clear</button>
                </div>
              )}
              <div className="gl-grid">
                {items.map((item) => (
                  <article key={item.id}>
                    <button
                      className="gl-photo"
                      disabled={tab === "trash" || busy}
                      aria-label={`Open ${item.name}`}
                      onClick={() => void run(() => open(item, !!item.hasClip))}
                    >
                      <LibraryThumbnail
                        key={session + item.id}
                        item={item}
                        session={session}
                      />
                      {item.hasClip && (
                        <span className="gl-preview-badge">
                          <Play size={13} />
                          15s preview
                        </span>
                      )}
                    </button>
                    <label className="gl-item-select">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.name}`}
                        checked={selected.includes(item.id)}
                        onChange={(e) =>
                          setSelected((old) =>
                            e.target.checked
                              ? [...old, item.id].slice(0, 100)
                              : old.filter((id) => id !== item.id),
                          )
                        }
                      />
                      <strong>{item.name}</strong>
                    </label>
                    <p>
                      {bytes(item.size)} ·{" "}
                      {item.state === "trashed"
                        ? `Trashed ${new Date(item.trashAt!).toLocaleDateString()}`
                        : `Verified ${new Date(item.verifiedAt).toLocaleDateString()}`}
                    </p>
                    {item.cleanupPending && (
                      <p role="status">
                        Deletion interrupted — select this item and retry
                        cleanup.
                      </p>
                    )}
                    {item.capturedAt && (
                      <p>Taken {new Date(item.capturedAt).toLocaleString()}</p>
                    )}
                    {item.expiresAt && (
                      <p>
                        Recovery reminder:{" "}
                        {new Date(item.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                    {item.conflicted && (
                      <p className="gl-error">
                        Conflicting recovery revisions retained the safer
                        deletion state. Review before restoring.
                      </p>
                    )}
                    {tab === "library" && (
                      <div className="gl-row-actions">
                        {item.hasClip && (
                          <button
                            disabled={busy}
                            onClick={() => void run(() => open(item, false))}
                          >
                            Full original
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await systemAction(() =>
                                R2.downloadLibraryOriginal({
                                  session,
                                  id: item.id,
                                }),
                              );
                              setSession("");
                              setNotice(
                                "Original download queued. Unlock the library again after the system picker.",
                              );
                            })
                          }
                        >
                          <Download size={13} /> Download
                        </button>
                      </div>
                    )}
                    {item.takeout?.description && (
                      <p>{item.takeout.description}</p>
                    )}
                    {item.takeout?.albums?.length && (
                      <p>Albums: {item.takeout.albums.join(" · ")}</p>
                    )}
                  </article>
                ))}
              </div>
              {tab === "trash" && (
                <PhoneTrash androidSdk={status?.androidSdk || 0} />
              )}
              {session && !items.length && (
                <div className="gl-empty">
                  {tab === "trash"
                    ? "Cloud trash is empty."
                    : "No indexed backups yet. Enable private backup, restore an existing index, or index previous uploads from Backup."}
                </div>
              )}
              {session && more && (
                <button
                  disabled={busy}
                  onClick={() => void run(() => load(true))}
                >
                  Load next 50
                </button>
              )}
            </>
          )}
          {tab === "import" && (
            <>
              <section className="gl-panel">
                <h2>Bring your Google Takeout library</h2>
                {status?.importSummary && (
                  <p>
                    {status.importSummary.files} imported files indexed ·{" "}
                    {status.importSummary.unmatched} metadata sidecars awaiting
                    a matching file. Import remaining ZIP parts to match more
                    files. Truncated or ambiguous names are not guessed.
                  </p>
                )}
                <p>
                  Choose ZIP archives from Google Takeout. Atlas streams
                  originals into Android’s Pictures/Atlas Imports or
                  Movies/Atlas Imports without re-encoding. Supported JSON
                  sidecars retain dates, descriptions, locations and album
                  references separately from original bytes.
                </p>
                <p>
                  Allow enough phone storage for the extracted files. Multiple
                  ZIP parts can be imported; incomplete jobs can be resumed.
                  Importing does not publish anything. New files may be backed
                  up if their device albums are included in your backup
                  preferences.
                </p>
                <button
                  className="gl-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const chosen = await systemAction(() =>
                        R2.pickTakeoutArchives(),
                      );
                      setNotice(
                        chosen.files.length
                          ? `${chosen.files.length} archives selected. Review and start each import below.`
                          : "No archives selected.",
                      );
                    })
                  }
                >
                  <Upload size={17} /> Select Takeout ZIP archives
                </button>
              </section>
              {status?.imports.map((job) => (
                <section className="gl-panel gl-import" key={job.id}>
                  <h3>{job.name}</h3>
                  <p role="status">
                    {importProgress(job)} · {job.status}
                  </p>
                  {job.bytes !== undefined && job.status === "running" && (
                    <p>{bytes(job.bytes)} read from current file</p>
                  )}
                  {job.error && (
                    <p className="gl-error">
                      {storageError({ code: job.error })}
                    </p>
                  )}
                  <div className="gl-actions">
                    {["selected", "paused", "failed"].includes(job.status) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            if (
                              !confirm(
                                "Import original media from this archive into Android media storage? Existing files will not be overwritten.",
                              )
                            )
                              return;
                            await R2.controlTakeoutImport({
                              id: job.id,
                              action: "start",
                            });
                          })
                        }
                      >
                        {job.status === "selected"
                          ? "Start import"
                          : "Resume import"}
                      </button>
                    )}
                    {["queued", "running"].includes(job.status) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            R2.controlTakeoutImport({
                              id: job.id,
                              action: "pause",
                            }),
                          )
                        }
                      >
                        Pause after current operation
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}
      {viewer && (
        <PhotoViewer
          selected={viewer.item.id}
          onSelect={() => {}}
          onClose={closeViewer}
          onWhatsApp={async () => {
            if (viewer.clip || !token.current)
              throw new Error(
                "Open the original to share the full file in WhatsApp.",
              );
            await systemAction(() =>
              R2.shareGalleryPreview({
                token: token.current,
                target: "whatsapp",
              }),
            );
          }}
          onShare={async () => {
            if (viewer.clip)
              throw new Error(
                "Open the original from this file’s details to share the full video.",
              );
            if (!token.current)
              throw new Error("Open the original before sharing.");
            await systemAction(() =>
              R2.shareGalleryPreview({ token: token.current }),
            );
          }}
          onDownload={async () => {
            await systemAction(() =>
              R2.downloadLibraryOriginal({ session, id: viewer.item.id }),
            );
          }}
          items={[
            {
              id: viewer.item.id,
              url: viewer.url,
              kind: viewer.item.kind,
              place: viewer.item.name,
              category: viewer.clip
                ? "Separate preview · up to 15 seconds · 720p"
                : "Original quality",
              caption: viewer.clip
                ? "The original is retained separately."
                : `${bytes(viewer.item.size)} · encrypted private storage`,
            },
          ]}
        />
      )}
    </main>
  );
}
