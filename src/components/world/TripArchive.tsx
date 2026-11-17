"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ArrowLeft, ArrowRight, Search, Plus } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import type { TripArchiveEntry } from "@/lib/public-trips/archive";
import { Empty, Modal, SearchField } from "./primitives";
import "./trip-archive.css";

export default function TripArchive({ trips,curated=false }: { trips: TripArchiveEntry[];curated?:boolean }) {
  const root = useRef<HTMLElement>(null);
  const navigate = useRef<((index: number) => void) | null>(null);
  const activeRef = useRef(0);
  const lenis = useLenis();
  const [active, setActive] = useState(0);
  const [finder, setFinder] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("All places");
  const [sort, setSort] = useState(!curated&&trips.some(trip => trip.date) ? "Latest first" : "Original order");
  const [limit, setLimit] = useState(9);
  const countries = [...new Set(trips.map(trip => trip.country))].sort();
  const items = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return trips.filter(trip => (country === "All places" || trip.country === country) && words.every(word => `${trip.title} ${trip.places.join(" ")} ${trip.country}`.toLocaleLowerCase().includes(word))).sort((a,b) => {
      if(sort === 'A–Z') return a.title.localeCompare(b.title);
      if(sort === 'Shortest first') return (a.days ?? Infinity) - (b.days ?? Infinity);
      return sort === 'Latest first' ? (b.date || '').localeCompare(a.date || '') : 0;
    });
  }, [trips,query,country,sort]);
  const entries = items.slice(0,limit);
  const signature = entries.map(trip => trip.id).join('|');
  const current = entries[Math.min(active, entries.length-1)];
  const reset = () => { setQuery(''); setCountry('All places'); setSort(!curated&&trips.some(trip=>trip.date)?'Latest first':'Original order'); setLimit(9); };
  useEffect(() => {
    if(!root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const section = root.current;
    const media = gsap.matchMedia();
    media.add({ motion:'(prefers-reduced-motion:no-preference)', still:'(prefers-reduced-motion:reduce)' }, context => {
      const moving = !!context.conditions?.motion;
      const panels = Array.from(section.querySelectorAll<HTMLElement>('.archive-reel-panel'));
      const count = panels.length;
      if(!count) { navigate.current = null; return; }
      let height = panels[0].offsetHeight;
      const draw = (phase: number) => {
        const next = Math.min(count-1,Math.max(0,Math.round(phase)));
        panels.forEach((panel,index) => {
          const d = index-phase, distance = Math.abs(d);
          const angle = moving ? -Math.sign(d)*(84*(1-Math.exp(-distance*1.65))) : 0;
          const y = moving ? Math.sign(d)*(height*.59*Math.min(distance,1)+Math.max(0,distance-1)*height*.19) : 0;
          panel.style.transform = `translate(-50%,-50%) translate3d(0,${y}px,${moving?-distance*85:0}px) rotateX(${angle}deg)`;
          panel.style.opacity = moving ? String(Math.max(0,1-Math.max(0,distance-2.5)*.65)) : index===next?'1':'0';
          panel.style.visibility = (moving?distance<4:index===next)?'visible':'hidden';
          panel.style.zIndex = String(100-Math.round(distance*10));
        });
        if(next !== activeRef.current) { activeRef.current=next; setActive(next); }
      };
      const driver = {phase:0};
      const timeline = moving ? gsap.to(driver,{phase:count-1,ease:'none',onUpdate:()=>draw(driver.phase),scrollTrigger:{trigger:section.querySelector('.archive-scroll'),start:'top top',end:'bottom bottom',scrub:.55,invalidateOnRefresh:true}}) : null;
      draw(moving?driver.phase:Math.min(activeRef.current,count-1));
      navigate.current = index => {
        const next = Math.min(count-1,Math.max(0,index));
        const trigger = timeline?.scrollTrigger;
        if(trigger && count>1) {
          const top = trigger.start + (trigger.end-trigger.start)*next/(count-1);
          if(lenis) lenis.scrollTo(top,{duration:1.05}); else window.scrollTo({top,behavior:'smooth'});
        } else draw(next);
      };
      const resize = new ResizeObserver(()=>{height=panels[0].offsetHeight;draw(moving?driver.phase:activeRef.current);});
      resize.observe(panels[0]);
      return () => { resize.disconnect(); timeline?.scrollTrigger?.kill(); timeline?.kill(); navigate.current=null; panels.forEach(panel=>{panel.removeAttribute('style');}); };
    });
    return () => media.revert();
  }, [signature,lenis]);

  return <section id="memories" className="trip-archive trip-archive-reel" ref={root} aria-labelledby="trip-archive-title">
    <div className="archive-scroll" style={{height:`${entries.length>1?100+Math.min(entries.length,10)*45:100}svh`}}>
      <div className="archive-stage" onKeyDown={event=>{if(event.target instanceof HTMLElement && event.target.closest('input,select')) return; if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(event.key)) {event.preventDefault();navigate.current?.(activeRef.current+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1));}}}>
        <div className="archive-masthead"><h2 id="trip-archive-title">My roads.<br /><em>My stories.</em></h2><button className="archive-find" onClick={()=>setFinder(true)}><Search size={14}/> Find a journey</button></div>
        {current ? <>
          <div className="archive-current" key={current.id}><span className="archive-kicker">{current.sample?'SAMPLE JOURNEY':current.date?new Intl.DateTimeFormat('en',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(current.date)):'FROM MY TRAVEL JOURNAL'}</span><h3>{current.title}</h3><p>{current.places.join(' / ')}</p></div>
          <div className="archive-reel-window" aria-label="Trip covers in perspective">{entries.map((trip,index)=><Link className="archive-reel-panel trip-archive-entry" data-trip-id={trip.id} key={trip.id} href={`/trips/${trip.slug}`} aria-label={`Explore trip: ${trip.title}`} aria-hidden={index!==active} inert={index!==active} tabIndex={index===active?0:-1}>{Math.abs(index-active)<4 && (trip.image?<Image src={trip.image} alt={trip.sample?'Illustrative trip cover':trip.title} fill sizes="(max-width:800px) 88vw, 45vw" loading="lazy" unoptimized={!trip.sample}/>:<div className="archive-no-cover">{trip.country}</div>)}</Link>)}</div>
          <aside className="archive-caption"><span>{current.country}</span><p>{current.duration}</p><Link href={`/trips/${current.slug}`} aria-label={`Read journal: ${current.title}`}>Open the journey <ArrowUpRight size={20}/></Link></aside>
          <div className="archive-reel-bottom"><div className="archive-reel-controls"><button aria-label="Previous archive journey" onClick={()=>navigate.current?.(activeRef.current-1)} disabled={active===0}><ArrowLeft size={18}/></button><span aria-live="polite">{String(active+1).padStart(2,'0')} / {String(entries.length).padStart(2,'0')}</span><button aria-label="Next archive journey" onClick={()=>navigate.current?.(activeRef.current+1)} disabled={active>=entries.length-1}><ArrowRight size={18}/></button></div><span className="archive-scroll-hint">SCROLL TO TURN THE PAGE</span>{limit<items.length?<button className="archive-more" onClick={()=>setLimit(value=>value+9)}>More journeys <Plus size={14}/></button>:<span className="archive-end-label">A LIFE IN CHAPTERS</span>}</div>
        </>:<div className="archive-main-empty"><Empty onReset={reset}>No journeys match. Try a different place.</Empty></div>}
      </div>
    </div>
    {finder && <Modal title="Find a journey" className="archive-finder" onClose={()=>setFinder(false)}><SearchField value={query} onChange={value=>{setQuery(value);setLimit(9);}} label="Search trips" placeholder="A trip, a place, a country…"/><div className="archive-finder-filters"><label>Destination<select aria-label="Filter trips by destination" value={country} onChange={event=>{setCountry(event.target.value);setLimit(9);}}><option>All places</option>{countries.map(place=><option key={place}>{place}</option>)}</select></label><label>Sort journeys<select aria-label="Sort trips" value={sort} onChange={event=>{setSort(event.target.value);setLimit(9);}}>{['Original order','Shortest first','A–Z',...(trips.some(trip=>trip.date)?['Latest first']:[])].map(value=><option key={value}>{value}</option>)}</select></label></div><div className="archive-finder-results">{items.slice(0,limit).map(trip=><Link key={trip.id} href={`/trips/${trip.slug}`}><span><strong>{trip.title}</strong><small>{trip.places.join(' / ')} · {trip.duration}</small></span><ArrowUpRight size={18}/></Link>)}</div>{!items.length&&<Empty onReset={reset}>No journeys match yet. Try another place or clear the filters.</Empty>}<div className="archive-finder-footer"><span aria-live="polite">{Math.min(limit,items.length)} of {items.length} journeys</span>{limit<items.length&&<button onClick={()=>setLimit(value=>value+9)}>Unfold more journeys <Plus size={14}/></button>}</div></Modal>}
  </section>;
}
