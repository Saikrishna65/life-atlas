interface Visibility {
  near: boolean;
  visible: boolean;
}
interface Watch {
  near: boolean;
  visible: boolean;
  callback: (value: Visibility) => void;
}
const watches = new Map<Element, Watch>();
let nearby: IntersectionObserver | undefined,
  onscreen: IntersectionObserver | undefined;
function update(
  entries: IntersectionObserverEntry[],
  field: "near" | "visible",
) {
  for (const entry of entries) {
    const watch = watches.get(entry.target);
    if (!watch || watch[field] === entry.isIntersecting) continue;
    watch[field] = entry.isIntersecting;
    watch.callback({
      near: watch.near || watch.visible,
      visible: watch.visible,
    });
  }
}
/** Tiles share one nearby and one onscreen observer. No decoded files are retained here. */
export function observeGalleryVisibility(
  element: Element,
  callback: (value: Visibility) => void,
) {
  if (typeof IntersectionObserver === "undefined") {
    callback({ near: true, visible: true });
    return () => {};
  }
  nearby ??= new IntersectionObserver((entries) => update(entries, "near"), {
    rootMargin: "240px",
  });
  onscreen ??= new IntersectionObserver((entries) =>
    update(entries, "visible"),
  );
  const watch: Watch = { near: false, visible: false, callback };
  watches.set(element, watch);
  nearby.observe(element);
  onscreen.observe(element);
  return () => {
    if (watches.get(element) !== watch) return;
    watches.delete(element);
    nearby?.unobserve(element);
    onscreen?.unobserve(element);
    if (!watches.size) {
      nearby?.disconnect();
      onscreen?.disconnect();
      nearby = undefined;
      onscreen = undefined;
    }
  };
}
