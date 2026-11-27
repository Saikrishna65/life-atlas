/** Public YouTube IFrame API types; no credentials, storage or playback history. */
export interface EmbeddedPlayer {
  playVideo(): void;
  destroy(): void;
  getCurrentTime(): number;
}
interface PlayerEvent { target: EmbeddedPlayer }
export interface PlayerOptions {
  events: {
    onReady(event: PlayerEvent): void;
    onStateChange(event: PlayerEvent & { data: number }): void;
    onError(event: PlayerEvent & { data: number }): void;
    onAutoplayBlocked(event: PlayerEvent): void;
  };
}
export interface YouTubeApi { Player: new (element: HTMLIFrameElement, options: PlayerOptions) => EmbeddedPlayer }
type ApiWindow = Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };
let pendingApi: Promise<YouTubeApi> | null = null;
/** Load only after a video is opened. Failed loads can be retried, never cached forever. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  const scope = window as ApiWindow;
  if (scope.YT?.Player) return Promise.resolve(scope.YT);
  if (pendingApi) return pendingApi;
  pendingApi = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = scope.onYouTubeIframeAPIReady;
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const script = existing ?? document.createElement("script");
    const finish = (error?: Error) => {
      clearTimeout(deadline); script.removeEventListener("error", failed);
      if (scope.onYouTubeIframeAPIReady === ready) scope.onYouTubeIframeAPIReady = previous;
      if (error) { if (!existing) script.remove(); reject(error); }
      else if (scope.YT?.Player) resolve(scope.YT);
      else reject(Error("Player unavailable"));
    };
    const ready = () => { finish(); try { previous?.(); } catch {} };
    const failed = () => finish(Error("Player connection unavailable"));
    const deadline = setTimeout(() => finish(Error("Player connection timed out")), 12000);
    scope.onYouTubeIframeAPIReady = ready;
    script.addEventListener("error", failed, { once: true });
    if (!existing) { script.src = "https://www.youtube.com/iframe_api"; script.async = true; document.head.append(script); }
  }).catch((error) => { pendingApi = null; throw error; });
  return pendingApi;
}
export function embedUrl(id: string, origin: string, autoplay: boolean, start = 0): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw Error("Invalid video");
  const url = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  url.search = new URLSearchParams({ enablejsapi: "1", origin, autoplay: autoplay ? "1" : "0", playsinline: "1", rel: "0", start: String(Math.max(0, Math.floor(Number.isFinite(start) ? start : 0))) }).toString();
  return url.href;
}
export function playerFailure(code: number): string {
  if (code === 100) return "This video is no longer available or is private. Choose another video.";
  if (code === 101 || code === 150) return "The owner doesn’t allow this video to play in other websites. Choose another video.";
  if (code === 153) return "YouTube couldn’t verify this player. Try reloading the player or check your browser’s privacy settings.";
  if (code === 2) return "This video link couldn’t be read. Choose another video.";
  return "This video couldn’t play. Try reloading the player or choose another video.";
}
