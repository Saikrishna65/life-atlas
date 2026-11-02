/** CSRF boundary shared by browser and bundled Capacitor requests; not account authentication. */
export function allowAtlasMutation(request: Request, featureHeader: string): boolean {
 const origin=request.headers.get('origin');
 const fetchSite=request.headers.get('sec-fetch-site');
 if(request.headers.get(featureHeader)!=='1'||fetchSite==='cross-site')return false;
 // Android's legacy fetch bridge passes through a browser Request first,
 // stripping Origin. Native HTTP has no Fetch Metadata; accept that transport
 // only with both explicit app headers. Browser cross-site requests remain
 // rejected, and each feature still applies its own authentication.
 if(!origin)return !fetchSite&&request.headers.get('x-capacitor-platform')==='android';
 if(origin===new URL(request.url).origin)return true;
 return (origin==='https://localhost'||origin==='capacitor://localhost')&&request.headers.get('x-capacitor-platform')==='android';
}
