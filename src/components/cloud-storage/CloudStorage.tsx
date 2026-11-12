"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Cloud,
  ShieldCheck,
  KeyRound,
  Upload,
  Download,
  Search,
  Grid2X2,
  List,
  X,
  Check,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Film,
  File,
  ArrowUpRight,
  Copy,
  FolderOpen,
  Pause,
  Play,
  LockKeyhole,
} from "lucide-react";
import {
  R2,
  bytes,
  nativeR2Available,
  storageError,
  systemAction,
} from "@/lib/r2/native";
import type {
  BucketSlot,
  CloudObject,
  ConfigurationInput,
  MediaPlacement,
  ObjectMetadata,
  PublicMediaCatalog,
  SelectedMedia,
  StorageSummary,
  Transfer,
} from "@/lib/r2/types";
import "./cloud-storage.css";
const sections = [
  "Library",
  "Transfers",
  "Connections",
  "Recovery",
  "Publish",
] as const;
type Section = (typeof sections)[number];
const completed = new Set(["complete", "cancelled"]);
const placements: MediaPlacement[] = [
  "destination",
  "expedition",
  "gallery",
  "memory",
  "cinematic",
  "music-artwork",
  "atlas-visual",
];
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="r2-dialog"
      aria-label={title}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button type="button" aria-label="Close media details" onClick={close}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function ConfigurationForm({
  slot,
  summary,
  run,
}: {
  slot: BucketSlot;
  summary: StorageSummary | null;
  run: (label: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  const saved = summary?.[slot];
  const [account, setAccount] = useState("");
  const [override, setOverride] = useState(false);
  const id =
    account ||
    saved?.accountId ||
    summary?.[slot === "public" ? "private" : "public"]?.accountId ||
    "";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: ConfigurationInput = {
      slot,
      accountId: id,
      endpoint: override ? String(data.get("endpoint") || "") : "",
      bucket: String(data.get("bucket")),
      publicBaseUrl: slot === "public" ? String(data.get("base") || "") : "",
      accessKeyId: String(data.get("access") || ""),
      secretAccessKey: String(data.get("secret") || ""),
    };
    // These fields are deliberately uncontrolled and are never persisted in React or a browser store.
    for (const name of ["access", "secret"]) {
      const field = form.elements.namedItem(name) as HTMLInputElement;
      field.value = "";
    }
    await run("Save bucket configuration", async () => {
      try {
        await systemAction(() => R2.saveConfiguration(input));
      } finally {
        input.accessKeyId = "";
        input.secretAccessKey = "";
        data.delete("access");
        data.delete("secret");
      }
    });
  }
  return (
    <form className="r2-connection-form" onSubmit={save} autoComplete="off">
      <header>
        <span className={`r2-bucket-dot ${slot}`} />
        <div>
          <h3>{slot === "public" ? "Public media" : "Private originals"}</h3>
          <p>
            {slot === "public"
              ? "Explicit public copies and the website catalog."
              : "Authenticated encryption before any bytes leave Android."}
          </p>
        </div>
        <span className="r2-badge">
          {saved?.configured ? "Saved on device" : "Not configured"}
        </span>
      </header>
      <label>
        Cloudflare Account ID
        <input
          name="account"
          value={id}
          onChange={(e) => setAccount(e.target.value.trim())}
          required
          pattern="[a-fA-F0-9]{32}"
          maxLength={32}
          spellCheck={false}
          autoCapitalize="none"
        />
      </label>
      <div className="r2-endpoint">
        <span>R2 S3 endpoint</span>
        <code>
          {override
            ? "Enter a supported jurisdiction endpoint below"
            : id
              ? `https://${id}.r2.cloudflarestorage.com`
              : "Derived from your Account ID"}
        </code>
        <label className="r2-check">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
          />
          Use a jurisdiction endpoint
        </label>
      </div>
      {override && (
        <label>
          Endpoint override
          <input
            name="endpoint"
            type="url"
            defaultValue={saved?.endpoint}
            placeholder="https://account.eu.r2.cloudflarestorage.com"
            required
          />
        </label>
      )}
      <label>
        {slot === "public" ? "Public" : "Private"} Bucket Name
        <input
          key={saved?.revision ?? slot}
          name="bucket"
          defaultValue={saved?.bucket || `life-atlas-${slot}`}
          required
        />
      </label>
      <div className="r2-form-pair">
        <label>
          {slot === "public" ? "Public" : "Private"} Access Key ID
          <input
            name="access"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="none"
            required
            minLength={8}
            maxLength={256}
          />
        </label>
        <label>
          {slot === "public" ? "Public" : "Private"} Secret Access Key
          <input
            name="secret"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="none"
            required
            minLength={16}
            maxLength={512}
          />
        </label>
      </div>
      {slot === "public" && (
        <label>
          Public Media Base URL
          <input
            name="base"
            type="url"
            defaultValue={saved?.publicBaseUrl}
            placeholder="https://media.your-domain.com"
          />
          <small>
            Your public custom domain or r2.dev URL. The S3 endpoint is not a
            public media URL.
          </small>
        </label>
      )}
      <p className="r2-note">
        {saved?.configured
          ? "To rotate or replace a token, enter both new keys. Saved keys are never returned to this form."
          : "Use an object read/write token scoped only to this bucket."}{" "}
        Android device verification is required.
      </p>
      <footer>
        <button className="r2-primary" type="submit">
          <KeyRound size={16} />
          {saved?.configured ? "Replace credentials" : "Save configuration"}
        </button>
        {saved?.configured && (
          <button
            type="button"
            className="r2-danger"
            onClick={() => {
              if (
                window.confirm(
                  `Disconnect ${saved.bucket}? Existing remote objects and local originals remain. Finish or cancel its transfers first.`,
                )
              )
                void run("Disconnect bucket", () =>
                  systemAction(() => R2.disconnectBucket({ slot })),
                );
            }}
          >
            Disconnect bucket
          </button>
        )}
      </footer>
    </form>
  );
}
export default function CloudStorage() {
  const native = nativeR2Available();
  const [section, setSection] = useState<Section>("Connections"),
    [summary, setSummary] = useState<StorageSummary | null>(null),
    [transfers, setTransfers] = useState<Transfer[]>([]);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [connection, setConnection] = useState<Record<BucketSlot, string>>({
      public: "Not tested",
      private: "Not tested",
    });
  const [slot, setSlot] = useState<BucketSlot>("public"),
    [pages, setPages] = useState<Record<BucketSlot, CloudObject[]>>({
      public: [],
      private: [],
    }),
    [cursor, setCursor] = useState(""),
    [allLoaded, setAllLoaded] = useState(false),
    [prefix, setPrefix] = useState("");
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("Newest"),
    [type, setType] = useState("All media"),
    [layout, setLayout] = useState<"grid" | "list">("grid"),
    [selected, setSelected] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<SelectedMedia[]>([]),
    [thumbs, setThumbs] = useState<Record<string, string>>({}),
    [consent, setConsent] = useState(false),
    [strip, setStrip] = useState(false);
  const [detail, setDetail] = useState<CloudObject | null>(null),
    [metadata, setMetadata] = useState<ObjectMetadata | null>(null),
    [preview, setPreview] = useState("");
  const [catalog, setCatalog] = useState<PublicMediaCatalog | null>(null),
    [websiteUrl, setWebsiteUrl] = useState(""),
    [catalogUrl, setCatalogUrl] = useState(""),
    [publishing, setPublishing] = useState<Transfer | null>(null);
  const [price, setPrice] = useState("0.015");
  const mounted = useRef(true),
    actionLock = useRef(false);
  const refresh = useCallback(async () => {
    if (!native) return;
    const [config, progress] = await Promise.all([
      R2.getConfigurationSummary(),
      R2.getTransferProgress(),
    ]);
    if (!mounted.current) return;
    setSummary(config);
    setTransfers(progress.transfers.sort((a, b) => b.createdAt - a.createdAt));
  }, [native]);
  useEffect(() => {
    mounted.current = true;
    if (!native) return;
    void R2.setSensitiveScreen({ enabled: true });
    void refresh().catch((e) => setError(storageError(e)));
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !actionLock.current)
        void R2.getTransferProgress()
          .then((result) => {
            if (mounted.current)
              setTransfers(
                result.transfers.sort((a, b) => b.createdAt - a.createdAt),
              );
          })
          .catch(() => {});
    }, 1800);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      void R2.setSensitiveScreen({ enabled: false });
    };
  }, [native, refresh]);
  const run = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      if (actionLock.current) return;
      actionLock.current = true;
      setBusy(label);
      setError("");
      setMessage("");
      try {
        await action();
        if (mounted.current) setMessage(`${label} complete.`);
      } catch (e) {
        if (mounted.current) setError(storageError(e));
      } finally {
        actionLock.current = false;
        if (mounted.current) {
          setBusy("");
          try {
            await refresh();
          } catch (e) {
            setError(storageError(e));
          }
        }
      }
    },
    [refresh],
  );
  const jobsByKey = useMemo(
    () =>
      new Map(
        transfers
          .filter((t) => t.slot === slot && t.direction === "upload")
          .map((t) => [t.key, t]),
      ),
    [transfers, slot],
  );
  function mediaKind(object: CloudObject) {
    const mime = jobsByKey.get(object.key)?.mimeType ?? "";
    return mime.startsWith("image/") ||
      /\.(jpe?g|png|webp|avif|heic|heif|dng|cr2|nef)$/i.test(object.key) ||
      object.key.startsWith("encrypted/photos/")
      ? "Images"
      : mime.startsWith("video/") ||
          /\.(mp4|mov|webm)$/i.test(object.key) ||
          object.key.startsWith("encrypted/videos/")
        ? "Videos"
        : "Other";
  }
  const items = pages[slot]
    .filter(
      (object) =>
        !object.key.startsWith("atlas/catalog/") &&
        `${object.key} ${jobsByKey.get(object.key)?.name ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (type === "All media" || mediaKind(object) === type),
    )
    .sort((a, b) =>
      sort === "Name"
        ? (jobsByKey.get(a.key)?.name ?? a.key).localeCompare(
            jobsByKey.get(b.key)?.name ?? b.key,
          )
        : sort === "Size"
          ? b.size - a.size
          : b.modifiedAt.localeCompare(a.modifiedAt),
    );
  async function list(target: BucketSlot, more = false) {
    const page = await R2.listObjects({
      slot: target,
      prefix,
      cursor: more ? cursor : "",
    });
    setPages((old) => ({
      ...old,
      [target]: more ? [...old[target], ...page.objects] : page.objects,
    }));
    setCursor(page.cursor);
    setAllLoaded(page.complete);
    setSelected(new Set());
  }
  async function choose(picker: "photos" | "documents") {
    const result = await systemAction(() => R2.pickMedia({ picker }));
    setPicks(result.files);
    setConsent(false);
    setThumbs({});
    for (const file of result.files.filter((f) =>
      f.mimeType.startsWith("image/"),
    )) {
      try {
        const image = await R2.getSelectionPreview({ id: file.id });
        if (mounted.current)
          setThumbs((old) => ({ ...old, [file.id]: image.thumbnail }));
      } catch {
        /* The original remains selectable when no decoder exists. */
      }
    }
  }
  async function loadCatalog() {
    const result = await R2.getPublicCatalog();
    setCatalog(result.catalog);
    setCatalogUrl(result.catalogUrl);
    setWebsiteUrl(result.websiteUrl);
  }
  const pending = transfers.filter((t) => !completed.has(t.status));
  const stored = {
    public: pages.public.reduce((sum, item) => sum + item.size, 0),
    private: pages.private.reduce((sum, item) => sum + item.size, 0),
  };
  if (!native)
    return (
      <section className="r2-shell r2-unavailable">
        <Cloud size={45} />
        <p className="r2-eyebrow">ANDROID / NATIVE CLOUD STORAGE</p>
        <h2>Your cloud. Your device.</h2>
        <p>
          Configure Cloudflare R2 in the installed Life Atlas Android app, under
          Control Room → Cloud Storage. Credentials are accepted only by the
          bundled native app.
        </p>
        <p>
          The public website can browse explicitly published media without
          receiving either bucket’s keys. Existing offline vaults continue
          working independently.
        </p>
      </section>
    );
  return (
    <section className="r2-shell" aria-label="Cloudflare R2 storage">
      <header className="r2-intro">
        <div>
          <p className="r2-eyebrow">CONTROL ROOM / CLOUDFLARE R2</p>
          <h2>
            Originals, <em>without compromise.</em>
          </h2>
          <p>
            Direct from Android to your buckets. Local first. Private by design.
          </p>
        </div>
        <span className="r2-native">
          <ShieldCheck size={16} />
          Native signing · Original bytes
        </span>
      </header>
      <div className="r2-bucket-strip">
        {(["public", "private"] as BucketSlot[]).map((bucket) => (
          <button
            key={bucket}
            className={slot === bucket ? "active" : ""}
            onClick={() => {
              setSlot(bucket);
              setCursor("");
              setSelected(new Set());
              setAllLoaded(false);
              setPrefix("");
            }}
          >
            <span className={`r2-bucket-dot ${bucket}`} />
            <div>
              <strong>
                {summary?.[bucket].bucket ?? `life-atlas-${bucket}`}
              </strong>
              <small>
                {summary?.[bucket].configured
                  ? connection[bucket]
                  : "Not configured"}
              </small>
            </div>
            {bucket === "private" ? (
              <LockKeyhole size={19} />
            ) : (
              <Cloud size={19} />
            )}
          </button>
        ))}
      </div>
      <nav className="r2-tabs" aria-label="Cloud Storage views">
        {sections.map((value) => (
          <button
            key={value}
            aria-current={section === value ? "page" : undefined}
            onClick={() => {
              setSection(value);
              setError("");
            }}
          >
            {value}
            {value === "Transfers" && pending.length > 0 && (
              <small>{pending.length}</small>
            )}
          </button>
        ))}
      </nav>
      {busy && (
        <p className="r2-status" role="status">
          <RefreshCw className="r2-spin" size={16} />
          {busy}…
        </p>
      )}
      {error && (
        <div className="r2-alert" role="alert">
          <span>{error}</span>
          <button
            aria-label="Dismiss storage error"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {message && !busy && (
        <p className="r2-status" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      <fieldset disabled={!!busy} className="r2-workspace">
        {section === "Connections" && (
          <>
            <div className="r2-section-heading">
              <h3>Two buckets. Two boundaries.</h3>
              <p>
                Saved keys never leave the native storage layer. New credentials
                take effect without rebuilding the app.
              </p>
            </div>
            <div className="r2-connections">
              {(["public", "private"] as BucketSlot[]).map((bucket) => (
                <div key={bucket}>
                  <ConfigurationForm
                    slot={bucket}
                    summary={summary}
                    run={run}
                  />
                  <button
                    className="r2-test"
                    disabled={!summary?.[bucket].configured}
                    onClick={() =>
                      void run(`Test ${bucket} connection`, async () => {
                        setConnection((old) => ({
                          ...old,
                          [bucket]: "Connecting",
                        }));
                        try {
                          await systemAction(() =>
                            R2.testConnection({ slot: bucket }),
                          );
                          setConnection((old) => ({
                            ...old,
                            [bucket]: "Connected · checksum verified",
                          }));
                        } catch (e) {
                          setConnection((old) => ({
                            ...old,
                            [bucket]: "Connection failed",
                          }));
                          throw e;
                        }
                      })
                    }
                  >
                    <RefreshCw size={16} />
                    Test {bucket} connection
                  </button>
                </div>
              ))}
            </div>
            <p className="r2-note">
              Connection tests run only on request: bucket access, unique
              synthetic upload, SHA-256 readback, then deletion of that test
              object. No user object is overwritten. Keystore hardware backing:{" "}
              {summary?.hardwareBacked
                ? "verified by Android on this device"
                : "not reported; no hardware-backed claim"}
              .
            </p>
          </>
        )}
        {section === "Library" && (
          <>
            <div className="r2-library-stats">
              <article>
                <span>PUBLIC / LOADED OBJECTS</span>
                <strong>{bytes(stored.public)}</strong>
              </article>
              <article>
                <span>PRIVATE / LOADED OBJECTS</span>
                <strong>{bytes(stored.private)}</strong>
              </article>
              <article>
                <span>THIS VIEW</span>
                <strong>
                  {items.length}
                  <small> objects</small>
                </strong>
              </article>
              <article>
                <span>STORAGE ESTIMATE / MONTH</span>
                <strong>
                  $
                  {(
                    ((stored.public + stored.private) / 1e9) *
                    Math.max(0, Number(price) || 0)
                  ).toFixed(4)}
                </strong>
              </article>
            </div>
            <div className="r2-price">
              <label>
                Illustrative USD per GB/month{" "}
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </label>
              <small>
                Uses loaded object bytes only. Excludes operations, tier
                differences, allowances and tax. R2 has no fixed bucket quota.
              </small>
            </div>
            <div className="r2-library-actions">
              <div>
                <button
                  className="r2-primary"
                  disabled={!summary?.[slot].configured}
                  onClick={() =>
                    void run("Select original media", () => choose("photos"))
                  }
                >
                  <ImageIcon size={16} />
                  Photo picker
                </button>
                <button
                  className="r2-secondary"
                  disabled={!summary?.[slot].configured}
                  onClick={() =>
                    void run("Select original files", () => choose("documents"))
                  }
                >
                  <FolderOpen size={16} />
                  Document picker
                </button>
              </div>
              <button
                className="r2-secondary"
                disabled={!summary?.[slot].configured}
                onClick={() => void run("Refresh library", () => list(slot))}
              >
                <RefreshCw size={16} />
                Browse {slot} bucket
              </button>
            </div>
            {picks.length > 0 && (
              <div className="r2-upload-review">
                <header>
                  <h3>{picks.length} originals selected</h3>
                  <button
                    aria-label="Clear selected originals"
                    onClick={() => {
                      setPicks([]);
                      setThumbs({});
                    }}
                  >
                    <X size={18} />
                  </button>
                </header>
                <div className="r2-picks">
                  {picks.map((file) => (
                    <article key={file.id}>
                      {thumbs[file.id] ? (
                        <img
                          src={thumbs[file.id]}
                          alt={`Preview of ${file.name}`}
                        />
                      ) : file.mimeType.startsWith("video/") ? (
                        <Film size={26} />
                      ) : (
                        <File size={26} />
                      )}
                      <div>
                        <strong>{file.name}</strong>
                        <small>
                          {bytes(file.size)} · {file.mimeType}
                        </small>
                        {!file.persistent && (
                          <small>
                            Reselect with a document provider that allows
                            lasting access.
                          </small>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <p>
                  {slot === "public"
                    ? "Public bucket copies are accessible to anyone with their URL. Filenames, EXIF, timestamps and embedded locations can disclose personal information. Catalog publication is a separate explicit step."
                    : "Private uploads are encrypted locally using Tink. They remain private and never appear in the website catalog."}
                </p>
                {slot === "public" && (
                  <label className="r2-check">
                    <input
                      type="checkbox"
                      checked={strip}
                      onChange={(e) => setStrip(e.target.checked)}
                    />
                    Remove sensitive EXIF/XMP from this public copy (JPEG, PNG,
                    WebP; no pixel re-encoding)
                  </label>
                )}
                <label className="r2-check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {slot === "public"
                    ? "I approve uploading these separate public copies and understand their metadata exposure."
                    : "I approve encrypted private uploads. I have verified my recovery kit."}
                </label>
                <button
                  className="r2-primary"
                  disabled={
                    !consent ||
                    (slot === "private" && !summary?.recoveryVerified) ||
                    picks.some((file) => !file.persistent)
                  }
                  onClick={() =>
                    void run("Queue original uploads", async () => {
                      for (const file of picks)
                        await systemAction(() =>
                          R2.uploadObject({
                            slot,
                            selectionId: file.id,
                            stripMetadata: slot === "public" && strip,
                          }),
                        );
                      setPicks([]);
                      setThumbs({});
                      setSection("Transfers");
                    })
                  }
                >
                  <Upload size={16} />
                  Queue {slot} uploads
                </button>
                {slot === "private" && !summary?.recoveryVerified && (
                  <button
                    className="r2-link"
                    onClick={() => setSection("Recovery")}
                  >
                    Set up recovery first <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            )}
            <form
              className="r2-prefix"
              onSubmit={(e) => {
                e.preventDefault();
                void run("Open prefix", () => list(slot));
              }}
            >
              <label>
                <FolderOpen size={16} />
                <span className="sr-only">Object prefix</span>
                <input
                  placeholder={
                    slot === "private" ? "encrypted/photos/" : "galleries/"
                  }
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                />
              </label>
              <button
                className="r2-secondary"
                disabled={!summary?.[slot].configured}
              >
                Open folder prefix
              </button>
            </form>
            <div className="r2-toolbar">
              <label className="r2-search">
                <Search size={16} />
                <input
                  aria-label="Search loaded cloud media"
                  placeholder="Search loaded names and keys"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter cloud file type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {["All media", "Images", "Videos", "Other"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <select
                aria-label="Sort loaded cloud media"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {["Newest", "Name", "Size"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <button
                aria-label="Grid view"
                aria-pressed={layout === "grid"}
                onClick={() => setLayout("grid")}
              >
                <Grid2X2 size={17} />
              </button>
              <button
                aria-label="List view"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
              >
                <List size={17} />
              </button>
            </div>
            {selected.size > 0 && (
              <div className="r2-selection-bar">
                <span>{selected.size} selected</span>
                <button
                  className="r2-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Permanently delete ${selected.size} selected R2 objects? This does not delete local originals. Published items must be unpublished first.`,
                      )
                    )
                      void run("Delete selected cloud objects", async () => {
                        await systemAction(() =>
                          R2.deleteObjects({ slot, keys: [...selected] }),
                        );
                        await list(slot);
                      });
                  }}
                >
                  <Trash2 size={16} />
                  Delete selected
                </button>
                <button onClick={() => setSelected(new Set())}>
                  Clear selection
                </button>
              </div>
            )}
            <div className={`r2-media ${layout}`}>
              {items.map((object) => {
                const job = jobsByKey.get(object.key),
                  kind = mediaKind(object);
                return (
                  <article key={object.key}>
                    <label className="r2-select">
                      <input
                        aria-label={`Select ${job?.name ?? object.key}`}
                        type="checkbox"
                        checked={selected.has(object.key)}
                        onChange={(e) =>
                          setSelected((old) => {
                            const next = new Set(old);
                            if (e.target.checked) next.add(object.key);
                            else next.delete(object.key);
                            return next;
                          })
                        }
                      />
                    </label>
                    <button
                      className="r2-media-open"
                      onClick={() => {
                        setDetail(object);
                        setPreview("");
                        setMetadata(null);
                        void run("Read object details", async () =>
                          setMetadata(
                            await R2.getObjectMetadata({
                              slot,
                              key: object.key,
                            }),
                          ),
                        );
                      }}
                    >
                      <div className="r2-media-placeholder">
                        {slot === "public" && job?.thumbnailUrl && (
                          <img
                            src={job.thumbnailUrl}
                            alt={`Thumbnail of ${job.name}`}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        {kind === "Images" ? (
                          <ImageIcon />
                        ) : kind === "Videos" ? (
                          <Film />
                        ) : (
                          <File />
                        )}
                        <span>
                          {slot === "private"
                            ? "ENCRYPTED ORIGINAL"
                            : "ORIGINAL MEDIA"}
                        </span>
                      </div>
                      <div>
                        <h4>{job?.name ?? object.key.split("/").at(-1)}</h4>
                        <p>
                          {bytes(object.size)} ·{" "}
                          {new Date(object.modifiedAt).toLocaleDateString()}
                        </p>
                        <small>{object.key}</small>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
            {items.length === 0 && (
              <div className="r2-empty">
                <Cloud size={36} />
                <h3>No media in this view.</h3>
                <p>
                  Browse your bucket, choose a prefix, or queue original files.
                  Nothing is uploaded automatically.
                </p>
              </div>
            )}
            <footer className="r2-library-foot">
              <span>
                {pages[slot].length} loaded objects ·{" "}
                {allLoaded
                  ? "All pages loaded"
                  : "Page totals; not the complete bucket"}
                . Previews load only on request.
              </span>
              {cursor && (
                <button
                  className="r2-secondary"
                  onClick={() =>
                    void run("Load next media page", () => list(slot, true))
                  }
                >
                  Load next 100 objects
                </button>
              )}
            </footer>
          </>
        )}
        {section === "Transfers" && (
          <>
            <div className="r2-section-heading">
              <h3>A queue that respects originals.</h3>
              <p>
                One foreground transfer at a time. Large uploads use persisted
                multipart parts. Android may stop background work; resume
                supported jobs here. Connectivity is required only for cloud
                operations.
              </p>
            </div>
            {transfers.length === 0 && (
              <div className="r2-empty">
                <Upload size={36} />
                <h3>Your queue is clear.</h3>
                <button
                  className="r2-secondary"
                  onClick={() => setSection("Library")}
                >
                  Select originals
                </button>
              </div>
            )}
            <div className="r2-transfers">
              {transfers.map((transfer) => {
                const total = transfer.totalBytes || transfer.size || 0,
                  sent = transfer.uploadedBytes || 0;
                return (
                  <article key={transfer.id}>
                    <div className="r2-transfer-icon">
                      {transfer.slot === "private" ? (
                        <LockKeyhole size={22} />
                      ) : (
                        <Upload size={22} />
                      )}
                    </div>
                    <div>
                      <header>
                        <strong>{transfer.name}</strong>
                        <span className={`r2-state ${transfer.status}`}>
                          {transfer.status}
                        </span>
                      </header>
                      <p>
                        {transfer.slot} · {transfer.direction} · {bytes(sent)} /{" "}
                        {bytes(total)}
                        {transfer.speed
                          ? ` · ${bytes(transfer.speed)}/s · ~${transfer.eta ?? 0}s left`
                          : ""}
                      </p>
                      <progress
                        value={transfer.verified ? total || 1 : sent}
                        max={total || 1}
                        aria-label={`${transfer.name} progress`}
                      />
                      {transfer.error && (
                        <p className="r2-transfer-error">
                          {storageError({ code: transfer.error })}
                        </p>
                      )}
                      {transfer.verified && (
                        <small>
                          <Check size={12} />
                          SHA-256 verified
                          {transfer.slot === "private"
                            ? " · Encrypted remote object"
                            : " · Public copy"}
                        </small>
                      )}
                    </div>
                    <div className="r2-transfer-actions">
                      {[
                        "queued",
                        "preparing",
                        "uploading",
                        "downloading",
                        "verifying",
                      ].includes(transfer.status) && (
                        <button
                          aria-label={`Pause ${transfer.name}`}
                          onClick={() =>
                            void run("Pause transfer", () =>
                              R2.pauseTransfer({ id: transfer.id }),
                            )
                          }
                        >
                          <Pause size={17} />
                        </button>
                      )}
                      {["paused", "failed", "interrupted"].includes(
                        transfer.status,
                      ) && (
                        <button
                          aria-label={`Resume ${transfer.name}`}
                          onClick={() =>
                            void run("Resume transfer", () =>
                              systemAction(() =>
                                R2.resumeTransfer({ id: transfer.id }),
                              ),
                            )
                          }
                        >
                          <Play size={17} />
                        </button>
                      )}
                      {!completed.has(transfer.status) && (
                        <button
                          className="r2-danger"
                          aria-label={`Cancel ${transfer.name}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Cancel this transfer and abort its pending multipart upload? Local originals remain unchanged. Internet is required to confirm remote cleanup.",
                              )
                            )
                              void run("Cancel transfer", () =>
                                systemAction(() =>
                                  R2.cancelTransfer({ id: transfer.id }),
                                ),
                              );
                          }}
                        >
                          <X size={17} />
                        </button>
                      )}
                      {transfer.status === "complete" &&
                        transfer.slot === "public" &&
                        transfer.direction === "upload" && (
                          <button
                            className="r2-link"
                            onClick={() => setPublishing(transfer)}
                          >
                            Publish to Website <ArrowUpRight size={14} />
                          </button>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {section === "Recovery" && (
          <div className="r2-recovery">
            <button
              type="button"
              className="r2-danger r2-reset"
              onClick={() => {
                if (
                  window.confirm(
                    "Reset only unreadable R2 credential storage? Re-enter both tokens and restore your independently saved recovery kit afterward. Remote objects remain untouched. Lost multipart sessions may need cleanup in Cloudflare. Readable storage will not be reset.",
                  )
                )
                  void run("Reset unavailable Keystore", () =>
                    systemAction(() => R2.resetUnavailableKeystore()),
                  );
              }}
            >
              Reset unavailable credential storage
            </button>
            <div className="r2-recovery-art">
              <LockKeyhole size={64} />
              <p className="r2-eyebrow">INDEPENDENT OF YOUR PHONE</p>
              <h3>
                Keep the key.
                <br />
                <em>Keep the memories.</em>
              </h3>
              <p>
                Android Keystore keys do not travel to a new device. Your
                passphrase-encrypted recovery kit contains the separate
                streaming-encryption key, and no R2 credentials.
              </p>
              <span className="r2-badge">
                {summary?.recoveryVerified
                  ? "Recovery kit verified"
                  : "Private uploads disabled until verified"}
              </span>
            </div>
            <div>
              <ol>
                <li>Use a unique passphrase of at least 16 characters.</li>
                <li>
                  Export the encrypted recovery kit through Android’s document
                  picker. Save it somewhere independent of this phone.
                </li>
                <li>
                  Reopen the saved kit with its passphrase to test restoration.
                  Only then are private uploads enabled.
                </li>
                <li>
                  On a new phone, configure the private bucket and import the
                  same kit. Do not lose both the kit and its passphrase.
                </li>
              </ol>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    input = form.elements.namedItem(
                      "passphrase",
                    ) as HTMLInputElement;
                  const passphrase = input.value;
                  input.value = "";
                  void run("Export recovery kit", () =>
                    systemAction(() => R2.createRecoveryKit({ passphrase })),
                  );
                }}
              >
                <label>
                  Recovery passphrase
                  <input
                    name="passphrase"
                    type="password"
                    autoComplete="new-password"
                    minLength={16}
                    maxLength={1024}
                    required
                  />
                </label>
                <button className="r2-primary">
                  <Download size={16} />
                  Create / export recovery kit
                </button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem(
                    "passphrase",
                  ) as HTMLInputElement;
                  const passphrase = input.value;
                  input.value = "";
                  void run("Verify / restore recovery kit", () =>
                    systemAction(() => R2.restoreRecoveryKit({ passphrase })),
                  );
                }}
              >
                <label>
                  Saved kit’s passphrase
                  <input
                    name="passphrase"
                    type="password"
                    autoComplete="off"
                    minLength={16}
                    maxLength={1024}
                    required
                  />
                </label>
                <button className="r2-secondary">
                  <KeyRound size={16} />
                  Verify / restore saved kit
                </button>
              </form>
              <p className="r2-note">
                Key fingerprint: {summary?.keyId || "Not created"}. A different
                kit never silently replaces an existing key. Automatic private
                vault backups remain disabled; this integration uploads only
                files you explicitly choose.
              </p>
            </div>
          </div>
        )}
        {section === "Publish" && (
          <>
            <div className="r2-section-heading">
              <h3>
                Private by default.
                <br />
                Public by choice.
              </h3>
              <p>
                Only verified, separately uploaded public copies can enter the
                website catalog. No private key, private URL or private original
                enters the manifest.
              </p>
            </div>
            <button
              className="r2-secondary"
              disabled={!summary?.public.configured}
              onClick={() => void run("Read public catalog", loadCatalog)}
            >
              <RefreshCw size={16} />
              Read public catalog
            </button>
            {websiteUrl && (
              <div className="r2-published-link">
                <p>
                  Share this catalog-enabled website link. Visitors keep the
                  public source URL in their browser; new publications appear
                  without a rebuild.
                </p>
                <a href={websiteUrl} target="_blank" rel="noreferrer">
                  Open published website <ArrowUpRight size={16} />
                </a>
                <button
                  onClick={() =>
                    void run("Copy website link", () =>
                      navigator.clipboard.writeText(websiteUrl),
                    )
                  }
                >
                  <Copy size={16} />
                  Copy website link
                </button>
                <code>{catalogUrl}</code>
                <small>
                  The canonical website needs a public catalog source to
                  discover this bucket. The generated link supplies it without
                  any R2 secrets or backend configuration.
                </small>
              </div>
            )}
            <div className="r2-publish-list">
              {transfers
                .filter(
                  (t) =>
                    t.slot === "public" &&
                    t.direction === "upload" &&
                    t.verified,
                )
                .map((transfer) => (
                  <article key={transfer.id}>
                    <ImageIcon size={24} />
                    <div>
                      <strong>{transfer.name}</strong>
                      <small>
                        {bytes(transfer.totalBytes)} · Verified public copy
                      </small>
                    </div>
                    <button
                      className="r2-primary"
                      onClick={() => setPublishing(transfer)}
                    >
                      Publish to Website
                    </button>
                  </article>
                ))}
            </div>
            {catalog && (
              <div className="r2-publications">
                <h4>Published catalog · {catalog.items.length} items</h4>
                {catalog.items.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {item.category} / {item.collection || "Unsorted"}
                      </small>
                    </div>
                    <button
                      className="r2-danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Unpublish this item and delete its separate public object? Copies already cached or saved by others cannot be recalled. The private original stays private.",
                          )
                        )
                          void run("Unpublish media", async () => {
                            await systemAction(() =>
                              R2.unpublishMedia({ id: item.id }),
                            );
                            await loadCatalog();
                          });
                      }}
                    >
                      Unpublish
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </fieldset>
      {detail && (
        <Modal
          title={jobsByKey.get(detail.key)?.name ?? "Cloud object"}
          close={() => {
            setDetail(null);
            setMetadata(null);
            setPreview("");
          }}
        >
          <div className="r2-details">
            {preview && (
              <img src={preview} alt="On-request original media preview" />
            )}
            {metadata?.mimeType.startsWith("video/") &&
              slot === "public" &&
              summary?.public.publicBaseUrl && (
                <video
                  controls
                  preload="metadata"
                  src={`${summary.public.publicBaseUrl}/${detail.key.split("/").map(encodeURIComponent).join("/")}`}
                />
              )}
            <dl>
              <dt>Bucket</dt>
              <dd>{slot}</dd>
              <dt>Object key</dt>
              <dd>{detail.key}</dd>
              <dt>Stored bytes</dt>
              <dd>{bytes(detail.size)}</dd>
              <dt>Content type</dt>
              <dd>{metadata?.mimeType ?? "Reading metadata…"}</dd>
              <dt>Encryption</dt>
              <dd>
                {metadata?.encryption ||
                  (slot === "private"
                    ? "Check object metadata before restoring"
                    : "Public copy")}
              </dd>
              <dt>ETag</dt>
              <dd>{detail.etag}</dd>
              <dt>SHA-256</dt>
              <dd>
                {metadata?.sha256 ||
                  "Not recorded for this pre-existing object"}
              </dd>
            </dl>
            <div className="r2-details-actions">
              <button
                className="r2-secondary"
                disabled={!!busy}
                onClick={() =>
                  void run("Load preview", async () =>
                    setPreview(
                      (
                        await systemAction(() =>
                          R2.getObjectPreview({ slot, key: detail.key }),
                        )
                      ).thumbnail,
                    ),
                  )
                }
              >
                Load photo preview
              </button>
              <button
                className="r2-primary"
                disabled={!!busy}
                onClick={() =>
                  void run("Queue original download", () =>
                    systemAction(() =>
                      R2.downloadObject({
                        slot,
                        key: detail.key,
                        name:
                          jobsByKey.get(detail.key)?.name ??
                          "atlas-original.bin",
                      }),
                    ),
                  )
                }
              >
                <Download size={16} />
                Download original
              </button>
              {slot === "public" && summary?.public.publicBaseUrl && (
                <button
                  className="r2-secondary"
                  onClick={() =>
                    void run("Copy public URL", () =>
                      navigator.clipboard.writeText(
                        `${summary.public.publicBaseUrl}/${detail.key.split("/").map(encodeURIComponent).join("/")}`,
                      ),
                    )
                  }
                >
                  <Copy size={16} />
                  Copy public URL
                </button>
              )}
              {slot === "private" && (
                <button
                  className="r2-secondary"
                  disabled={!!busy}
                  onClick={() =>
                    void run("Prepare separate public copy", async () => {
                      const file = await systemAction(() =>
                        R2.createPublicCopy({ key: detail.key }),
                      );
                      setPicks([file]);
                      setThumbs({});
                      setSlot("public");
                      setConsent(false);
                      setDetail(null);
                      setSection("Library");
                    })
                  }
                >
                  Prepare public copy <ArrowUpRight size={16} />
                </button>
              )}
            </div>
            <p className="r2-note">
              Private previews decrypt on this device after Android
              authentication. Unsupported formats remain available as original
              downloads. Previews never modify an original.
            </p>
          </div>
        </Modal>
      )}
      {publishing && (
        <Modal title="Publish to Website" close={() => setPublishing(null)}>
          <form
            className="r2-publish-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void run("Publish public catalog", async () => {
                const result = await systemAction(() =>
                  R2.publishMedia({
                    transferId: publishing.id,
                    title: String(data.get("title")),
                    description: String(data.get("description")),
                    category: String(data.get("category")) as MediaPlacement,
                    collection: String(data.get("collection")),
                    tags: String(data.get("tags"))
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    acknowledgeMetadata: data.get("approve") === "on",
                  }),
                );
                setCatalog(result.catalog);
                setCatalogUrl(result.catalogUrl);
                setWebsiteUrl(result.websiteUrl);
                setPublishing(null);
                setSection("Publish");
              });
            }}
          >
            <p>
              <strong>{publishing.name}</strong> ·{" "}
              {bytes(publishing.totalBytes)} · Verified public copy
            </p>
            {publishing.publicUrl &&
              publishing.mimeType.startsWith("image/") && (
                <img
                  src={publishing.publicUrl}
                  alt={`Publishing preview of ${publishing.name}`}
                  loading="lazy"
                />
              )}
            {publishing.publicUrl &&
              publishing.mimeType.startsWith("video/") && (
                <video src={publishing.publicUrl} controls preload="metadata" />
              )}
            <label>
              Public title
              <input
                name="title"
                defaultValue={publishing.name}
                required
                maxLength={140}
              />
            </label>
            <label>
              Description
              <textarea name="description" maxLength={2000} rows={3} />
            </label>
            <label>
              Destination, expedition or gallery
              <input
                name="collection"
                maxLength={140}
                placeholder="e.g. Chopta / Himalayan journey"
              />
            </label>
            <div className="r2-form-pair">
              <label>
                Category
                <select name="category">
                  {placements.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Tags, separated by commas
                <input name="tags" placeholder="mountains, morning" />
              </label>
            </div>
            <p className="r2-public-warning">
              The file, title, description, collection, tags, type, size and
              publication date become public. EXIF/location metadata remains in
              the file unless you requested removal while creating this public
              copy. Previously shared copies cannot be recalled.
            </p>
            <label className="r2-check">
              <input name="approve" type="checkbox" required />I approve this
              public disclosure.
            </label>
            <button className="r2-primary" disabled={!!busy}>
              Publish this separate public copy <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
