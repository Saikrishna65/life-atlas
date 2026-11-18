"use client";
import dynamic from 'next/dynamic';
import type {WebsiteMapLocation} from '@/lib/vault/types';
const Map=dynamic(()=>import('./TripMapPickerInner'),{ssr:false,loading:()=> <p className="cs-note">Opening the map…</p>});
export default function TripMapPicker({value,onChange}:{value?:WebsiteMapLocation;onChange:(point:WebsiteMapLocation)=>void}){return <div className="cs-map-picker"><p>Trip location on the globe <small>Choose once for this trip</small></p><Map value={value} onChange={onChange}/><p className="cs-note">{value?`Selected: ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`:'Zoom and tap the map, or pan with arrow keys and press Enter.'} This pin becomes public only when you publish.</p></div>;}
