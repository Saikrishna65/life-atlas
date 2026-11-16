import {readPublicCatalog} from '@/lib/r2/public-catalog';
import type {PublicMediaCatalog} from '@/lib/r2/types';
const cache=new Map<string,{at:number;promise:Promise<PublicMediaCatalog>}>();
/** Share a public manifest request between hero, ribbon, journal and collection. */
export function cachedPublicCatalog(address:string):Promise<PublicMediaCatalog> {
  const existing=cache.get(address);
  if(existing&&Date.now()-existing.at<30000)return existing.promise;
  const request=new AbortController();
  const timeout=setTimeout(()=>request.abort(),10000);
  const promise=readPublicCatalog(address,request.signal).finally(()=>clearTimeout(timeout));
  cache.set(address,{at:Date.now(),promise});
  void promise.catch(()=>{if(cache.get(address)?.promise===promise)cache.delete(address);});
  if(cache.size>6)cache.delete(cache.keys().next().value!);
  return promise;
}
