"use client";
import {useState,type FormEvent} from 'react';
import {Plus,ArrowUpRight} from 'lucide-react';
import Link from 'next/link';
import {useTripVault} from '@/lib/vault/useTripVault';
import {savePastTrip,type PastTripFields} from '@/lib/studio/store';
import TripMapPicker from './TripMapPicker';
import TripPlacesEditor from './TripPlacesEditor';
import TripWebsitePublisher from '@/components/trip-vault/TripWebsitePublisher';
const empty:PastTripFields={title:'',destination:'',startDate:'',endDate:''};
export default function PastTrips(){
 const {trips,refreshTrips,isLoading}=useTripVault();const [selected,setSelected]=useState(''),[creating,setCreating]=useState(false),[fields,setFields]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const trip=trips.find(trip=>trip.id===selected);
 const choose=(id:string)=>{setSelected(id);setCreating(false);setError('');const saved=trips.find(trip=>trip.id===id);setFields(saved?{title:saved.title,destination:saved.destination,startDate:saved.startDate?.slice(0,10)||'',endDate:saved.endDate?.slice(0,10)||'',mapLocation:saved.websiteLocation}:empty);};
 async function save(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{const saved=await savePastTrip(fields,creating?undefined:selected||undefined);await refreshTrips();setSelected(saved.id);setCreating(false);}catch(e){setError(e instanceof Error?e.message:'Could not save this trip.');}finally{setBusy(false);}}
 return <div className="cs-past"><div className="cs-section-intro"><div><p className="cs-eyebrow">BRING AN OLD JOURNEY HOME</p><h2>Past trips.<br/><em>New chapters.</em></h2><p>Start with your trip and its map pin. Then add places and their photos or videos. Dates and an itinerary are optional.</p></div><button className="cs-primary" onClick={()=>{setSelected('');setFields(empty);setCreating(true);setError('');}}><Plus size={16}/> Add a past trip</button></div>
 <label className="cs-select-label">Or choose a saved journey<select aria-label="Choose a saved journey" value={selected} disabled={isLoading||busy} onChange={event=>choose(event.target.value)}><option value="">Choose a trip…</option>{trips.map(trip=><option key={trip.id} value={trip.id}>{trip.title}{trip.publishedSlug?' · published':''}</option>)}</select></label>
 {(creating||trip?.studioOrigin==='past-trip')&&<form onSubmit={event=>void save(event)} className="cs-form"><label>Trip title<input required maxLength={140} value={fields.title} onChange={event=>setFields({...fields,title:event.target.value})} placeholder="A summer I still remember"/></label><label>Destination <small>optional</small><input maxLength={200} value={fields.destination} onChange={event=>setFields({...fields,destination:event.target.value})} placeholder="A city, a country, a little somewhere"/></label><TripMapPicker key={selected||'new-trip'} value={fields.mapLocation} onChange={point=>setFields({...fields,mapLocation:point})}/><details><summary>Travel dates <small>optional</small></summary><div className="cs-date-fields"><label>Departure<input aria-label="Past trip departure" type="date" value={fields.startDate} onChange={event=>setFields({...fields,startDate:event.target.value})}/></label><label>Return<input type="date" aria-label="Past trip return" min={fields.startDate||undefined} value={fields.endDate} onChange={event=>setFields({...fields,endDate:event.target.value})}/></label></div></details><button className="cs-primary" disabled={busy||(creating&&!fields.mapLocation)}>{busy?'Saving…':creating?'Save trip & add places':'Save trip details'}</button><p className="cs-note">Saved privately on this device. Nothing is public until you review and publish.</p></form>}
 {error&&<p className="cs-error" role="alert">{error}</p>}
 {trip&&<div className="cs-selected-trip"><div className="cs-selected-heading"><div><span className="cs-eyebrow">{trip.publishedSlug?'PUBLISHED JOURNEY':'LOCAL DRAFT'}</span><h3>{trip.title}</h3></div><Link href={`/secret/vault/${trip.id}`} className="cs-link">Full trip details <ArrowUpRight size={16}/></Link></div><TripPlacesEditor key={`places-${trip.id}`} trip={trip}/>{!!trip.websitePlaces?.length&&<TripWebsitePublisher key={trip.id} tripId={trip.id} organized/>}</div>}
 {!creating&&!trip&&!isLoading&&<p className="cs-note">Your existing trips and cloud recordings stay intact. Choose one to update its website journal, or add a previous trip.</p>}
 </div>;
}
