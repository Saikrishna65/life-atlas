import React, { createContext, useContext, useSyncExternalStore } from 'react';
const subscribe = (fn: () => void) => { window.addEventListener('popstate', fn); return () => window.removeEventListener('popstate', fn); };
const snapshot = () => location.pathname + location.search;
export const ParamsContext = createContext<Record<string, string>>({});
export function navigate(href: string, replace = false, scroll = true) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin) { location.assign(href); return; }
  history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search + url.hash);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (scroll) window.scrollTo(0, 0);
}
const router = {
  push: (href: string, options?: {scroll?: boolean}) => navigate(href, false, options?.scroll !== false),
  replace: (href: string, options?: {scroll?: boolean}) => navigate(href, true, options?.scroll !== false),
  back: () => history.length > 1 ? history.back() : navigate('/secret', true),
  forward: () => history.forward(), refresh: () => window.dispatchEvent(new PopStateEvent('popstate')),
  prefetch: async () => {},
};
export function useRouter() { return router; }
export function usePathname() { return useSyncExternalStore(subscribe, snapshot).split('?')[0]; }
export function useSearchParams() { const path = useSyncExternalStore(subscribe, snapshot); return React.useMemo(() => new URLSearchParams(path.split('?')[1] || ''), [path]); }
export function useParams<T = Record<string, string>>() { return useContext(ParamsContext) as T; }
export function redirect(href: string) { queueMicrotask(() => navigate(href, true)); return null; }
