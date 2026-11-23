import { beginNavigation } from "../src/lib/performance/metrics";
const FIELD = "atlasNavigationEntry";
let sequence = 0;
const session =
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let installed = false;
let current = "";
let url = "";
let desired: { key: string; top: number } | undefined;
let stopRestore: (() => void) | undefined;
const positions = new Map<string, number>();
const routeURL = () => location.pathname + location.search;
export function navigationState(top = 0) {
  return {
    [FIELD]: `route-${session}-${++sequence}`,
    atlasNavigationTop: Math.max(0, top),
  };
}
function entry() {
  if (!history.state?.[FIELD])
    history.replaceState({ ...history.state, ...navigationState() }, "");
  return String(history.state[FIELD]);
}
function remember() {
  if (!current || desired) return;
  positions.delete(current);
  positions.set(current, Math.max(0, scrollY));
  if (positions.size > 60) positions.delete(positions.keys().next().value!);
}
/** Called before push/replace, while the outgoing page still owns the viewport. */
export function saveRouteScroll() {
  remember();
  stopRestore?.();
  desired = undefined;
}
/** Install once for the mobile document. Gallery same-URL history layers are left alone. */
export function installRouteScroll() {
  if (installed) return () => {};
  installed = true;
  const previous = history.scrollRestoration;
  history.scrollRestoration = "manual";
  current = entry();
  url = routeURL();
  const changed = () => {
    const sameRoute = routeURL() === url;
    const nextEntry = entry();
    if (sameRoute && nextEntry === current) return;
    remember();
    stopRestore?.();
    current = nextEntry;
    url = routeURL();
    const fallback = Number(history.state?.atlasNavigationTop);
    desired = {
      key: current,
      top:
        positions.get(current) ??
        (Number.isFinite(fallback) ? Math.max(0, fallback) : 0),
    };
    if (sameRoute) restoreRouteScroll();
    else beginNavigation();
  };
  const interact = () => {
    stopRestore?.();
    desired = undefined;
  };
  window.addEventListener("popstate", changed);
  window.addEventListener("scroll", remember, { passive: true });
  window.addEventListener("wheel", interact, { passive: true });
  window.addEventListener("touchstart", interact, { passive: true });
  window.addEventListener("pointerdown", interact, { passive: true });
  window.addEventListener("keydown", interact);
  return () => {
    installed = false;
    stopRestore?.();
    desired = undefined;
    window.removeEventListener("popstate", changed);
    window.removeEventListener("scroll", remember);
    window.removeEventListener("wheel", interact);
    window.removeEventListener("touchstart", interact);
    window.removeEventListener("pointerdown", interact);
    window.removeEventListener("keydown", interact);
    history.scrollRestoration = previous;
    positions.clear();
  };
}
/** Runs after the new screen commits, with a bounded observer for asynchronous local content. */
export function restoreRouteScroll() {
  if (!desired || desired.key !== current) return;
  const target = desired;
  stopRestore?.();
  desired = target;
  const stop = () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
    if (desired === target) desired = undefined;
    if (stopRestore === stop) stopRestore = undefined;
  };
  const restore = () => {
    if (target.key !== current) {
      stop();
      return;
    }
    window.scrollTo({ top: target.top, behavior: "instant" });
    if (document.documentElement.scrollHeight - innerHeight >= target.top - 1)
      stop();
  };
  stopRestore = stop;
  const observer = new ResizeObserver(restore);
  observer.observe(document.body);
  const timer = setTimeout(stop, 3000);
  restore();
}
