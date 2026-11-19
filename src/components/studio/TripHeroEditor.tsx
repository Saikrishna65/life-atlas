"use client";
import {useEffect,useMemo,useState,type KeyboardEvent} from 'react';
import Image from 'next/image';
import {Check,Film,ImageIcon,RefreshCw,ExternalLink,Monitor,Smartphone,Sparkles} from 'lucide-react';
import type {TripRecord} from '@/lib/vault/types';
import type {TripCover} from '@/lib/public-trips/cover';
import {patchTripFields} from '@/lib/vault/storage';
import {notifyVaultChange} from '@/lib/vault/useTripVault';
import {publishTripCover,readTripCoverLibrary} from '@/lib/studio/trip-cover';
import JournalVideo from '@/components/media/JournalVideo';
import '@/components/media/journal-viewer.css';

export default function TripHeroEditor({trip}:{trip:TripRecord}){
 const [remote,setRemote]=useState<{hero:TripCover|null;media:TripCover[]}>({hero:null,media:[]}),[revision,setRevision]=useState(0),[loading,setLoading]=useState(!!trip.publishedSlug),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[format,setFormat]=useState<'wide'|'portrait'>('wide'),[filter,setFilter]=useState('All places'),[publicUrl,setPublicUrl]=useState('');
 useEffect(()=>{if(!trip.publishedSlug)return;let active=true;void readTripCoverLibrary(trip.publishedSlug).then(result=>{if(active){setRemote(result);setError('');}}).catch(()=>{if(active)setError('Could not refresh the website media. Your local cover choices remain saved.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[trip.publishedSlug,trip.publishedAt,revision]);
 const candidates=useMemo<TripCover[]>(()=>{
  const local=(trip.websitePlaces||[]).flatMap(group=>group.publishedMedia.map(item=>({id:item.id,url:item.url,kind:item.mimeType.startsWith('video/')?'video' as const:'photo' as const,poster:item.thumbnailUrl,place:group.name})));
  return [...new Map([...local,...remote.media].map(item=>[item.url,item])).values()];
 },[trip.websitePlaces,remote.media]);
 const selectedId=trip.websiteHeroMediaId===undefined?remote.hero?.id||null:trip.websiteHeroMediaId;
 const explicit=candidates.find(item=>item.id===selectedId),preview=explicit||candidates.find(item=>item.kind==='video')||candidates[0];
 const places=[...new Set(candidates.map(item=>item.place||'Trip gallery'))];
 const visible=candidates.filter(item=>filter==='All places'||(item.place||'Trip gallery')===filter);
 const alreadyPublic=selectedId===null||remote.media.some(item=>item.id===selectedId);
 function navigateChoices(event:KeyboardEvent<HTMLDivElement>){
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  const choices=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role=radio]:not(:disabled)'));
  const current=choices.indexOf(document.activeElement as HTMLButtonElement);if(!choices.length||current<0)return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?choices.length-1:(current+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+choices.length)%choices.length;
  choices[next].focus();choices[next].click();
 }
 async function choose(id:string|null){if(busy)return;setBusy(true);setError('');setStatus('');try{await patchTripFields(trip.id,{websiteHeroMediaId:id});notifyVaultChange();setStatus('Cover choice saved on this device.');}catch{setError('Could not save the cover choice. Your trip and uploaded files are unchanged.');}finally{setBusy(false);}}
 async function publish(){setBusy(true);setError('');setStatus('');try{const result=await publishTripCover(trip.id,selectedId);setPublicUrl(result.publicUrl);setLoading(true);setRevision(value=>value+1);setStatus('Cover updated on the website. Photos, videos and route details are unchanged.');}catch(e){setError(e instanceof Error?e.message:'Could not update this cover. Your saved choice remains here.');}finally{setBusy(false);}}
 return <section className="cs-cover-editor" id="studio-cover" aria-label="Trip website cover">
  <div className="cs-cover-heading"><div><span className="cs-eyebrow">03 / THE OPENING FRAME</span><h3>Make an entrance.</h3><p>One photo. One film. The first thing I want someone to feel.</p></div><span className="cs-cover-badge"><Sparkles size={14}/>{explicit?explicit.kind==='video'?'Video cover':'Photo cover':'Automatic cover'}</span></div>
  <div className="cs-cover-layout"><div className="cs-cover-preview-column"><div className="cs-preview-format" aria-label="Cover preview framing"><button aria-pressed={format==='wide'} onClick={()=>setFormat('wide')}><Monitor size={15}/> Desktop</button><button aria-pressed={format==='portrait'} onClick={()=>setFormat('portrait')}><Smartphone size={15}/> Mobile</button></div>
   <div className="cs-cover-preview" data-format={format} key={preview?.id||'empty'}>{preview?.kind==='video'?<JournalVideo src={preview.url} poster={preview.poster} label="Selected trip cover video"/>:preview?<Image src={preview.url} alt="Selected trip cover photo" fill sizes="(max-width:700px) 90vw, 42vw" unoptimized/>:<div className="cs-cover-empty-art"><ImageIcon size={38} strokeWidth={.8}/><span>Your opening frame<br/>belongs here.</span></div>}
    <div className={`cs-cover-preview-title ${preview?.kind==='video'?'is-film':''}`}><span>{trip.destination||'A CHAPTER FROM MY ATLAS'}</span><strong>{trip.title}</strong></div>
   </div><p className="cs-note">A framing preview. Original media files are never changed.</p>
  </div><div className="cs-cover-choices"><div className="cs-cover-choice-top"><span>{candidates.length} uploaded moments</span>{trip.publishedSlug&&<button className="cs-link" disabled={loading||busy} onClick={()=>{setLoading(true);setRevision(value=>value+1);}}><RefreshCw size={14}/>{loading?'Refreshing…':'Refresh media'}</button>}</div>
   {places.length>1&&<label className="cs-cover-filter">Place<select aria-label="Filter cover choices by place" value={filter} onChange={e=>setFilter(e.target.value)}><option>All places</option>{places.map(place=><option key={place}>{place}</option>)}</select></label>}
   <div className="cs-cover-grid" role="radiogroup" aria-label="Choose trip cover" onKeyDown={navigateChoices}><button className="cs-cover-option cs-cover-automatic" role="radio" aria-checked={selectedId===null} disabled={busy} onClick={()=>void choose(null)}><Sparkles size={22}/><strong>Automatic</strong><small>First available film or photo</small>{selectedId===null&&<Check className="cs-cover-check" size={17}/>}</button>
    {visible.map((item,index)=><button key={item.id} role="radio" className="cs-cover-option" aria-checked={selectedId===item.id} aria-label={`Use ${item.kind==='video'?'video':'photo'} ${index+1} from ${item.place||'trip gallery'} as trip cover`} disabled={busy} onClick={()=>void choose(item.id)}>{item.kind==='photo'||item.poster?<Image src={item.poster||item.url} alt="" fill sizes="160px" unoptimized loading="lazy"/>:<Film size={30}/>}<span className="cs-cover-kind">{item.kind==='video'?<Film size={13}/>:<ImageIcon size={13}/>} {item.kind==='video'?'Film':'Photo'}</span><span className="cs-cover-place">{item.place||'Trip gallery'}</span>{selectedId===item.id&&<Check className="cs-cover-check" size={17}/>}</button>)}
   </div>
   {!candidates.length&&<p className="cs-note">Upload and publish this trip’s photos or videos first. They will appear here as cover choices.</p>}
   <div className="cs-cover-actions">{trip.publishedSlug?<button className="cs-primary" disabled={busy||loading||!alreadyPublic} onClick={()=>void publish()}>{busy?'Saving…':'Update website cover'}</button>:<p className="cs-note">Your saved cover choice will be applied when you publish this trip.</p>}{trip.publishedSlug&&!alreadyPublic&&<p className="cs-note">Publish this trip’s new media first to use this selection as its website cover.</p>}{publicUrl&&<a href={publicUrl} target="_blank" rel="noreferrer" className="cs-link">View trip <ExternalLink size={15}/></a>}</div>
  </div></div>{status&&<p role="status" className="cs-status">{status}</p>}{error&&<p role="alert" className="cs-error">{error}</p>}
 </section>;
}
