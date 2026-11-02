/** CSRF boundary shared by browser and bundled Capacitor requests; not account authentication. */
export function allowAtlasMutation(request: Request, featureHeader: string): boolean {
 const origin=request.headers.get('origin');
 if(!origin||request.headers.get(featureHeader)!=='1'||request.headers.get('sec-fetch-site')==='cross-site')return false;
 if(origin===new URL(request.url).origin)return true;
 return (origin==='https://localhost'||origin==='capacitor://localhost')&&request.headers.get('x-capacitor-platform')==='android';
}
