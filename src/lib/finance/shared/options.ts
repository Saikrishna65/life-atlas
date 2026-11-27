import { listSharedGroups } from "./service";
let loading: ReturnType<typeof listSharedGroups> | null = null;
/** Coalesce controls opened in the same review; never retain completed private group data. */
export function loadSharedOptions() {
  if (!loading)
    loading = listSharedGroups().finally(() => {
      loading = null;
    });
  return loading;
}
