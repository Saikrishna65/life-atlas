export interface VideoChannel { id: string; title: string; description: string; avatar?: string }
export function readChannelId(value: unknown): string | null {
  return typeof value === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(value) ? value : null;
}
export function readChannel(value: unknown): VideoChannel | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>, id = readChannelId(item.id);
  if (!id) return null;
  let avatar: string | undefined;
  try {
    const url = new URL(String(item.avatar));
    if (url.protocol === "https:" && !url.username && !url.password && ["yt3.googleusercontent.com", "yt3.ggpht.com"].includes(url.hostname)) avatar = url.href;
  } catch {}
  return { id, title: typeof item.title === "string" ? item.title.slice(0, 200) : "Channel", description: typeof item.description === "string" ? item.description.slice(0, 4000) : "", ...(avatar ? { avatar } : {}) };
}
