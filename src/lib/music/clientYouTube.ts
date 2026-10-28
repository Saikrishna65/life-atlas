/**
 * On-device YouTube audio extraction.
 *
 * YouTube blocks requests coming from cloud/datacenter IPs (e.g. Vercel), so the
 * server cannot extract audio. On the Android app we instead use Capacitor's native
 * HTTP client (no CORS, runs from the phone's own network) to ask YouTube's player
 * endpoint for the audio stream and download it in chunks.
 *
 * Nothing is sent to any third party: requests go only to YouTube / googlevideo.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const IOS_UA = "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)";
const PLAYER_URL = "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false";
const CHUNK = 1024 * 1024; // 1 MB range requests (avoids YouTube throttling)

export interface ClientExtractResult {
  blob: Blob;
  mimeType: string;
  duration: number;
  title?: string;
  author?: string;
}

interface AdaptiveFormat {
  itag: number;
  url?: string;
  mimeType?: string;
  contentLength?: string;
  bitrate?: number;
}

export function canExtractOnDevice(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function fetchPlayer(videoId: string) {
  const res = await CapacitorHttp.post({
    url: PLAYER_URL,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": IOS_UA,
      "X-Goog-Api-Format-Version": "2",
    },
    data: {
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      context: {
        client: {
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
      playbackContext: { contentPlaybackContext: { html5Preference: "HTML5_PREF_WANTS" } },
    },
    responseType: "json",
    connectTimeout: 15000,
    readTimeout: 20000,
  });
  if (res.status !== 200 || !res.data) {
    throw new Error(`YouTube returned HTTP ${res.status}`);
  }
  return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
}

async function fetchRange(url: string, start: number, end: number): Promise<Uint8Array> {
  const res = await CapacitorHttp.get({
    url: `${url}&range=${start}-${end}`,
    headers: { "User-Agent": IOS_UA },
    responseType: "blob", // native layer returns base64 string
    connectTimeout: 15000,
    readTimeout: 30000,
  });
  if (res.status !== 200 && res.status !== 206) {
    throw new Error(`Audio download failed (HTTP ${res.status})`);
  }
  return base64ToBytes(res.data as string);
}

export async function extractAudioOnDevice(
  videoId: string,
  onProgress?: (percent: number) => void
): Promise<ClientExtractResult> {
  const player = await fetchPlayer(videoId);

  const status = player?.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new Error(
      player.playabilityStatus.reason || `This video cannot be extracted (${status}).`
    );
  }

  const formats: AdaptiveFormat[] = (player?.streamingData?.adaptiveFormats || []).filter(
    (f: AdaptiveFormat) => f.mimeType?.startsWith("audio/") && f.url
  );
  if (formats.length === 0) {
    throw new Error("YouTube did not provide an audio stream for this video.");
  }

  // Prefer AAC in MP4 (itag 140): plays everywhere including Android WebView.
  const chosen =
    formats.find((f) => f.itag === 140) ||
    formats.find((f) => f.mimeType?.includes("audio/mp4")) ||
    formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  const total = Number(chosen.contentLength || 0);
  if (!total) throw new Error("Could not determine audio size.");

  const parts: Uint8Array[] = [];
  let received = 0;
  for (let start = 0; start < total; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, total - 1);
    const bytes = await fetchRange(chosen.url as string, start, end);
    parts.push(bytes);
    received += bytes.length;
    if (onProgress) onProgress(Math.min(99, Math.round((received / total) * 100)));
  }

  if (received < 10000) throw new Error("Downloaded audio was empty.");

  const mimeType = (chosen.mimeType || "audio/mp4").split(";")[0].trim();
  const blob = new Blob(parts as BlobPart[], { type: mimeType });

  return {
    blob,
    mimeType,
    duration: parseInt(player?.videoDetails?.lengthSeconds || "0", 10) || 0,
    title: player?.videoDetails?.title,
    author: player?.videoDetails?.author,
  };
}

