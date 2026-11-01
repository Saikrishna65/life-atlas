"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getAllTrips, saveTrip } from '@/lib/vault/storage';
import type { TripRecord } from '@/lib/vault/types';
import { IndexedDBUnitOfWork } from '@/lib/finance';
import { TripFinanceService } from '@/lib/finance/trips/service';
import { defaultTripSettings, needsTripConfirmation, tripReminderAt } from '@/lib/finance/trips/policy';
import './trips.css';

function reminderId(id:string){let hash=17;for(const ch of `finance-confirm-${id}`)hash=(hash*31+ch.charCodeAt(0))|0;return 1100000000+(Math.abs(hash)%900000000);}
export default function TripFinanceBridge(){
 const [due,setDue]=useState<TripRecord[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const running=useRef(false);const router=useRouter();
 const refresh=useCallback(async()=>{
  if(running.current || !window.indexedDB || new URLSearchParams(location.search).get('demo')==='1')return;running.current=true;
  try{
   const trips=await getAllTrips();setDue(trips.filter(t=>needsTripConfirmation(t)));
   if(await new TripFinanceService(new IndexedDBUnitOfWork()).reconcile())window.dispatchEvent(new Event('finance-trips-updated'));
   if(Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')){
    const permission=await LocalNotifications.checkPermissions();
    if(permission.display==='granted'){
     await LocalNotifications.createChannel({id:'atlas_trip_finance',name:'Trip confirmations',importance:4,visibility:0});
     const pending=await LocalNotifications.getPending();
     const expected=new Map(trips.flatMap(t=>{const s=defaultTripSettings(t);if(!s||s.confirmation!=='planned'||t.status==='ARCHIVED')return [];const at=new Date(tripReminderAt(s));return at.getTime()>Date.now()?[[reminderId(t.id),{trip:t,at}] as const]:[];}));
     const stale=pending.notifications.filter(n=>n.extra?.kind==='trip-finance'&&!expected.has(n.id));
     if(stale.length)await LocalNotifications.cancel({notifications:stale.map(n=>({id:n.id}))});
     for(const [id,{trip,at}] of expected){const existing=pending.notifications.find(n=>n.id===id);if(existing && existing.extra?.at===at.toISOString())continue;
      await LocalNotifications.schedule({notifications:[{id,title:`Are you going to ${trip.title}?`,body:'Confirm your trip to collect its spending automatically.',schedule:{at,allowWhileIdle:true},channelId:'atlas_trip_finance',extra:{kind:'trip-finance',tripId:trip.id,at:at.toISOString()}}]});
     }
    }
   }
  }catch(e){console.warn('Trip Finance refresh failed',e);}finally{running.current=false;}
 },[]);
 useEffect(()=>{void refresh();const listener=()=>{void refresh();};const visible=()=>{if(document.visibilityState==='visible')void refresh();};const timer=setInterval(listener,60000);window.addEventListener('life_atlas_vault_change',listener);document.addEventListener('visibilitychange',visible);window.addEventListener('focus',listener);
  let disposed=false;let remove:(()=>Promise<void>)|undefined;
  if(Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('LocalNotifications'))void LocalNotifications.addListener('localNotificationActionPerformed',event=>{if(event.notification.extra?.kind==='trip-finance'){router.push(`/secret/finance?trip=${encodeURIComponent(event.notification.extra.tripId)}`);window.dispatchEvent(new CustomEvent('open-finance-trips',{detail:{tripId:event.notification.extra.tripId}}));}}).then(handle=>{if(disposed)void handle.remove();else remove=()=>handle.remove();});
  return()=>{disposed=true;if(remove)void remove();clearInterval(timer);window.removeEventListener('life_atlas_vault_change',listener);window.removeEventListener('focus',listener);document.removeEventListener('visibilitychange',visible);};
 },[refresh,router]);
 const confirm=async(trip:TripRecord,going:boolean)=>{setBusy(trip.id);setError('');try{const latest=(await getAllTrips()).find(t=>t.id===trip.id);if(!latest)throw new Error('Trip no longer exists.');const settings=defaultTripSettings(latest);if(!settings)throw new Error('Set the trip timings first.');await saveTrip({...latest,finance:{...settings,confirmation:going?'going':'cancelled',confirmedAt:going?new Date().toISOString():undefined},updatedAt:new Date().toISOString()});await refresh();window.dispatchEvent(new Event('life_atlas_vault_change'));window.dispatchEvent(new Event('finance-trips-updated'));}catch(e){setError(e instanceof Error?e.message:'Unable to confirm trip.');}finally{setBusy('');}};
 if(!due.length)return null;
 return <aside className="trip-confirmation-stack" aria-label="Upcoming trip confirmations">{due.map(trip=><article key={trip.id}><div><span className="trip-kicker">YOUR UPCOMING TRIP</span><h2>Still going to {trip.title}?</h2><p>Confirm to collect eligible payments during your trip automatically.</p></div><div className="trip-confirmation-actions"><button disabled={!!busy} onClick={()=>void confirm(trip,true)}>Yes, I’m going</button><button disabled={!!busy} onClick={()=>void confirm(trip,false)}>Not going</button><Link href={`/secret/finance?trip=${encodeURIComponent(trip.id)}`}>Reschedule / review</Link></div></article>)}{error&&<p role="alert">{error}</p>}</aside>;
}
