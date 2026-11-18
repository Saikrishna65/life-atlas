import {publishedTripMedia} from './detail';
import type {ScrapbookFrame} from './scrapbook';
/** Input journeys are the public trips linked to this place record, never a global catalog. */
export function placeGalleryFrames(name:string,photos:{id:string;url:string;caption:string|null;tripId?:string|null}[],journeys:{trip:{id:string;slug:string;title:string;routeData:unknown}}[]):ScrapbookFrame[]{
 const normalize=(s:string)=>s.trim().normalize('NFC').toLocaleLowerCase();
 const frames:ScrapbookFrame[]=photos.filter(p=>p.url).map(p=>({id:p.id,src:p.url,preview:p.url,title:p.caption||name,tripId:p.tripId||name,tripTitle:journeys.find(j=>j.trip.id===p.tripId)?.trip.title||name,kind:'photo',sample:false}));
 for(const {trip} of journeys)for(const item of publishedTripMedia(trip.routeData))if(normalize(item.place)===normalize(name))frames.push({id:item.id,src:item.url,preview:item.poster||(item.kind==='photo'?item.url:''),title:item.caption||name,tripId:trip.id,tripTitle:trip.title,kind:item.kind==='video'?'film':'photo',sample:false});
 return [...new Map(frames.map(f=>[f.src,f])).values()];
}
