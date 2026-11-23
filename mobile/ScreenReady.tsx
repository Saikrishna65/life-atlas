import { useEffect, useLayoutEffect } from "react";
import { finishScreen } from "../src/lib/performance/metrics";
import { restoreRouteScroll } from "./scroll-restoration";
/** Mount inside the route Suspense boundary so fallback UI never completes navigation. */
export default function ScreenReady({ token }: { token: number }) {
  useLayoutEffect(() => {
    restoreRouteScroll();
  }, [token]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => finishScreen(token));
    return () => cancelAnimationFrame(frame);
  }, [token]);
  return null;
}
