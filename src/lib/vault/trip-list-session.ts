import { SessionResource } from "../performance/session-resource";
import { getAllTrips, isIndexedDBAvailable } from "./storage";
import { syncActiveTripToWidget } from "./tripWidgetSync";
import type { TripRecord } from "./types";
export const VAULT_CHANGE_EVENT = "life_atlas_vault_change";
export const tripListSession = new SessionResource<TripRecord[]>(
  async () => {
    if (!isIndexedDBAvailable()) throw new Error("Storage unavailable");
    const trips = await getAllTrips();
    // Reuse this read; each hook used to read the full vault again for its widget.
    void syncActiveTripToWidget(undefined, trips);
    return trips;
  },
  [],
  "Unable to load expeditions from local storage.",
);
let users = 0;
let expiry: ReturnType<typeof setTimeout> | undefined;
const changed = () => {
  tripListSession.invalidate();
  void tripListSession.refresh();
};
const visible = () => {
  if (!document.hidden) changed();
};
/** A single event subscription/read for any number of mounted Trip Vault consumers. */
export function subscribeTripList(listener: () => void) {
  if (expiry) {
    clearTimeout(expiry);
    expiry = undefined;
  }
  const unsubscribe = tripListSession.subscribe(listener);
  if (users++ === 0) {
    window.addEventListener(VAULT_CHANGE_EVENT, changed);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    void tripListSession.refresh();
  }
  return () => {
    unsubscribe();
    if (--users !== 0) return;
    window.removeEventListener(VAULT_CHANGE_EVENT, changed);
    window.removeEventListener("focus", visible);
    document.removeEventListener("visibilitychange", visible);
    // Keep one short-lived snapshot for back navigation, then release its routes/media metadata.
    expiry = setTimeout(() => {
      expiry = undefined;
      tripListSession.clear();
    }, 30000);
  };
}
