"use client";
import { useEffect } from "react";
import { galleryMediaRequests } from "./media-requests";
let users = 0;
let remove: (() => void) | undefined;
/** Pause speculative thumbnail work during gestures, never visible-media requests. */
export function useGalleryActivity() {
  useEffect(() => {
    if (users++ === 0) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const idle = () => {
        timer = undefined;
        galleryMediaRequests.setDeferPrefetch(false);
      };
      const activity = () => {
        if (timer) clearTimeout(timer);
        galleryMediaRequests.setDeferPrefetch(true);
        timer = setTimeout(idle, 160);
      };
      const pointer = (event: PointerEvent) => {
        if (event.buttons || event.type !== "pointermove") activity();
      };
      const visibility = () => {
        galleryMediaRequests.setSuspended(document.hidden);
      };
      for (const name of ["scroll", "wheel"])
        window.addEventListener(name, activity, { passive: true });
      for (const name of [
        "pointerdown",
        "pointermove",
        "pointerup",
        "pointercancel",
      ] as const)
        window.addEventListener(name, pointer, { passive: true });
      document.addEventListener("visibilitychange", visibility);
      visibility();
      remove = () => {
        if (timer) clearTimeout(timer);
        for (const name of ["scroll", "wheel"])
          window.removeEventListener(name, activity);
        for (const name of [
          "pointerdown",
          "pointermove",
          "pointerup",
          "pointercancel",
        ] as const)
          window.removeEventListener(name, pointer);
        document.removeEventListener("visibilitychange", visibility);
      };
    }
    return () => {
      if (--users === 0) {
        remove?.();
        remove = undefined;
        queueMicrotask(() => {
          if (!users) {
            galleryMediaRequests.setSuspended(false);
            galleryMediaRequests.setDeferPrefetch(false);
          }
        });
      }
    };
  }, []);
}
