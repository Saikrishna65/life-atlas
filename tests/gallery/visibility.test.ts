import assert from "node:assert/strict";
import test from "node:test";
import { observeGalleryVisibility } from "../../src/lib/gallery/visibility";

test("gallery tiles share observers, promote visible work and disconnect after the last tile", () => {
  const original = globalThis.IntersectionObserver;
  const observers: Observer[] = [];
  class Observer {
    elements = new Set<Element>();
    disconnected = false;
    constructor(
      public callback: IntersectionObserverCallback,
      public options?: IntersectionObserverInit,
    ) {
      observers.push(this);
    }
    observe(element: Element) {
      this.elements.add(element);
    }
    unobserve(element: Element) {
      this.elements.delete(element);
    }
    disconnect() {
      this.disconnected = true;
      this.elements.clear();
    }
    emit(element: Element, isIntersecting: boolean) {
      this.callback(
        [{ target: element, isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
  }
  globalThis.IntersectionObserver =
    Observer as unknown as typeof IntersectionObserver;
  const states: { near: boolean; visible: boolean }[] = [];
  const elements = Array.from({ length: 100 }, () => ({}) as Element);
  const cleanups = elements.map((element, index) =>
    observeGalleryVisibility(element, (value) => {
      if (!index) states.push(value);
    }),
  );
  try {
    assert.equal(observers.length, 2);
    assert.equal(observers[0].options?.rootMargin, "240px");
    observers[0].emit(elements[0], true);
    observers[1].emit(elements[0], true);
    observers[0].emit(elements[0], false);
    assert.deepEqual(states, [
      { near: true, visible: false },
      { near: true, visible: true },
      { near: true, visible: true },
    ]);
    cleanups[0]();
    observers[1].emit(elements[0], false);
    assert.equal(states.length, 3);
    assert.equal(observers[0].elements.size, 99);
    assert.equal(observers[0].disconnected, false);
    cleanups.slice(1).forEach((cleanup) => cleanup());
    assert.ok(observers.every((observer) => observer.disconnected));
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    globalThis.IntersectionObserver = original;
  }
});

test("missing observer support keeps content available", () => {
  const original = globalThis.IntersectionObserver;
  // Older WebViews still load content without intersection monitoring.
  Reflect.deleteProperty(globalThis, "IntersectionObserver");
  try {
    let available = false;
    const cleanup = observeGalleryVisibility({} as Element, (value) => {
      available = value.visible && value.near;
    });
    assert.equal(available, true);
    cleanup();
  } finally {
    globalThis.IntersectionObserver = original;
  }
});
