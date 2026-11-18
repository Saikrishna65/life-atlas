"use client";
import Image from "next/image";
import {useMemo,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,ArrowLeft,ArrowRight} from "lucide-react";
import type {TripArchiveEntry} from "@/lib/public-trips/archive";
import type {PublicPlace} from "@/lib/queries/public-content";
import {SearchField} from "./primitives";
export default function AtlasDirectory({initial="Journeys",initialQuery="",trips=[],places=[]}:{initial?:string;initialQuery?:string;trips?:TripArchiveEntry[];places?:PublicPlace[]}){
 const [tab,setTab]=useState(initial),[query,setQuery]=useState(initialQuery),[sort,setSort]=useState('Latest first'),[page,setPage]=useState(0);
 const records=useMemo(()=>{
  const entries=tab==='Places'?places.map(p=>({id:p.id,title:p.name,description:p.description,route:[p.region,p.country].filter(Boolean).join(' / '),href:`/places/${p.slug}`,image:p.image,date:''})):trips.map(t=>({id:t.id,title:t.title,description:t.duration,route:t.places.join(' / '),href:`/trips/${t.slug}`,image:t.image,date:t.date||''}));
  const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(e=>words.every(w=>`${e.title} ${e.route} ${e.description}`.toLowerCase().includes(w))).sort((a,b)=>sort==='A–Z'?a.title.localeCompare(b.title):b.date.localeCompare(a.date));
 },[tab,query,sort,trips,places]);
 return <div className="atlas-directory"><div className="directory-toolbar"><div className="world-filter-pills">{['Journeys','Places'].map(t=><button key={t} aria-pressed={t===tab} onClick={()=>{setTab(t);setPage(0);}}>{t}</button>)}</div><SearchField value={query} onChange={v=>{setQuery(v);setPage(0);}} label="Search published journeys and places" placeholder="A trip or a place"/><label>Sort<select value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option>Latest first</option><option>A–Z</option></select></label></div>
 <div className="atlas-directory-list">{records.slice(page*8,page*8+8).map((r,i)=><Link href={r.href} className="atlas-directory-entry" key={r.id}><span>{String(page*8+i+1).padStart(2,'0')}</span><div className="directory-entry-image">{r.image&&<Image src={r.image} alt={r.title} width={900} height={600} sizes="(max-width:700px) 90vw,50vw" loading="lazy" unoptimized/>}</div><div className="directory-entry-text"><span className="world-eyebrow">{r.route}</span><h2>{r.title}</h2><p>{r.description}</p></div><ArrowUpRight size={22}/></Link>)}</div>
 {!records.length&&<div className="world-empty"><p>{query?'No matching published records. Try another trip or place.':'My journeys and places will appear here when I publish them.'}</p></div>}
 {records.length>8&&<div className="world-pagination"><button disabled={!page} onClick={()=>setPage(p=>p-1)} aria-label="Previous page"><ArrowLeft/></button><span>{page+1} / {Math.ceil(records.length/8)}</span><button disabled={(page+1)*8>=records.length} onClick={()=>setPage(p=>p+1)} aria-label="Next page"><ArrowRight/></button></div>}</div>;
}
