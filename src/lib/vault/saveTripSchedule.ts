import {getVaultDB} from './storage';
import type {TripRecord,ItineraryDayRecord} from './types';
import {isControlRestoreActive} from '../control-room/maintenance';
/** Saves scheduling edits and dates previously relative plan days in one transaction. */
export async function saveTripSchedule(trip:TripRecord,expectedUpdatedAt:string):Promise<TripRecord>{
 if(isControlRestoreActive())throw Error('Wait for the cloud restore to finish.');
 const db=await getVaultDB(),updated={...trip,updatedAt:new Date().toISOString()};
 return new Promise((resolve,reject)=>{const tx=db.transaction(['trips','itineraries'],'readwrite');let problem:Error|undefined;const fail=(message:string)=>{problem=Error(message);tx.abort();};
 const read=tx.objectStore('trips').get(trip.id);read.onsuccess=()=>{const current=read.result as TripRecord|undefined;if(!current){fail('This trip no longer exists.');return;}if(current.updatedAt!==expectedUpdatedAt){fail('This trip changed while editing. Close and reopen its details.');return;}
 tx.objectStore('trips').put(updated);
 if(!updated.startDate)return;
 const request=tx.objectStore('itineraries').index('by-tripId').getAll(trip.id);request.onsuccess=()=>{const days=request.result as ItineraryDayRecord[],first=Math.min(...days.map(d=>d.dayIndex));for(const day of days){if(day.date)continue;const date=new Date(updated.startDate.slice(0,10)+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+day.dayIndex-first);tx.objectStore('itineraries').put({...day,date:date.toISOString().slice(0,10),updatedAt:updated.updatedAt});}};};
 tx.oncomplete=()=>resolve(updated);tx.onerror=()=>reject(problem||tx.error||Error('Could not save travel dates.'));tx.onabort=()=>reject(problem||tx.error||Error('Could not save travel dates.'));
 });
}
