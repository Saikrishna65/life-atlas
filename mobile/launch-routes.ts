/** Native launcher handoff, kept independent of React and persistent storage. */
export function safePrivateRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\\#\s]/.test(value)) return null;
  if (value.indexOf("?") !== value.lastIndexOf("?")) return null;
  const [path, query] = value.split("?");
  try {
    if (!/^\/secret(?:\/[A-Za-z0-9_-]+)*$/.test(decodeURIComponent(path))) return null;
    if (query !== undefined && !/^[A-Za-z0-9_=&%.~-]*$/.test(query)) return null;
    decodeURIComponent(value);
    return value;
  } catch { return null; }
}

type LaunchWindow = Window & {
  AtlasModuleLaunch?: { getInitialRoute(): string | null };
  __atlasPendingRoute?: unknown;
};

/** Listen before importing React so intents arriving during startup cannot be lost. */
export function installLaunchRoutes(host: LaunchWindow) {
  let navigate: ((route: string) => void) | undefined;
  const accept = (value: unknown) => {
    const route = safePrivateRoute(value);
    if (!route) return;
    delete host.__atlasPendingRoute;
    if (host.location.pathname + host.location.search === route) return;
    if (navigate) navigate(route);
    else host.history.replaceState({}, "", route);
  };
  const listener = (event: Event) => accept((event as CustomEvent).detail);
  host.addEventListener("atlas:open-route", listener);
  let initial: unknown;
  try { initial = host.AtlasModuleLaunch?.getInitialRoute(); } catch { /* Older host. */ }
  if (!safePrivateRoute(host.location.pathname + host.location.search))
    accept(safePrivateRoute(host.__atlasPendingRoute) || safePrivateRoute(initial) || "/secret");
  else if (host.__atlasPendingRoute) accept(host.__atlasPendingRoute);
  return {
    ready(callback: (route: string) => void) { navigate = callback; },
    dispose() { host.removeEventListener("atlas:open-route", listener); },
  };
}
