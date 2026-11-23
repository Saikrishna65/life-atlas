import { installMobileNetwork } from "./network";
import { installNativeDownloads } from "./downloads";

async function start() {
  if (!location.pathname.startsWith("/secret"))
    history.replaceState({}, "", "/secret");
  installMobileNetwork();
  installNativeDownloads();
  // Render local content first. Publishing and obsolete hosted-cache cleanup
  // must never block opening Atlas, including when the network is unavailable.
  const { mountApp } = await import("./App");
  mountApp();
  void import("./startup-maintenance")
    .then(({ scheduleStartupMaintenance }) => scheduleStartupMaintenance())
    .catch(() => {});
}
start().catch(() => {
  document.body.textContent =
    "Atlas could not open. Close and reopen the app to retry. Your saved data is unchanged.";
});
