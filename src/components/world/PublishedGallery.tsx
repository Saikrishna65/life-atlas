"use client";
import {useMemo,useState} from 'react';
import Image from 'next/image';
import {Modal,SearchField} from './primitives';
import {usePublicCatalog} from './usePublicCatalog';
import {type ScrapbookFrame} from '@/lib/public-trips/scrapbook';
import './published-media.css';
export default function PublishedGallery({frames=[],includeCatalog=true}:{frames?:ScrapbookFrame[];includeCatalog?:boolean}){
 const {catalog}=usePublicCatalog();const [query,setQuery]=useState(''),[trip,setTrip]=useState('All trips'),[selected,setSelected]=useState<string|null>(null);
 const all=useMemo(()=>[...new Map([...frames.filter(f=>!f.sample),...(includeCatalog?catalog?.items||[]:[]).filter(item=>/^(image|video)\//.test(item.mimeType)).map(item=>({id:`catalog-${item.id}`,tripId:item.collection||'published',tripTitle:item.collection||'Published collection',src:item.url,preview:item.thumbnailUrl||(item.mimeType.startsWith('image/')?item.url:''),title:item.title,kind:item.mimeType.startsWith('video/')?'film' as const:'photo' as const,sample:false}))].map(f=>[f.src,f])).values()],[frames,catalog,includeCatalog]);
 const items=all.filter(f=>(trip==='All trips'||f.tripId===trip)&&`${f.title} ${f.tripTitle}`.toLowerCase().includes(query.toLowerCase()));
 const current=items.find(f=>f.id===selected);
 return <section className="published-media"><div className="world-toolbar"><SearchField value={query} onChange={setQuery} label="Search my photographs and films" placeholder="A trip or a moment"/><label>Trip<select value={trip} onChange={e=>setTrip(e.target.value)}><option>All trips</option>{[...new Map(all.map(f=>[f.tripId,f.tripTitle])).entries()].map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label></div>
 {!items.length&&<div className="world-empty"><p>{all.length?'No matching moments.':'No photographs or films published yet.'}</p><p>Only media I choose to publish appears here.</p></div>}
 <div className="published-media-grid">{items.map(f=><button key={f.id} onClick={()=>setSelected(f.id)} aria-label={`Open ${f.kind==='film'?'film':'photograph'} from ${f.tripTitle}`}>{f.kind==='film'?<video src={f.src} poster={f.preview&&f.preview!==f.src?f.preview:undefined} muted playsInline preload="metadata" style={{width:'100%'}}/>:<Image src={f.preview||f.src} alt={f.title} width={800} height={650} unoptimized loading="lazy" style={{width:'100%',height:'auto'}}/>}</button>)}</div>
 {current&&<Modal title={current.tripTitle||'A moment from my journal'} onClose={()=>setSelected(null)}>{current.kind==='film'?<video src={current.src} controls autoPlay playsInline style={{maxWidth:'100%',maxHeight:'75vh'}}/>:<Image src={current.src} alt={current.title} width={1600} height={1200} unoptimized style={{maxWidth:'100%',height:'auto',maxHeight:'75vh',objectFit:'contain'}}/>}</Modal>}</section>;
}
