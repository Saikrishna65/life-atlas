import {notifyVaultChange} from '../vault/useTripVault';
import {getTrip,patchTripFields} from '../vault/storage';
import type {TripWebsitePlace} from '../vault/types';
import type {SelectedMedia,PublishedMedia} from '../r2/types';
export const MEDIA_BATCH_LIMIT=20;
export const TRIP_PUBLIC_MEDIA_LIMIT=250;
const pending=new Map<string,Promise<unknown>>();
/** Changes only the place collection; GPS recordings and other trip fields stay intact. */
export async function editTripPlaces(tripId:string,edit:(places:TripWebsitePlace[])=>TripWebsitePlace[]){
 const next=(pending.get(tripId)||Promise.resolve()).catch(()=>{}).then(async()=>{const trip=await getTrip(tripId);if(!trip)throw Error('This trip is no longer available.');const places=edit(structuredClone(trip.websitePlaces||[]));const saved=await patchTripFields(tripId,{websitePlaces:places});notifyVaultChange();return saved;});
 pending.set(tripId,next);try{return await next;}finally{if(pending.get(tripId)===next)pending.delete(tripId);}
}
export function addTripPlace(tripId:string,name:string){return editTripPlaces(tripId,places=>{
 const value=name.trim().normalize('NFC');if(!value||value.length>54)throw Error('Add a place name of 1–54 characters.');if(places.some(p=>p.name.toLocaleLowerCase()===value.toLocaleLowerCase()))throw Error('This trip already has that place.');
 return [...places,{id:crypto.randomUUID(),name:value,files:[],transferIds:{},publishedMedia:[]}];
});}
export function addPlaceFiles(tripId:string,placeId:string,files:SelectedMedia[]){return editTripPlaces(tripId,places=>{
 if(files.length>MEDIA_BATCH_LIMIT)throw Error('Select up to 20 photos or videos at a time.');
 if(!files.every(f=>/^(image|video)\//.test(f.mimeType)))throw Error('Choose photos or videos for this place.');
 if(!places.some(p=>p.id===placeId))throw Error('Choose a place in this trip first.');
 const next=places.map(p=>p.id===placeId?{...p,files:[...new Map([...p.files,...files].map(f=>[f.id,f])).values()]}:p);
 if(next.reduce((sum,p)=>sum+p.files.length+p.publishedMedia.length,0)>TRIP_PUBLIC_MEDIA_LIMIT)throw Error('This trip supports up to 250 public photos and videos.');return next;
});}
export function rememberPlaceTransfer(tripId:string,placeId:string,fileId:string,transferId:string){return editTripPlaces(tripId,places=>places.map(p=>p.id===placeId?{...p,transferIds:{...p.transferIds,[fileId]:transferId}}:p));}
export function rememberPlacePublication(tripId:string,placeId:string,fileId:string,item:PublishedMedia){return editTripPlaces(tripId,places=>places.map(p=>p.id===placeId?{...p,files:p.files.filter(f=>f.id!==fileId),publishedMedia:[...p.publishedMedia.filter(m=>m.id!==item.id),item]}:p));}
