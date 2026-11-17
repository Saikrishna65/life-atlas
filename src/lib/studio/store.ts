import type {SelectedMedia} from '../r2/types';
import type {SectionRecord,SectionKey,SectionContent} from './sections';
import {getTrip,saveTrip} from '../vault/storage';
import {notifyVaultChange} from '../vault/useTripVault';
import type {TripRecord} from '../vault/types';
export interface SectionDraft {id:string;kind:'website-section';section:'Website section';fields:{title:string};key:SectionKey;revision:number;content:SectionContent;updatedAt:string;pendingFiles?:SelectedMedia[];transfers?:Record<string,string>;}
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('life_atlas_studio_db',1);request.onupgradeneeded=()=>request.result.createObjectStore('entries',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function saveSectionDraft(record:SectionRecord&{pendingFiles?:SelectedMedia[];transfers?:Record<string,string>}){const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('entries','readwrite');tx.objectStore('entries').put({id:`website-section-${record.key}`,kind:'website-section',section:'Website section',fields:{title:record.key},key:record.key,revision:record.revision,content:record.content,updatedAt:new Date().toISOString(),pendingFiles:record.pendingFiles,transfers:record.transfers} satisfies SectionDraft);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function readSectionDrafts():Promise<SectionDraft[]>{const db=await open();try{return await new Promise((resolve,reject)=>{const request=db.transaction('entries').objectStore('entries').getAll();request.onsuccess=()=>resolve(request.result.filter(item=>item.kind==='website-section'));request.onerror=()=>reject(request.error);});}finally{db.close();}}
export async function clearSectionDraft(key:SectionKey){const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('entries','readwrite');tx.objectStore('entries').delete(`website-section-${key}`);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export interface PastTripFields {title:string;destination:string;startDate:string;endDate:string;}
export async function savePastTrip(fields:PastTripFields,id?:string):Promise<TripRecord>{
 const title=fields.title.trim();if(!title)throw Error('Give this journey a title.');
 if(fields.startDate&&!Number.isFinite(Date.parse(fields.startDate))||fields.endDate&&!Number.isFinite(Date.parse(fields.endDate)))throw Error('Choose valid travel dates, or leave them empty.');
 if(fields.startDate&&fields.endDate&&fields.endDate<fields.startDate)throw Error('Return date must be after departure.');
 const previous=id?await getTrip(id):null;
 if(id&&(!previous||previous.studioOrigin!=='past-trip'))throw Error('Edit an existing vault trip in Trip Vault so its linked plans stay consistent.');
 if(previous&&(previous.status==='ACTIVE'||previous.liveExpedition?.status==='ACTIVE'))throw Error('Edit an active journey in Trip Vault. Its existing recording was preserved.');
 const now=new Date().toISOString();
 const trip:TripRecord={...(previous??{id:crypto.randomUUID(),status:'ARCHIVED',travelStyle:'OTHER',budgetTotal:0,currency:'INR',createdAt:now}),studioOrigin:'past-trip',title,destination:fields.destination.trim(),startDate:fields.startDate,endDate:fields.endDate||undefined,updatedAt:now};
 await saveTrip(trip);notifyVaultChange();return trip;
}
