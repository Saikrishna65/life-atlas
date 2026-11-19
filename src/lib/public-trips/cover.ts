import {publicAsset} from '../studio/sections';
export interface TripCover {id:string;url:string;kind:'photo'|'video';poster?:string;place?:string;}
export class TripCoverError extends Error { constructor(){super('Choose a photo or video already published in this trip.');} }
const asset=publicAsset;
export function readTripCover(route:unknown):TripCover|null {
 const hero=(route as {publication?:{hero?:Partial<TripCover>}}|null)?.publication?.hero;
 if(!hero||typeof hero.id!=='string'||!asset(hero.url)||(hero.kind!=='photo'&&hero.kind!=='video'))return null;
 return {id:hero.id,url:hero.url,kind:hero.kind,...(asset(hero.poster)?{poster:hero.poster}:{}),...(typeof hero.place==='string'?{place:hero.place}:{})};
}
export function tripCoverCandidates(route:unknown,photos:readonly {id:string;url:string}[]=[]):TripCover[]{
 const media=(route as {publication?:{media?:unknown}}|null)?.publication?.media;
 const published:TripCover[]=Array.isArray(media)?media.flatMap(item=>item&&typeof item.id==='string'&&asset(item.url)&&(item.kind==='photo'||item.kind==='video')?[{id:item.id,url:item.url,kind:item.kind,...(asset(item.poster)?{poster:item.poster}:{}),...(typeof item.place==='string'?{place:item.place}:{})}]:[]):[];
 const legacy=photos.flatMap(photo=>{const url=photo.url.startsWith('data:image/')?`/api/public/studio-photo/${photo.id}`:photo.url;return asset(url)?[{id:`photo-${photo.id}`,url,kind:'photo' as const}]:[];});
 return [...new Map([...legacy,...published].map(item=>[item.url,item])).values()];
}
export function chooseTripCover(items:readonly TripCover[],id:unknown):TripCover|null {
 if(id===null)return null;
 if(typeof id!=='string'||!id||id.length>200)throw new TripCoverError();
 const selected=items.find(item=>item.id===id);if(!selected)throw new TripCoverError();return selected;
}
export function routeWithTripCover(route:unknown,hero:TripCover|null):Record<string,unknown>{
 const previous=route&&typeof route==='object'&&!Array.isArray(route)?route as Record<string,unknown>:{};
 const publication=previous.publication&&typeof previous.publication==='object'&&!Array.isArray(previous.publication)?previous.publication as Record<string,unknown>:{};
 const next={...publication};if(hero)next.hero=hero;else delete next.hero;
 return {...previous,publication:next};
}
export function tripCoverImage(hero:TripCover|null,current:string|null,items:readonly TripCover[]):string|null {
 return hero?.kind==='photo'?hero.url:hero?.poster||items.find(item=>item.kind==='photo')?.url||current;
}
