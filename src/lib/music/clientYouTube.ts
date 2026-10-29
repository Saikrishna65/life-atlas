/**
 * On-device YouTube audio extraction for Android (CapacitorHttp).
 *
 * YouTube blocks cloud/datacenter IPs (such as Vercel serverless functions),
 * so extraction runs directly on the user's phone via Capacitor's native HTTP layer:
 *   1. Fetches a fresh anonymous `visitorData` session token from YouTube (`sw.js_data`)
 *      so `googlevideo.com` CDN stream bindings do not reject requests with HTTP 404/403.
 *   2. Cycles across multiple official InnerTube mobile client profiles (`ANDROID`, `IOS`)
 *      and endpoints (`youtubei.googleapis.com`, `www.youtube.com`).
 *   3. Probes and downloads candidate audio streams (`itag 140` AAC M4A, alternate M4A,
 *      Opus WebM, progressive MP4, and HLS manifest fallback) in 1 MB chunks using both
 *      `&range=` query parameters and `Range` headers with automatic failover.
 *
 * All traffic goes strictly between the user's device and YouTube / googlevideo.com.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { parseYouTubeTitle } from "./youtubeExtractor";

const CHUNK_SIZE = 1024 * 1024; // 1 MB chunks prevent CDN throttling and WebView bridge stalls

const PLAYER_ENDPOINTS = [
  "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false",
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
];

interface InnerTubeClientProfile {
  label: string;
  clientId: string;
  userAgent: string;
  clientContext: Record<string, unknown>;
}

const CLIENT_PROFILES: InnerTubeClientProfile[] = [
  {
    label: "ANDROID_20",
    clientId: "3",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
    clientContext: {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      androidSdkVersion: 34,
      osName: "Android",
      osVersion: "14",
      hl: "en",
      gl: "US",
      utcOffsetMinutes: 0,
    },
  },
  {
    label: "IOS_20",
    clientId: "5",
    userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    clientContext: {
      clientName: "IOS",
      clientVersion: "20.10.4",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.2.22D82",
      hl: "en",
      gl: "US",
      utcOffsetMinutes: 0,
    },
  },
  {
    label: "IOS_19",
    clientId: "5",
    userAgent: "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
    clientContext: {
      clientName: "IOS",
      clientVersion: "19.45.4",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.1.0.22B83",
      hl: "en",
      gl: "US",
      utcOffsetMinutes: 0,
    },
  },
];

export interface ClientExtractResult {
  blob: Blob;
  mimeType: string;
  duration: number;
  title?: string;
  author?: string;
}

export interface ClientPreviewMetadata {
  title: string;
  artist: string;
  thumbnailUrl: string;
}

interface StreamFormat {
  itag: number;
  url?: string;
  mimeType?: string;
  contentLength?: string;
  bitrate?: number;
  approxDurationMs?: string;
}

export function canExtractOnDevice(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function concatChunks(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export interface HttpAdapter {
  get: typeof CapacitorHttp.get;
  post: typeof CapacitorHttp.post;
}

let cachedVisitorData: { value: string; expiresAt: number } | null = null;

async function getVisitorData(http: HttpAdapter = CapacitorHttp): Promise<string | null> {
  if (http === CapacitorHttp && cachedVisitorData && cachedVisitorData.expiresAt > Date.now()) {
    return cachedVisitorData.value;
  }
  try {
    const res = await http.get({
      url: "https://www.youtube.com/sw.js_data",
      headers: {
        "User-Agent": CLIENT_PROFILES[1].userAgent,
        Accept: "*/*",
      },
      responseType: "text",
      connectTimeout: 6000,
      readTimeout: 6000,
    });
    if (res.status === 200 && res.data) {
      const raw = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      const match = raw.match(/"(Cgt[a-zA-Z0-9_%=-]{12,})"/);
      if (match?.[1]) {
        const decoded = decodeURIComponent(match[1]);
        if (http === CapacitorHttp) {
          cachedVisitorData = { value: decoded, expiresAt: Date.now() + 15 * 60 * 1000 };
        }
        return decoded;
      }
    }
  } catch {
    // Non-fatal: proceed without visitorData if sw.js_data is unreachable
  }
  return null;
}

/**
 * Fast on-device YouTube metadata preview via YouTube's public oEmbed endpoint.
 */
