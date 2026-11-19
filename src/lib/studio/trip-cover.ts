import {getTrip,patchTripFields} from '../vault/storage';
import {notifyVaultChange} from '../vault/useTripVault';
import type {TripCover} from '../public-trips/cover';
import {appServiceUrl} from '../appNetwork';
export async function saveTripCoverDraft(tripId:string,id:string|null){
 const saved=await patchTripFields(tripId,{websiteHeroMediaId:id});notifyVaultChange();return saved;
}
export async function readTripCoverLibrary(slug:string):Promise<{hero:TripCover|null;media:TripCover[]}>{
 const response=await fetch(`/api/vault/export?coverFor=${encodeURIComponent(slug)}`);const result=await response.json();
 if(!response.ok)throw Error(result.error||'Could not open this trip’s published media.');return result;
}
export async function publishTripCover(tripId:string,id:string|null){
 const trip=await getTrip(tripId);if(!trip?.publishedSlug)throw Error('Publish this trip before updating its website cover.');
 const response=await fetch('/api/vault/export',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Publish':'1','X-Capacitor-Platform':'android'},body:JSON.stringify({action:'trip-cover',existingSlug:trip.publishedSlug,heroMediaId:id})});
 const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'The website cover could not be updated. Your draft is saved.');
 await saveTripCoverDraft(tripId,id);const service=appServiceUrl('/api/vault/export');return {...result,publicUrl:service.startsWith('http')?new URL(result.publicUrl,service).href:result.publicUrl};
}
