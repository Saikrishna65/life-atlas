import {getTrip,getItinerariesForTrip,getMemoriesForTrip,patchTripFields} from './storage';
import {notifyVaultChange} from './useTripVault';
import {appServiceUrl} from '../appNetwork';
import {websitePayload,type WebsiteOptions} from './website-payload';
export interface PublishTripResult {success:boolean;slug:string;publicUrl:string;placesCount:number;photoCount:number;memoryCount:number;message:string;}
/** Explicit review only. No automatic uploads and no modification of cloud backups. */
export async function publishTripToWebsite(tripId:string,selection:string[]|WebsiteOptions=[]):Promise<PublishTripResult>{
  if(typeof navigator!=='undefined'&&navigator.onLine===false)throw Error('You are offline. Your trip and previous website post are unchanged.');
  const trip=await getTrip(tripId);if(!trip)throw Error('Trip not found in this vault.');
  const [days,memories]=await Promise.all([getItinerariesForTrip(tripId),getMemoriesForTrip(tripId)]);
  const options:WebsiteOptions=Array.isArray(selection)?{memoryIds:selection}:selection;
  const payload=websitePayload(trip,memories,days,options);
  const body=JSON.stringify(payload);
  if(new Blob([body]).size>3*1024*1024)throw Error('These local photos exceed the website request limit. Use Add photos / videos to upload their originals directly to R2 instead. The website journal was not updated; approved public R2 copies and local originals remain available.');
  const response=await fetch('/api/vault/export',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Publish':'1','X-Capacitor-Platform':'android'},body});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.success)throw Error(result.error||`Publishing failed (${response.status}). Your saved trip is unchanged.`);
  // Fetch again: tracking may have appended points while network/media operations ran.
  await patchTripFields(tripId,{publishedSlug:result.slug,publishedAt:new Date().toISOString()});
  notifyVaultChange();const service=appServiceUrl('/api/vault/export');return {...result,publicUrl:service.startsWith('http')?new URL(result.publicUrl,service).href:result.publicUrl};
}