export async function fetchYouTubePreviewOnDevice(
  videoId: string
): Promise<ClientPreviewMetadata | null> {
  if (!canExtractOnDevice()) return null;
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await CapacitorHttp.get({
      url: `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
      },
      responseType: "json",
      connectTimeout: 6000,
      readTimeout: 6000,
    });
    if (res.status === 200 && res.data) {
      const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      const parsed = parseYouTubeTitle(data.title || "", data.author_name);
      return {
        title: parsed.title,
        artist: parsed.artist,
        thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch {
    // Ignore preview failures
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPlayerForProfile(
  videoId: string,
  profile: InnerTubeClientProfile,
  visitorData: string | null,
  http: HttpAdapter = CapacitorHttp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  for (const endpoint of PLAYER_ENDPOINTS) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": profile.userAgent,
        "X-YouTube-Client-Name": profile.clientId,
        "X-YouTube-Client-Version": String(profile.clientContext.clientVersion),
        "X-Goog-Api-Format-Version": "2",
      };
      if (visitorData) {
        headers["X-Goog-Visitor-Id"] = visitorData;
      }

      const res = await http.post({
        url: endpoint,
        headers,
        data: {
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: {
            client: {
              ...profile.clientContext,
              ...(visitorData ? { visitorData } : {}),
            },
          },
          playbackContext: {
            contentPlaybackContext: {
              html5Preference: "HTML5_PREF_WANTS",
            },
          },
        },
        responseType: "json",
        connectTimeout: 12000,
        readTimeout: 18000,
      });

      if (res.status === 200 && res.data) {
        return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      }
    } catch {
      // Try next endpoint
    }
  }
  return null;
}

function getHeaderCaseInsensitive(
  headers: Record<string, string> | undefined,
  target: string
): string | undefined {
  if (!headers) return undefined;
  const lower = target.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k && k.toLowerCase() === lower) return v;
  }
  return undefined;
}

async function getRawBytes(
  url: string,
  userAgent: string,
  extraHeaders: Record<string, string> = {},
  http: HttpAdapter = CapacitorHttp
): Promise<{ status: number; bytes?: Uint8Array; headers?: Record<string, string> }> {
  try {
    const res = await http.get({
      url,
      headers: {
        "User-Agent": userAgent,
        Accept: "*/*",
        ...extraHeaders,
      },
      responseType: "blob",
      connectTimeout: 15000,
      readTimeout: 45000,
    });
    if ((res.status === 200 || res.status === 206) && typeof res.data === "string" && res.data.length > 0) {
      return {
        status: res.status,
        bytes: base64ToBytes(res.data),
        headers: res.headers as Record<string, string> | undefined,
      };
    }
    return { status: res.status || 0, headers: res.headers as Record<string, string> | undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("FileNotFoundException") || msg.includes("404")) {
      return { status: 404 };
    }
    return { status: 0 };
  }
}

function withRangeParam(rawUrl: string, start: number, end: number): string {
  const stripped = rawUrl.replace(/&range=[^&]*/g, "");
  const sep = stripped.includes("?") ? "&" : "?";
  return `${stripped}${sep}range=${start}-${end}`;
}

async function fetchChunk(
  rawUrl: string,
  userAgent: string,
  start: number,
  end: number,
  http: HttpAdapter = CapacitorHttp
): Promise<{ bytes: Uint8Array; totalFromHeader?: number }> {
  const strategies: Array<() => Promise<{ status: number; bytes?: Uint8Array; headers?: Record<string, string> }>> = [
    () => getRawBytes(withRangeParam(rawUrl, start, end), userAgent, {}, http),
    () => getRawBytes(rawUrl, userAgent, { Range: `bytes=${start}-${end}` }, http),
  ];

  let lastStatus = 0;
  for (const runStrategy of strategies) {
    const res = await runStrategy();
    if (res.bytes && res.bytes.byteLength > 0) {
      let totalFromHeader: number | undefined;
      const contentRange = getHeaderCaseInsensitive(res.headers, "content-range");
      if (contentRange) {
        const m = contentRange.match(/\/(\d+)$/);
        if (m?.[1]) totalFromHeader = Number(m[1]);
      }
      return { bytes: res.bytes, totalFromHeader };
    }
    if (res.status) lastStatus = res.status;
  }

  throw new Error(`HTTP ${lastStatus || "network error"}`);
}

async function downloadFormatStream(
  format: StreamFormat,
  userAgent: string,
  onProgress?: (percent: number) => void,
  http: HttpAdapter = CapacitorHttp
): Promise<Uint8Array> {
  if (!format.url) throw new Error("Missing stream URL");

  let total = Number(format.contentLength || 0);

  // If contentLength wasn't provided in InnerTube metadata, probe first chunk via Range header
  if (!total || !Number.isFinite(total) || total <= 0) {
    const probeEnd = CHUNK_SIZE - 1;
    const probe = await getRawBytes(format.url, userAgent, { Range: `bytes=0-${probeEnd}` }, http);
    if (!probe.bytes || probe.bytes.byteLength === 0) {
      throw new Error(`Stream probe failed (HTTP ${probe.status})`);
    }
    const cr = getHeaderCaseInsensitive(probe.headers, "content-range");
    const totalMatch = cr?.match(/\/(\d+)$/);
    total = totalMatch?.[1] ? Number(totalMatch[1]) : probe.bytes.byteLength;

    if (probe.bytes.byteLength >= total) {
      onProgress?.(99);
      return probe.bytes;
    }

    const parts: Uint8Array[] = [probe.bytes];
    let received = probe.bytes.byteLength;
    onProgress?.(Math.min(99, Math.round((received / total) * 100)));

    for (let start = received; start < total; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, total - 1);
      const { bytes } = await fetchChunk(format.url, userAgent, start, end, http);
      parts.push(bytes);
      received += bytes.byteLength;
      onProgress?.(Math.min(99, Math.round((received / total) * 100)));
    }
    return concatChunks(parts);
  }

  const parts: Uint8Array[] = [];
  let received = 0;

  for (let start = 0; start < total; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, total - 1);
    let chunkResult: { bytes: Uint8Array } | null = null;
    let chunkErr: unknown = null;

    // Allow 1 immediate retry on mid-stream transient hiccups (skip retry on chunk 0 404/403 so failover is fast)
    const maxAttempts = start === 0 ? 1 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        chunkResult = await fetchChunk(format.url, userAgent, start, end, http);
        break;
      } catch (e) {
        chunkErr = e;
      }
    }

    if (!chunkResult) {
      throw chunkErr instanceof Error ? chunkErr : new Error(String(chunkErr));
    }

    parts.push(chunkResult.bytes);
    received += chunkResult.bytes.byteLength;
    onProgress?.(Math.min(99, Math.round((received / total) * 100)));
  }

  const combined = concatChunks(parts);
  if (combined.byteLength < 8192) {
    throw new Error("Downloaded stream was too small");
  }
  return combined;
}

/**
 * Fallback HLS (.m3u8) audio segment downloader when YouTube serves HLS on iOS profiles.
 */
async function downloadFromHlsManifest(
  hlsManifestUrl: string,
  userAgent: string,
  onProgress?: (percent: number) => void,
  http: HttpAdapter = CapacitorHttp
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const masterRes = await http.get({
      url: hlsManifestUrl,
      headers: { "User-Agent": userAgent },
      responseType: "text",
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    if (masterRes.status !== 200 || typeof masterRes.data !== "string") return null;

    const masterText = masterRes.data;
    // Prefer dedicated audio rendition (#EXT-X-MEDIA:TYPE=AUDIO,...,URI="...")
    let playlistUrl: string | null = null;
    const audioMediaMatches = [...masterText.matchAll(/#EXT-X-MEDIA:[^\n]*TYPE=AUDIO[^\n]*URI="([^"]+)"/g)];
    if (audioMediaMatches.length > 0) {
      playlistUrl = audioMediaMatches[audioMediaMatches.length - 1][1];
    } else {
      const streamLines = masterText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith("https://"));
      if (streamLines.length > 0) playlistUrl = streamLines[0];
    }
    if (!playlistUrl) return null;

    const plRes = await http.get({
      url: playlistUrl,
      headers: { "User-Agent": userAgent },
      responseType: "text",
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    if (plRes.status !== 200 || typeof plRes.data !== "string") return null;

    const plText = plRes.data;
    const segments: string[] = [];
    const mapMatch = plText.match(/#EXT-X-MAP:URI="([^"]+)"/);
    if (mapMatch?.[1]) segments.push(mapMatch[1]);

    for (const line of plText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && /^https?:\/\//.test(trimmed)) {
        segments.push(trimmed);
      }
    }
    if (segments.length === 0) return null;

    const parts: Uint8Array[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = await getRawBytes(segments[i], userAgent, {}, http);
      if (!seg.bytes || seg.bytes.byteLength === 0) {
        throw new Error(`HLS segment ${i} failed (HTTP ${seg.status})`);
      }
      parts.push(seg.bytes);
      onProgress?.(Math.min(99, Math.round(((i + 1) / segments.length) * 100)));
    }

    const bytes = concatChunks(parts);
    if (bytes.byteLength < 8192) return null;
    const isFmp4 = Boolean(mapMatch?.[1]);
    return { bytes, mimeType: isFmp4 ? "audio/mp4" : "audio/aac" };
  } catch {
    return null;
  }
}

function rankFormats(adaptive: StreamFormat[], muxed: StreamFormat[]): StreamFormat[] {
  const audioAdaptive = adaptive.filter((f) => f.mimeType?.startsWith("audio/") && f.url);
  const itag140 = audioAdaptive.filter((f) => f.itag === 140);
  const otherMp4Audio = audioAdaptive
    .filter((f) => f.itag !== 140 && f.mimeType?.includes("audio/mp4"))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const webmAudio = audioAdaptive
    .filter((f) => !f.mimeType?.includes("audio/mp4"))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const progressiveMp4 = muxed
    .filter((f) => f.url && f.mimeType?.includes("mp4"))
    .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));

  return [...itag140, ...otherMp4Audio, ...webmAudio, ...progressiveMp4];
}

export async function extractAudioOnDevice(
  videoId: string,
  onProgress?: (percent: number) => void,
  http: HttpAdapter = CapacitorHttp
): Promise<ClientExtractResult> {
  const visitorData = await getVisitorData(http);

  let unplayableReason: string | null = null;
  const errors: string[] = [];

  for (const profile of CLIENT_PROFILES) {
    const player = await fetchPlayerForProfile(videoId, profile, visitorData, http);
    if (!player) {
      errors.push(`${profile.label}: unreachable`);
      continue;
    }

    const playStatus = player?.playabilityStatus?.status;
    if (playStatus && playStatus !== "OK") {
      const reason = player?.playabilityStatus?.reason;
      if (reason && !reason.toLowerCase().includes("bot")) {
        unplayableReason = unplayableReason || reason;
      }
      errors.push(`${profile.label}: ${playStatus}`);
      continue;
    }

    const rawTitle: string | undefined = player?.videoDetails?.title;
    const rawAuthor: string | undefined = player?.videoDetails?.author;
    const parsedMeta = rawTitle ? parseYouTubeTitle(rawTitle, rawAuthor) : null;
    const durationSecs =
      parseInt(player?.videoDetails?.lengthSeconds || "0", 10) ||
      Math.round(
        Number(player?.streamingData?.adaptiveFormats?.[0]?.approxDurationMs || 0) / 1000
      ) ||
      0;

    const candidates = rankFormats(
      player?.streamingData?.adaptiveFormats || [],
      player?.streamingData?.formats || []
    );

    for (const candidate of candidates) {
      try {
        const bytes = await downloadFormatStream(candidate, profile.userAgent, onProgress, http);
        const rawMime = (candidate.mimeType || "audio/mp4").split(";")[0].trim();
        const mimeType = rawMime.startsWith("video/mp4") ? "audio/mp4" : rawMime;

        return {
          blob: new Blob([bytes as BlobPart], { type: mimeType }),
          mimeType,
          duration: durationSecs,
          title: parsedMeta?.title || rawTitle,
          author: parsedMeta?.artist || rawAuthor,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${profile.label}/itag${candidate.itag}: ${msg}`);
      }
    }

    // Fallback: HLS audio manifest if available on this profile
    const hlsUrl: string | undefined = player?.streamingData?.hlsManifestUrl;
    if (hlsUrl) {
      const hls = await downloadFromHlsManifest(hlsUrl, profile.userAgent, onProgress, http);
      if (hls) {
        return {
          blob: new Blob([hls.bytes as BlobPart], { type: hls.mimeType }),
          mimeType: hls.mimeType,
          duration: durationSecs,
          title: parsedMeta?.title || rawTitle,
          author: parsedMeta?.artist || rawAuthor,
        };
      }
    }
  }

  if (unplayableReason) {
    throw new Error(unplayableReason);
  }
  throw new Error(
    `Could not download audio from YouTube (${errors.slice(0, 3).join(", ") || "no stream"}). Verify the video is public and try again.`
  );
}
