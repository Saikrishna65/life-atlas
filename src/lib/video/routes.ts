/** The standalone player does not participate in travel-page loading or workspace chrome. */
export function isVideoWebPath(path: string | null): boolean {
  return path === "/video" || path === "/video/";
}
export function videoWebHref(native: boolean, offlineBundle: boolean): string {
  return native || offlineBundle ? "/secret/video" : "/video";
}
