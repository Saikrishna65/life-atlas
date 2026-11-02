import { Capacitor } from '@capacitor/core';
import { MOBILE_API_ORIGIN } from '../src/lib/appNetwork';
export function rewriteServiceLinks(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('/api/')) return new URL(value, MOBILE_API_ORIGIN).href;
  if (Array.isArray(value)) return value.map(rewriteServiceLinks);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,rewriteServiceLinks(v)]));
  return value;
}
export function installMobileNetwork(fetchImpl: typeof fetch = window.fetch.bind(window)) {
  window.fetch = async (input, init) => {
    const source = input instanceof Request ? input.url : String(input);
    const url = new URL(source, location.href);
    const serviceRequest = url.origin === location.origin && url.pathname.startsWith('/api/');
    if (!serviceRequest) return fetchImpl(input, init);
    if (!navigator.onLine) return new Response(JSON.stringify({success:false,error:'You are offline. Your local data remains available.'}),{status:503,headers:{'Content-Type':'application/json'}});
    const target = new URL(url.pathname + url.search, MOBILE_API_ORIGIN).href;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (Capacitor.isNativePlatform()) {
      headers.set('X-Capacitor-Platform','android');
      headers.set('Origin',location.origin);
    }
    const options: RequestInit = {...init,headers};
    const response = await fetchImpl(input instanceof Request ? new Request(target,input) : target,options);
    // <audio>, <img>, downloads and persistent records must also point at the remote API.
    if (response.headers.get('Content-Type')?.includes('application/json')) {
      const body = rewriteServiceLinks(await response.json());
      const nextHeaders = new Headers(response.headers);nextHeaders.delete('Content-Length');nextHeaders.delete('Content-Encoding');
      return new Response(JSON.stringify(body),{status:response.status,statusText:response.statusText,headers:nextHeaders});
    }
    return response;
  };
}
