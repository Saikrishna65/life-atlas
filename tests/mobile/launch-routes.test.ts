import { test } from "node:test";
import assert from "node:assert/strict";
import { installLaunchRoutes, safePrivateRoute } from "../../mobile/launch-routes";

function host(path = "/", initial: string | null = null) {
  const target = new EventTarget();
  const location = { pathname: path, search: "" };
  const changes: string[] = [];
  const window = Object.assign(target, {
    location,
    history: { replaceState(_state: unknown, _unused: string, route: string) {
      changes.push(route);
      const url = new URL(route, "https://localhost");
      location.pathname = url.pathname; location.search = url.search;
    } },
    AtlasModuleLaunch: { getInitialRoute: () => initial },
  });
  return { window: window as unknown as Window, location, changes, target };
}
function send(target: EventTarget, route: string) {
  target.dispatchEvent(new CustomEvent("atlas:open-route", { detail: route }));
}

test("native module icons select their destination before the app mounts", () => {
  for (const name of ["finance", "music", "gallery"]) {
    const h = host("/", `/secret/${name}`);
    const launch = installLaunchRoutes(h.window);
    assert.deepEqual(h.changes, [`/secret/${name}`]);
    launch.dispose();
  }
});
test("early intents are retained and warm intents use the router, without document navigation", () => {
  const h = host();
  const launch = installLaunchRoutes(h.window);
  send(h.target, "/secret/music");
  const routed: string[] = [];
  launch.ready((route) => routed.push(route));
  send(h.target, "/secret/music"); // Already open: no restart.
  send(h.target, "/secret/gallery");
  assert.deepEqual(h.changes, ["/secret", "/secret/music"]);
  assert.deepEqual(routed, ["/secret/gallery"]);
  launch.dispose();
  send(h.target, "/secret/finance");
  assert.equal(routed.length, 1);
});
test("deep links keep their query and pending route is consumed once", () => {
  const h = host("/secret/finance");
  h.location.search = "?review=1";
  installLaunchRoutes(h.window);
  assert.deepEqual(h.changes, []);
  const pending = host();
  Object.assign(pending.window, { __atlasPendingRoute: "/secret/gallery" });
  installLaunchRoutes(pending.window);
  assert.equal(pending.location.pathname, "/secret/gallery");
  assert.equal("__atlasPendingRoute" in pending.window, false);
});
test("only private in-app routes can be handed to the router", () => {
  for (const invalid of [null, {}, "//evil.test/secret", "https://evil.test/secret", "/secretary", "/secret/../admin", "/secret/%2e%2e/admin", "/secret\\music", "/secret#x", "/secret?x=1?y=2", "/secret?x='script'", "/secret/%", "/secret\n"]) {
    assert.equal(safePrivateRoute(invalid), null, String(invalid));
  }
  assert.equal(safePrivateRoute("/secret/finance?review=1&event=gmsg_abc"), "/secret/finance?review=1&event=gmsg_abc");
});
