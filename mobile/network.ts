import { Capacitor, CapacitorHttp, type HttpOptions, type HttpResponse } from '@capacitor/core';
import { MOBILE_API_ORIGIN } from '../src/lib/appNetwork';
export function rewriteServiceLinks(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('/api/')) return new URL(value, MOBILE_API_ORIGIN).href;
  if (Array.isArray(value)) return value.map(rewriteServiceLinks);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,rewriteServiceLinks(v)]));
  return value;
}
export function installMobileNetwork(fetchImpl: typeof fetch = window.fetch.bind(window), native = {enabled: Capacitor.isNativePlatform(), request: (options: HttpOptions): Promise<HttpResponse> => CapacitorHttp.request(options)}) {
  window.fetch = async (input, init) => {
    const source = input instanceof Request ? input.url : String(input);
    const url = new URL(source, location.href);
    const serviceRequest = url.origin === location.origin && url.pathname.startsWith('/api/');
    if (!serviceRequest) return fetchImpl(input, init);
    if (!navigator.onLine) return new Response(JSON.stringify({success:false,error:'You are offline. Your local data remains available.'}),{status:503,headers:{'Content-Type':'application/json'}});
    const target = new URL(url.pathname + url.search, MOBILE_API_ORIGIN).href;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (native.enabled) {
      headers.set('X-Capacitor-Platform','android');
      headers.set('Origin',location.origin);
    }
    const options: RequestInit = {...init,headers};
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    let response: Response;
    if (native.enabled && (['GET','HEAD'].includes(method.toUpperCase()) || headers.get('Content-Type')?.includes('application/json'))) {
      // The patched fetch constructs a browser Request, which strips forbidden
      // headers such as Origin before calling Android. Pass JSON API requests
      // straight to the native plugin so our CSRF origin survives unchanged.
      const body = init?.body ?? (input instanceof Request && !['GET','HEAD'].includes(method.toUpperCase()) ? await input.clone().text() : undefined);
      const result = await native.request({url:target,method,headers:Object.fromEntries(headers.entries()),...(body == null ? {} : {data:body}),responseType:'text',connectTimeout:30000,readTimeout:60000});
      response = new Response([204,205,304].includes(result.status) ? null : typeof result.data === 'string' ? result.data : JSON.stringify(result.data),{status:result.status,headers:result.headers});
    } else {
      response = await fetchImpl(input instanceof Request ? new Request(target,input) : target,options);
    }
    // <audio>, <img>, downloads and persistent records must also point at the remote API.
    if (response.headers.get('Content-Type')?.includes('application/json')) {
      const body = rewriteServiceLinks(await response.json());
      const nextHeaders = new Headers(response.headers);nextHeaders.delete('Content-Length');nextHeaders.delete('Content-Encoding');
      return new Response(JSON.stringify(body),{status:response.status,statusText:response.statusText,headers:nextHeaders});
    }
    return response;
  };
}
