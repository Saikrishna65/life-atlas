import type Lenis from "lenis";
let latestNavigation = 0;
/** Wait for an explicitly requested deferred chapter before measuring its position. */
export async function navigateChapter(
  id: string,
  lenis?: Lenis,
  immediate = false,
) {
  const request = ++latestNavigation;
  const offset = id === "observatory" ? 0 : 74;
  window.dispatchEvent(
    new CustomEvent("world-chapter-request", { detail: id }),
  );
  const rendered = () => {
    // Streamed route boundaries can briefly contain a hidden copy of the chapter.
    // A zero-sized target would clamp Lenis to the top and cancel the real entry.
    return Array.from(document.querySelectorAll<HTMLElement>(`#${CSS.escape(id)}`)).find(el =>
      (!el.classList.contains("world-loading") || el.hasAttribute("data-world-error"))
      && el.getBoundingClientRect().width > 0
      && el.getBoundingClientRect().height > 0,
    ) ?? null;
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
      observer.observe(document.body, { subtree: true, childList: true });
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
  const settleLayout = () => {
    const world = document.getElementById("living-world");
    if (!world) return;
    let frame = 0;
    const stop = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"])
        window.removeEventListener(event, stop, true);
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (request !== latestNavigation || !target.isConnected) { stop(); return; }
        // Earlier deferred scenes can grow after a deep link has already landed.
        // Only compensate for that layout shift, and yield on any user input.
        if (Math.abs(target.getBoundingClientRect().top - offset) <= 5) return;
        const top = window.scrollY + target.getBoundingClientRect().top - offset;
        if (lenis) { lenis.resize(); lenis.scrollTo(top, { immediate: true, force: true }); }
        else window.scrollTo({ top, behavior: "instant" });
      });
    });
    const timeout = setTimeout(stop, 4000);
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"])
      window.addEventListener(event, stop, { capture: true, passive: true });
    observer.observe(world);
  };
  if (lenis) {
    lenis.start();
    lenis.resize();
    // Numeric destinations avoid adding the scene’s CSS scroll-margin a second time.
    const position = () =>
      window.scrollY + target.getBoundingClientRect().top - offset;
    lenis.scrollTo(position(), {
      force: true,
      duration: reduce ? 0 : 1.3,
      immediate: reduce,
      onComplete: () => {
        settleLayout();
        // Let lazy replacements and animation measurements finish before
        // correcting alignment. Never measure a hidden loading boundary.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (request !== latestNavigation || !target.isConnected || rendered() !== target) return;
          lenis.resize();
          if (Math.abs(target.getBoundingClientRect().top - offset) > 5)
            lenis.scrollTo(position(), {
              duration: reduce ? 0 : 0.35,
              force: true,
              immediate: reduce,
            });
        }));
      },
    });

  } else
    window.scrollTo({
      top: window.scrollY + target.getBoundingClientRect().top - offset,
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
