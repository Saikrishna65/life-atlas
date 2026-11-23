let prefetcher: ((path: string) => Promise<unknown> | undefined) | undefined;
export function setRoutePrefetcher(load: typeof prefetcher) {
  prefetcher = load;
}
export async function prefetchRoute(href: string) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/secret"))
    return;
  // Intent-only prefetch: never crawl every link or fetch user media/models.
  try {
    await prefetcher?.(url.pathname);
  } catch {
    /* Navigation can retry. */
  }
}
export function reusableLoad<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () =>
    (pending ||= load().catch((error) => {
      pending = undefined;
      throw error;
    }));
}
