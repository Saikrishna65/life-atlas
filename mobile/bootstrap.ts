import { beginAppStartup } from "../src/lib/performance/metrics";
beginAppStartup();
import { installMobileNetwork } from "./network";
import { installNativeDownloads } from "./downloads";

import { installLaunchRoutes } from "./launch-routes";
const launches = installLaunchRoutes(window);

async function start() {
  installMobileNetwork();
  installNativeDownloads();
  // Render local content first. Publishing and obsolete hosted-cache cleanup
  // must never block opening Atlas, including when the network is unavailable.
  const { mountApp } = await import("./App");
  const { navigate } = await import("./navigation");
  launches.ready((route) => navigate(route, true));
  mountApp();
  void import("./startup-maintenance")
    .then(({ scheduleStartupMaintenance }) => scheduleStartupMaintenance())
    .catch(() => {});
}
start().catch(() => {
  document.body.textContent =
    "Atlas could not open. Close and reopen the app to retry. Your saved data is unchanged.";
});
