import type Lenis from "lenis";
let latestNavigation = 0;
/** Wait for an explicitly requested deferred chapter before measuring its position. */
export async function navigateChapter(
  id: string,
  lenis?: Lenis,
  immediate = false,
) {
  const request = ++latestNavigation;
  window.dispatchEvent(
    new CustomEvent("world-chapter-request", { detail: id }),
  );
  const rendered = () => {
    const el = document.getElementById(id);
    return el &&
      (!el.classList.contains("world-loading") ||
        el.hasAttribute("data-world-error"))
      ? el
      : null;
  };
  if (!rendered())
    await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (rendered()) {
          clearTimeout(timer);
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(
        document.getElementById("living-world") ?? document.body,
        { subtree: true, childList: true },
      );
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 8000);
    });
  const target = rendered();
  if (!target || request !== latestNavigation) return;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  if (request !== latestNavigation || !target.isConnected) return;
  const reduce =
    immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (lenis) {
    lenis.start();
    lenis.resize();
    lenis.scrollTo(target, {
      offset: -74,
      force: true,
      duration: reduce ? 0 : 1.3,
      immediate: reduce,
      onComplete: () => {
        if (request !== latestNavigation || !target.isConnected) return;
        lenis.resize();
        if (Math.abs(target.getBoundingClientRect().top - 74) > 5)
          lenis.scrollTo(target, {
            offset: -74,
            duration: reduce ? 0 : 0.35,
            force: true,
            immediate: reduce,
          });
      },
    });
  } else
    window.scrollTo({
      top: window.scrollY + target.getBoundingClientRect().top - 74,
      behavior: reduce ? "instant" : "smooth",
    });
  history.replaceState(null, "", `#${id}`);
}

/** Cancel pending chapter alignment before returning through the original hero. */
export function returnToDoor(lenis?: Lenis, duration = 2) {
  const request = ++latestNavigation;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (lenis) {
    lenis.start();
    lenis.scrollTo(0, {
      duration: reduced ? 0 : duration,
      immediate: reduced,
      force: true,
      onComplete: () => {
        if (request === latestNavigation)
          lenis.scrollTo(0, { immediate: true, force: true });
      },
    });
  } else window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  history.replaceState(null, "", location.pathname);
}
