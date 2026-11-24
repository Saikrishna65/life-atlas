import React, { lazy, Suspense } from "react";
import { navigationToken } from "../src/lib/performance/metrics";
import { installRouteScroll } from "./scroll-restoration";
import ScreenReady from "./ScreenReady";
import { createRoot } from "react-dom/client";
import SecretLayout from "../src/app/secret/layout";
const loadMusicLayout = reusableLoad(
  () => import("../src/app/secret/music/layout"),
);
const MusicLayout = lazy(loadMusicLayout);
import MobileAppBridge from "../src/components/layout/MobileAppBridge";
import { ParamsContext, usePathname } from "./navigation";
const SavedStudioEntries = lazy(() => import("./SavedStudioEntries"));
import "../src/app/globals.css";
import {
  reusableLoad,
  setRoutePrefetcher,
  prefetchRoute,
} from "./route-prefetch";
const loaders = new Map<
  React.LazyExoticComponent<React.ComponentType>,
  () => Promise<unknown>
>();
const lazyPage = (
  load: () => Promise<{ default: () => React.ReactNode | void }>,
) => {
  const cached = reusableLoad(async () => {
    const screenModule = await load();
    // Redirect-only Next pages return void in their server type declaration.
    return { default: screenModule.default as React.ComponentType };
  });
  const Page = lazy(cached);
  loaders.set(Page, cached);
  return Page;
};
const routes = [
  {
    pattern: /^\/secret\/atlas\/?$/,
    params: [],
    Page: lazyPage(() => import("../src/app/secret/atlas/page")),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/plan/?$"),
    params: ["tripId"],
    Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/plan/page")),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/money/?$"),
    params: ["tripId"],
    Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/money/page")),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/checklist/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/checklist/page"),
    ),
  },

  {
    pattern: /^\/secret\/control-room\/intelligence\/?$/,
    params: [],
    Page: lazyPage(() => import("../src/app/secret/control-room/intelligence/page")),
  },
  {
    pattern: /^\/secret\/control-room\/experiments\/hey-atlas\/?$/,
    params: [],
    Page: lazyPage(
      () => import("../src/app/secret/control-room/experiments/hey-atlas/page"),
    ),
  },
  {
    pattern: /^\/secret\/control-room\/?$/,
    params: [],
    Page: lazyPage(() => import("../src/app/secret/control-room/page")),
  },
  {
    pattern: new RegExp("^/secret/music/downloads/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/music/downloads/page")),
  },
  {
    pattern: new RegExp("^/secret/music/playlists/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/music/playlists/page")),
  },
  {
    pattern: new RegExp("^/secret/music/settings/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/music/settings/page")),
  },
  {
    pattern: new RegExp("^/secret/music/artists/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/music/artists/page")),
  },
  {
    pattern: new RegExp("^/secret/music/library/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/music/library/page")),
  },
  {
    pattern: new RegExp("^/secret/music/albums/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/music/albums/page")),
  },
  {
    pattern: new RegExp("^/secret/music/queue/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/music/queue/page")),
  },
  {
    pattern: new RegExp("^/secret/vault/new/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/vault/new/page")),
  },
  {
    pattern: new RegExp("^/secret/finance/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/finance/page")),
  },
  {
    pattern: new RegExp("^/secret/gallery/library/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/gallery/library/page")),
  },
  {
    pattern: new RegExp("^/secret/gallery/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/gallery/page")),
  },
  {
    pattern: new RegExp("^/secret/studio/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/studio/page")),
  },
  {
    pattern: new RegExp("^/secret/music/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/music/page")),
  },
  {
    pattern: new RegExp("^/secret/vault/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/vault/page")),
  },
  {
    pattern: new RegExp("^/secret/?$"),
    params: [],
    Page: lazyPage(() => import("../src/app/secret/page")),
  },
  {
    pattern: new RegExp("^/secret/music/playlists/([^/]+)/?$"),
    params: ["playlistId"],
    Page: lazyPage(
      () => import("../src/app/secret/music/playlists/[playlistId]/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/assistant/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/assistant/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/documents/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/documents/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/itinerary/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/itinerary/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/reminders/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/reminders/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/bookings/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/bookings/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/memories/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/memories/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/packing/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/packing/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/rentals/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/rentals/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/budget/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/budget/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/routes/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/routes/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/safety/?$"),
    params: ["tripId"],
    Page: lazyPage(
      () => import("../src/app/secret/vault/[tripId]/safety/page"),
    ),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/food/?$"),
    params: ["tripId"],
    Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/food/page")),
  },
  {
    pattern: new RegExp("^/secret/vault/([^/]+)/?$"),
    params: ["tripId"],
    Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/page")),
  },
];
setRoutePrefetcher((path) => {
  const route = routes.find((route) => route.pattern.test(path));
  if (!route) return;
  return Promise.all([
    loaders.get(route.Page)?.(),
    path.startsWith("/secret/music") ? loadMusicLayout() : undefined,
    path.startsWith("/secret/vault")
      ? import("../src/components/trip-vault/TripVaultFrame")
      : undefined,
  ]);
});
class ScreenError extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div role="alert" className="p-6">
        <h1>Unable to open this screen</h1>
        <p>{this.state.error}</p>
        <a href="/secret">Return to Atlas</a>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const path = usePathname();
  const route = routes.find((r) => r.pattern.test(path));
  const match = route?.pattern.exec(path);
  const params = Object.fromEntries(
    (route?.params || []).map((key, i) => [
      key,
      decodeURIComponent(match?.[i + 1] || ""),
    ]),
  );
  const Page = route?.Page;
  const screen = (
    <ScreenError key={path}>
      <Suspense
        fallback={
          <p role="status" className="p-8">
            Opening Atlas…
          </p>
        }
      >
        {Page ? (
          <Page />
        ) : (
          <p>
            Screen not found. <a href="/secret">Return home</a>
          </p>
        )}
        <ScreenReady token={navigationToken()} />
        {path === "/secret/studio" && (
          <Suspense fallback={null}>
            <SavedStudioEntries />
          </Suspense>
        )}
      </Suspense>
    </ScreenError>
  );
  return (
    <ParamsContext.Provider value={params}>
      <MobileAppBridge />
      <SecretLayout>
        {path.startsWith("/secret/music") ? (
          <Suspense
            fallback={
              <p role="status" className="p-8">
                Opening music…
              </p>
            }
          >
            <MusicLayout>{screen}</MusicLayout>
          </Suspense>
        ) : (
          screen
        )}
      </SecretLayout>
    </ParamsContext.Provider>
  );
}
export function mountApp() {
  installRouteScroll();
  // Start the intended screen and its layout together, including direct launch.
  void prefetchRoute(location.pathname);
  createRoot(document.getElementById("root")!).render(<App />);
}
