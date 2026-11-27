"use client";
import Link from "next/link";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { appServiceUrl } from "@/lib/appNetwork";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  CompanionApps,
  supportsCompanionApps,
} from "@/lib/companion-apps/native";
import {
  parseCompanionManifest,
  type CompanionStatus,
} from "@/lib/companion-apps/catalogue";
import "./atlas-apps.css";
const shortcuts = registerPlugin<{
  pinModuleShortcut(options: { module: string }): Promise<{ supported: boolean; requested: boolean }>;
}>("AtlasPermissions");
const builtInApps = [
  { id: "finance", title: "Atlas Finance", description: "Your spending, shared expenses and monthly review." },
  { id: "music", title: "Atlas Music", description: "Your library, playlists and listening." },
  { id: "gallery", title: "Atlas Gallery", description: "Your photos, videos and familiar faces." },
] as const;
const size = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
export default function AtlasApps() {
  const native = useSyncExternalStore(
    () => () => {},
    supportsCompanionApps,
    () => false,
  );
  const [shortcutNotice, setShortcutNotice] = useState("");
  const [pinning, setPinning] = useState("");
  async function pin(module: string) {
    setPinning(module);
    setShortcutNotice("");
    try {
      const result = await shortcuts.pinModuleShortcut({ module });
      setShortcutNotice(result.requested
        ? "Confirm the shortcut on your home screen."
        : "Open your app drawer and drag the Atlas app icon to your home screen.");
    } catch {
      setShortcutNotice("This Atlas version cannot add the shortcut yet. You can still open it here.");
    } finally { setPinning(""); }
  }
  const [busy, setBusy] = useState(false),
    [checked, setChecked] = useState(false);
  const [status, setStatus] = useState<CompanionStatus>(),
    [error, setError] = useState("");
  const working =
    busy ||
    ["checking", "downloading", "verifying"].includes(status?.phase || "");
  const alive = useRef(false),
    controller = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    if (supportsCompanionApps())
      void CompanionApps.getStatus()
        .then((s) => {
          if (alive.current) setStatus(s);
        })
        .catch(() => {
          if (alive.current)
            setError("App information is unavailable. Try again.");
        });
  }, []);
  useEffect(() => {
    alive.current = true;
    refresh();
    window.addEventListener("focus", refresh);
    const show = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", show);
    return () => {
      alive.current = false;
      controller.current?.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", show);
    };
  }, [refresh]);
  useEffect(() => {
    if (!native || !working) return;
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 650);
    return () => clearInterval(timer);
  }, [native, working, refresh]);
  async function run(task: () => Promise<CompanionStatus | void>) {
    if (working) return;
    setBusy(true);
    setError("");
    try {
      const s = await task();
      if (s && alive.current) setStatus(s);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Try again when you’re online.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const check = () =>
    run(async () => {
      if (native) {
        const s = await CompanionApps.check();
        setChecked(true);
        return s;
      }
      controller.current = new AbortController();
      const response = await fetch(appServiceUrl("/api/apps/catalog"), {
        signal: controller.current.signal,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Could not check apps.");
      const release = parseCompanionManifest(data);
      if (alive.current) setChecked(true);
      return {
        installed: false,
        installedCode: 0,
        installedVersion: "",
        phase: "idle",
        error: "",
        downloadedBytes: 0,
        release,
        ready: false,
        canInstall: false,
        wifiOnly: true,
      };
    });
  const release = status?.release,
    update = !!release && release.versionCode > (status?.installedCode || 0);
  return (
    <main className="atlas-apps">
      <Link className="apps-back" href="/secret">
        <ArrowLeft size={18} />
        Atlas
      </Link>
      <header>
        <span className="apps-eyebrow">MADE FOR YOUR EVERYDAY</span>
        <h1>
          Your Atlas.
          <br />
          Your apps.
        </h1>
        <p>
          Keep the things you love close. Choose the apps you want on your
          phone, or open them on the web.
        </p>
      </header>
      <section className="apps-built-in" aria-labelledby="built-in-title">
        <h2 id="built-in-title">One Atlas. Straight to what you need.</h2>
        <p>Open directly, with the same saved data and settings. No extra installation.</p>
        <div className="apps-module-list">
          {builtInApps.map((app) => (
            <article key={app.id}>
              <div><h3>{app.title}</h3><p>{app.description}</p></div>
              <div className="companion-actions">
                <Link href={`/secret/${app.id}`}>Open <ArrowUpRight size={16} /></Link>
                {native && Capacitor.isPluginAvailable("AtlasPermissions") && (
                  <button className="apps-secondary" disabled={!!pinning} onClick={() => void pin(app.id)}>
                    {pinning === app.id ? "Adding…" : "Add to home screen"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        <p role="status" className="apps-note">{shortcutNotice}</p>
      </section>
      <article className="companion-feature" aria-labelledby="video-app-title">
        <div className="companion-art" aria-hidden="true">
          <span className="companion-play">
            <Play fill="currentColor" size={48} />
          </span>
          <span className="companion-orbit" />
        </div>
        <div className="companion-copy">
          <span className="apps-eyebrow">WATCH YOUR WAY</span>
          <h2 id="video-app-title">Atlas Video</h2>
          <p>
            A quieter place to watch. A separate Android app, with no watch or
            search history saved by Atlas Video.
          </p>
          <div className="companion-status" role="status">
            {status?.installed
              ? `Installed · ${status.installedVersion}`
              : release
                ? `Version ${release.versionName} · ${size(release.bytes)}`
                : "Android companion · Web player"}
          </div>
          <div className="companion-actions">
            {native && status?.installed && (
              <button onClick={() => void run(() => CompanionApps.openApp())}>
                Open app <ArrowUpRight size={17} />
              </button>
            )}
            {native && status?.ready && update ? (
              <button
                disabled={working}
                onClick={() =>
                  void run(() => CompanionApps.install({ consent: true }))
                }
              >
                {status.canInstall
                  ? status.installed
                    ? "Install update"
                    : "Install Atlas Video"
                  : "Allow installation"}
                <Download size={17} />
              </button>
            ) : native && update ? (
              <button
                disabled={working}
                onClick={() =>
                  void run(() => CompanionApps.download({ consent: true }))
                }
              >
                {working
                  ? "Working…"
                  : status?.installed
                    ? "Download update"
                    : "Download app"}
                <Download size={17} />
              </button>
            ) : null}
            {!native && release && (
              <a href={release.url} target="_blank" rel="noopener noreferrer">
                Download Android APK <Download size={17} />
              </a>
            )}
            <Link className="apps-web" href="/secret/video">
              Open web player <ArrowUpRight size={17} />
            </Link>
            <button
              className="apps-secondary"
              disabled={working}
              onClick={() => void check()}
            >
              <RefreshCw size={16} />
              {working ? "Working…" : "Check Android release"}
            </button>
          </div>
          {working && status?.phase === "downloading" && release && (
            <div className="apps-transfer">
              <progress
                aria-label="Atlas Video download"
                value={status.downloadedBytes}
                max={release.bytes}
              />
              <span>
                {size(status.downloadedBytes)} / {size(release.bytes)}
              </span>
              <button
                onClick={() =>
                  void CompanionApps.cancel().catch(() =>
                    setError("Could not cancel; try again."),
                  )
                }
              >
                Cancel download
              </button>
            </div>
          )}
          {checked && !release && !error && !status?.error && (
            <p className="apps-note">
              The first signed Android release hasn’t been published yet. The
              web player is available here.
            </p>
          )}
          {(error || status?.error) && (
            <p role="alert" className="apps-error">
              {error || status?.error}
            </p>
          )}
          {native && (
            <label className="apps-wifi">
              <input
                type="checkbox"
                checked={status?.wifiOnly ?? true}
                disabled={working || !status}
                onChange={(e) =>
                  void run(() =>
                    CompanionApps.configure({ wifiOnly: e.target.checked }),
                  )
                }
              />
              Download on Wi-Fi only
            </label>
          )}
          {release && (
            <details>
              <summary>Release details</summary>
              <p>{release.notes || "Atlas Video for Android."}</p>
              <p>
                {size(release.bytes)} · {release.versionName}
              </p>
              <a
                href={release.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Source code · GPL-3.0-or-later ↗
              </a>
              <p className="apps-digest">SHA-256: {release.sha256}</p>
            </details>
          )}
        </div>
      </article>
      <section className="apps-footnote">
        <ShieldCheck size={23} />
        <div>
          <h3>Separate apps. One home.</h3>
          <p>
            Inside the Atlas Android app, downloads are verified before its
            installer asks for your approval. Your Atlas data stays in place.
            Music and Gallery remain part of Atlas for now.
          </p>
          <p>
            The web player uses YouTube’s embedded player; ads and browser
            playback restrictions may apply. Atlas doesn’t save your searches or
            viewing history.
          </p>
        </div>
      </section>
    </main>
  );
}
