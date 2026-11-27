export interface VideoResult {
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  thumbnail: string;
  duration: string;
}
export function youtubeId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (
      ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)
    )
      id =
        url.searchParams.get("v") ||
        url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ||
        null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function searchQuery(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120)
    throw Error("Enter up to 120 characters.");
  return value.trim();
}
