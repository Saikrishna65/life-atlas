export const VIDEO_PACKAGE = "com.lifeatlas.video";
export const VIDEO_SIGNER =
  "f396d14bbd2076769e0edb46a3a8c4a4d4d45b57ae90a0ddd70e226e65d2d36f";
export const RELEASE_API =
  "https://api.github.com/repos/Saikrishna65/life-atlas/releases?per_page=50";
export interface CompanionRelease {
  packageId: string;
  versionCode: number;
  versionName: string;
  bytes: number;
  sha256: string;
  signerSha256: string;
  url: string;
  sourceUrl: string;
  license: "GPL-3.0-or-later";
  notes?: string;
}
export interface CompanionStatus {
  installed: boolean;
  installedVersion: string;
  installedCode: number;
  phase: string;
  error: string;
  downloadedBytes: number;
  release: CompanionRelease | null;
  ready: boolean;
  canInstall: boolean;
  wifiOnly: boolean;
}
const base = "https://github.com/Saikrishna65/life-atlas/releases/download/";
export function releaseAsset(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(base) &&
    /^atlas-video-[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(
      value.slice(base.length),
    ) &&
    !value.includes("..")
  );
}
export function parseCompanionManifest(
  value: unknown,
): CompanionRelease | null {
  if (!value || typeof value !== "object") throw Error("Invalid app catalog");
  const data = value as Record<string, unknown>;
  if (
    data.schemaVersion !== 1 ||
    !Array.isArray(data.packages) ||
    data.packages.length > 4
  )
    throw Error("Invalid app catalog");
  const entries = data.packages.filter(
    (p) => p && p.packageId === VIDEO_PACKAGE,
  );
  if (entries.length > 1) throw Error("Duplicate companion");
  if (!entries.length) return null;
  const p = entries[0];
  if (
    !Number.isSafeInteger(p.versionCode) ||
    p.versionCode < 1 ||
    p.versionCode > 2147483647 ||
    !Number.isSafeInteger(p.bytes) ||
    p.bytes < 1 ||
    p.bytes > 300 * 1048576 ||
    typeof p.versionName !== "string" ||
    !p.versionName.length ||
    p.versionName.length > 80 ||
    typeof p.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.sha256) ||
    p.signerSha256 !== VIDEO_SIGNER ||
    p.license !== "GPL-3.0-or-later" ||
    !releaseAsset(p.url) ||
    !releaseAsset(p.sourceUrl) ||
    !p.url.endsWith("/atlas-video.apk") ||
    !p.sourceUrl.endsWith("/atlas-video-source.zip") ||
    p.url.slice(base.length).split("/")[0] !==
      p.sourceUrl.slice(base.length).split("/")[0]
  )
    throw Error("Untrusted app release");
  return {
    packageId: VIDEO_PACKAGE,
    versionCode: p.versionCode,
    versionName: p.versionName,
    bytes: p.bytes,
    sha256: p.sha256,
    signerSha256: VIDEO_SIGNER,
    url: p.url,
    sourceUrl: p.sourceUrl,
    license: p.license,
    notes: typeof data.notes === "string" ? data.notes.slice(0, 4000) : "",
  };
}
export async function checkVideoRelease(
  signal?: AbortSignal,
): Promise<CompanionRelease | null> {
  const read = async (url: string, max: number) => {
    const response = await fetch(url, {
      signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw Error("Could not check apps. Try again when you’re online.");
    const text = await response.text();
    if (text.length > max) throw Error("App catalog is too large");
    return JSON.parse(text);
  };
  const releases = await read(RELEASE_API, 2097152);
  if (!Array.isArray(releases)) throw Error("Invalid releases");
  let best: CompanionRelease | null = null;
  for (const release of releases.slice(0, 50)) {
    if (
      release.draft ||
      release.prerelease ||
      typeof release.tag_name !== "string" ||
      !release.tag_name.startsWith("atlas-video-") ||
      !Array.isArray(release.assets)
    )
      continue;
    const asset = release.assets.find(
      (a: { name?: string; browser_download_url?: string }) =>
        a.name === "atlas-apps.json" && releaseAsset(a.browser_download_url),
    );
    if (!asset) continue;
    const entry = parseCompanionManifest(
      await read(asset.browser_download_url, 65536),
    );
    if (entry && (!best || entry.versionCode > best.versionCode)) best = entry;
  }
  return best;
}
