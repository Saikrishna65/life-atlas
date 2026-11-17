export class StudioInputError extends Error {}
export const SECTION_KEYS=['people','ribbon','hero','archive'] as const;
export type SectionKey=typeof SECTION_KEYS[number];
export interface SceneItem {id:string;kind:'photo'|'video'|'trip';src?:string;poster?:string;title:string;alt?:string;tripSlug?:string;}
export interface SectionContent {mode:'automatic'|'curated';items:SceneItem[];}
export interface SectionRecord {key:SectionKey;revision:number;content:SectionContent;}
export const sectionNames:Record<SectionKey,string>={people:'People along the way',ribbon:'My life, collected',hero:'Hero trips',archive:'My roads & my stories'};
export const sectionLimits:Record<SectionKey,number>={people:8,ribbon:32,hero:3,archive:100};
export function sectionKey(value:unknown):SectionKey {if(!SECTION_KEYS.includes(value as SectionKey))throw new StudioInputError('Choose a homepage section.');return value as SectionKey;}
export function publicAsset(value:unknown):value is string {
 if(typeof value!=='string'||value.length>2500)return false;
 if(/^\/api\/public\/studio-photo\/[a-zA-Z0-9_-]{1,180}(?:\?width=(?:320|480|960))?$/.test(value))return true;
 try{if(/^\/(images|films)\/[a-zA-Z0-9_./%-]+$/.test(value)&&!decodeURIComponent(value).split('/').includes('..'))return true;}catch{return false;}
 try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!url.hostname.endsWith('.r2.cloudflarestorage.com')&&!url.pathname.startsWith('/encrypted/')&&![...url.searchParams.keys()].some(key=>/token|secret|credential|signature|x-amz/i.test(key));}catch{return false;}
}
export function validateSection(key:SectionKey,value:unknown):SectionContent {
 const data=value as Partial<SectionContent>|null;
 if(!data||!['automatic','curated'].includes(String(data.mode))||!Array.isArray(data.items)||data.items.length>sectionLimits[key])throw new StudioInputError(`Choose up to ${sectionLimits[key]} items for this section.`);
 if(data.mode==='automatic')return {mode:'automatic',items:[]};
 if(['hero','archive'].includes(key)&&!data.items.length)throw new StudioInputError('Choose at least one journey, or use automatic selection.');
 const ids=new Set<string>();const sources=new Set<string>();
 const items=data.items.map(item=>{
  if(!item||typeof item.id!=='string'||item.id.length>160||!item.id||ids.has(item.id)||typeof item.title!=='string'||item.title.length>160)throw new StudioInputError('Invalid or duplicate selection.');
  ids.add(item.id);
  if(['hero','archive'].includes(key)){if(item.kind!=='trip'||typeof item.tripSlug!=='string'||!/^[a-zA-Z0-9_-]{1,180}$/.test(item.tripSlug))throw new StudioInputError('Choose published trips for this section.');return {id:item.id,kind:'trip' as const,title:item.title,tripSlug:item.tripSlug};}
  if(!['photo','video'].includes(item.kind)||key==='people'&&item.kind!=='photo'||!publicAsset(item.src)||item.poster&&!publicAsset(item.poster))throw new StudioInputError('Choose public photos or videos; People along the way accepts photos only.');
  if(sources.has(item.src))throw new StudioInputError("This photo or video is already selected.");sources.add(item.src);
  return {id:item.id,kind:item.kind,src:item.src,poster:item.poster,title:item.title,alt:typeof item.alt==='string'?item.alt.slice(0,240):undefined,tripSlug:typeof item.tripSlug==='string'?item.tripSlug.slice(0,180):undefined};
 });return {mode:'curated',items};
}
export function automaticSections():Record<SectionKey,SectionRecord>{return Object.fromEntries(SECTION_KEYS.map(key=>[key,{key,revision:0,content:{mode:'automatic',items:[]}}])) as unknown as Record<SectionKey,SectionRecord>;}
export function orderedSelection<T>(items:T[],slugs:string[],slug:(item:T)=>string):T[]{const map=new Map(items.map(item=>[slug(item),item]));return slugs.flatMap(value=>map.has(value)?[map.get(value)!]:[]);}
