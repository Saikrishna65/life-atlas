import type {TripRecord} from './types';
import {wallTime,zonedInstant,validateTripSettings,defaultTripSettings,type TripFinanceSettings} from '../finance/trips/policy';
export interface ScheduleInput {start:string;end:string;departureTime:string;returnTime:string;timeZone:string;}
function calendar(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Choose a valid travel date.');return value+'T00:00:00.000Z';}
export function tripScheduleInput(trip?:TripRecord):ScheduleInput {const timing=trip?defaultTripSettings(trip):null,zone=timing?.timeZone||trip?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Kolkata';const departure={MORNING:'08:00',AFTERNOON:'13:00',EVENING:'18:00',NIGHT:'21:00',OVERNIGHT:'23:00'},arrival={EARLY_MORNING:'05:00',MORNING:'08:00',AFTERNOON:'13:00',EVENING:'18:00',NIGHT:'22:00'};return {start:trip?.startDate?.slice(0,10)||'',end:trip?.endDate?.slice(0,10)||'',departureTime:timing?wallTime(timing.startAt,zone).slice(11,16):trip?.departureTime||departure[trip?.departureSlot||'MORNING'],returnTime:timing?wallTime(timing.endAt,zone).slice(11,16):trip?.returnTime||arrival[trip?.returnSlot||'NIGHT'],timeZone:zone};}
export function scheduleFields(input:ScheduleInput):Pick<TripRecord,'startDate'|'endDate'|'departureTime'|'returnTime'|'timeZone'|'finance'|'departureSlot'|'returnSlot'>{
 const{start,end,departureTime,returnTime,timeZone}=input;
 if(end&&!start)throw Error('Choose a departure date before adding a return date.');
 if(!start)return {startDate:'',endDate:undefined,departureTime:undefined,returnTime:undefined,timeZone,finance:undefined,departureSlot:undefined,returnSlot:undefined};
 const startDate=calendar(start),endDate=end?calendar(end):undefined;
 if(end&&end<start)throw Error('Return date must be on or after departure.');
 if(!/^\d{2}:\d{2}$/.test(departureTime)||end&&!/^\d{2}:\d{2}$/.test(returnTime))throw Error('Choose the departure and return times.');
 try{new Intl.DateTimeFormat('en',{timeZone}).format();}catch{throw Error('Enter a valid travel timezone, such as Asia/Kolkata.');}
 const startAt=zonedInstant(start+'T'+departureTime,timeZone);let finance:TripFinanceSettings|undefined;
 if(end){finance={startAt,endAt:zonedInstant(end+'T'+returnTime,timeZone),timeZone,confirmation:'planned'};validateTripSettings(finance);}
 const hour=Number(departureTime.slice(0,2)),returnHour=Number(returnTime.slice(0,2));
 return {startDate,endDate,departureTime,returnTime:end?returnTime:undefined,timeZone,finance,departureSlot:hour<12?'MORNING':hour<17?'AFTERNOON':hour<21?'EVENING':'NIGHT',returnSlot:!end?undefined:returnHour<6?'EARLY_MORNING':returnHour<12?'MORNING':returnHour<17?'AFTERNOON':returnHour<21?'EVENING':'NIGHT'};
}
export function scheduleChanged(trip:TripRecord,input:ScheduleInput){const old=tripScheduleInput(trip);return (['start','end','departureTime','returnTime','timeZone'] as const).some(key=>old[key]!==input[key]&&(key==='start'||key==='end'||!!input.start));}
export function tripScheduleLabel(trip:TripRecord,locale?:string){if(!trip.startDate)return 'Dates not set';const s=tripScheduleInput(trip),day=(value:string)=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));return `${day(s.start)} · ${s.departureTime}${s.end?` — ${day(s.end)} · ${s.returnTime}`:''}`;}
