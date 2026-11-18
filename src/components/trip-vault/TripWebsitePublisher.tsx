"use client";
import {useEffect,useState,useRef} from 'react';
import {Globe,Plus,ExternalLink} from 'lucide-react';
import {TripSheet} from './shared';
import {getTrip,getMemoriesForTrip,getItinerariesForTrip} from '@/lib/vault/storage';
import type {TripRecord,TripMemoryRecord} from '@/lib/vault/types';
import {publishTripToWebsite} from '@/lib/vault/publishTrip';
import {rememberPlaceTransfer,rememberPlacePublication} from '@/lib/studio/trip-places';
import {websiteSlug} from '@/lib/vault/website-payload';
import {R2,nativeR2Available,systemAction,storageError,bytes} from '@/lib/r2/native';
import {PublicationPaused,waitForTripTransfer} from '@/lib/r2/trip-transfer';
import type {PublishedMedia,SelectedMedia,Transfer} from '@/lib/r2/types';

export default function TripWebsitePublisher({tripId,organized=false}:{tripId:string;organized?:boolean}) {
 const cancelled=useRef(false);
 useEffect(()=>()=>{cancelled.current=true;},[]);
 const [open,setOpen]=useState(false),[trip,setTrip]=useState<TripRecord|null>(null),[memories,setMemories]=useState<TripMemoryRecord[]>([]),[ids,setIds]=useState<string[]>([]),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[place,setPlace]=useState(''),[days,setDays]=useState(0),[includeDays,setIncludeDays]=useState(false),[includeRoute,setIncludeRoute]=useState(false),[consent,setConsent]=useState(false),[files,setFiles]=useState<SelectedMedia[]>([]),[cloud,setCloud]=useState<PublishedMedia[]>([]),[cloudIds,setCloudIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[problem,setProblem]=useState(''),[url,setUrl]=useState('');
 // Completed native transfers survive a retry; originals are never copied through the JS heap.
 const [notice,setNotice]=useState('');
 const [jobs,setJobs]=useState<Record<string,Transfer>>({});
 const [previews,setPreviews]=useState<Record<string,string>>({});
 useEffect(()=>{if(!open)return;let alive=true;void Promise.all([getTrip(tripId),getMemoriesForTrip(tripId),getItinerariesForTrip(tripId)]).then(([saved,moments,itinerary])=>{if(!alive)return;setTrip(saved);setTitle(saved?.title||'');setMemories(moments.filter(memory=>memory.imageDataUrl||memory.images?.length));setDays(itinerary.filter(day=>day.title?.trim()||day.description?.trim()||day.activities?.length).length);}).catch(()=>{if(alive)setProblem('Could not open this trip. Your saved data is unchanged.');});if(nativeR2Available())void R2.getPublicCatalog().then(result=>{if(alive)setCloud(result.catalog.items);}).catch(()=>{});return()=>{alive=false;};},[open,tripId]);
 async function choose(){setProblem('');try{const result=await systemAction(()=>R2.pickMedia({picker:'documents'}));setFiles(previous=>[...new Map([...previous,...result.files.filter(file=>/^(image|video)\//.test(file.mimeType))].map(file=>[file.id,file])).values()]);for(const file of result.files){void R2.getSelectionPreview({id:file.id}).then(result=>setPreviews(previous=>({...previous,[file.id]:result.thumbnail}))).catch(()=>{});}}catch(error){setProblem(storageError(error));}}
 async function waitForTransfer(job:Transfer,publicationSession?:string){
  return waitForTripTransfer(job.id,{
   transfers:async()=>(await R2.getTransferProgress()).transfers,
   resume:id=>R2.resumeTransfer({id,publicationSession}),
   paused:()=>cancelled.current,
   offline:()=>navigator.onLine===false,
   progress:(phase,current)=>{setJobs(previous=>({...previous,[job.id]:current}));setProgress(`${phase} ${current.name} · ${bytes(current.uploadedBytes)} / ${bytes(current.totalBytes)}`);},
  });
 }
 function checkPaused(){if(cancelled.current)throw new PublicationPaused();}
 async function publish(){
  if(!trip||!consent||busy)return;cancelled.current=false;setBusy(true);setProblem('');setNotice('');setUrl('');
  let publicationSession:string|undefined;
  try{
   const selected=cloud.filter(item=>cloudIds.includes(item.id));
   const latest=await getTrip(tripId);if(!latest)throw Error('This trip is no longer available.');
   const pending=(latest.websitePlaces||[]).flatMap(group=>group.files);
   if(pending.length||files.length){
    const transferIds=[...new Set([...(latest.websitePlaces||[]).flatMap(group=>group.files.map(file=>group.transferIds[file.id]).filter(Boolean)),...files.map(file=>jobs[file.id]?.id).filter((id):id is string=>!!id)])];
    setProgress('Verify once to publish this trip’s selected files…');
    publicationSession=(await systemAction(()=>R2.beginTripPublication({collection:websiteSlug(latest),selectionIds:[...new Set([...pending,...files].map(file=>file.id))],transferIds}))).publicationSession;
   }
   checkPaused();
   for(const group of latest.websitePlaces||[]){
    selected.push(...group.publishedMedia.map(item=>({...item,tags:[...item.tags.filter(tag=>!tag.startsWith('place:')&&!tag.startsWith('place-id:')),`place:${group.name}`,`place-id:${group.id}`]})));
    for(const file of group.files){
     checkPaused();
     let job:Transfer|undefined;
     const savedId=group.transferIds[file.id];
     if(savedId)job=(await R2.getTransferProgress()).transfers.find(item=>item.id===savedId);
     if(savedId&&!job)throw Error('A saved upload is unavailable. Check Cloud Storage before selecting this file again.');
     if(!job){job=await R2.uploadObject({slot:'public',selectionId:file.id,publicationSession});await rememberPlaceTransfer(tripId,group.id,file.id,job.id);}
     job=await waitForTransfer(job,publicationSession);checkPaused();setProgress(`Publishing ${group.name} · ${file.name}`);
     const result=await R2.publishTripMedia({publicationSession,transferId:job.id,title:title.trim(),description:'',tags:[`place:${group.name}`,`place-id:${group.id}`],category:'expedition',collection:websiteSlug(latest),acknowledgeMetadata:true});
     const item=result.item;if(!item)throw Error('The publication record did not confirm this media. Its original remains unchanged.');
     setTrip(await rememberPlacePublication(tripId,group.id,file.id,item));selected.push(item);
    }
   }

   for(const file of files){checkPaused();let job=jobs[file.id];if(!job){job=await R2.uploadObject({slot:'public',selectionId:file.id,publicationSession});setJobs(previous=>({...previous,[file.id]:job!}));}job=await waitForTransfer(job,publicationSession);checkPaused();setProgress(`Linking ${file.name} to this journey…`);const result=await R2.publishTripMedia({publicationSession,transferId:job.id,title:title.trim(),description:'',tags:place.trim()?[`place:${place.trim().slice(0,54)}`]:[],category:'expedition',collection:websiteSlug(trip),acknowledgeMetadata:true});const item=result.item;if(item)selected.push(item);else throw Error('The publication record did not confirm this file. Retry without deleting its original.');}
   checkPaused();
   setProgress('Updating your website journal…');const result=await publishTripToWebsite(tripId,{title,description,memoryIds:ids,includeItinerary:includeDays,includeRoute,publicMedia:[...new Map(selected.map(item=>[item.id,item])).values()],appendExistingMedia:organized||!!latest.websitePlaces?.length});setUrl(result.publicUrl);setProgress('Published. Your local originals and cloud backups are unchanged.');
  }catch(error){
   if(error instanceof PublicationPaused){setProgress('');setNotice('Publishing progress saved. A transfer already running may finish in Cloud Storage. Tap Resume publishing when ready; completed uploads will be reused.');}
   else setProblem(error&&typeof error==='object'&&'code' in error?storageError(error):error instanceof Error?error.message:storageError(error));
  }finally{
   if(publicationSession)await R2.endTripPublication({publicationSession}).catch(()=>{});
   const saved=await getTrip(tripId).catch(()=>null);if(saved)setTrip(saved);
   setBusy(false);
  }
 }
 const toggle=(value:string,list:string[],set:(ids:string[])=>void)=>set(list.includes(value)?list.filter(id=>id!==value):[...list,value]);
 return <section className="tv-publish-card"><div className="tv-publish-title"><Globe size={18}/><span>Your trip, on your website.</span></div><p className="tv-publish-desc">Choose photos or videos, review the public details, then publish. Plans and a recorded route are optional.</p><button className="tv-publish-btn" onClick={()=>{setConsent(false);setProblem('');setOpen(true);}}>Publish / update website</button>{open&&<TripSheet title="Publish this journey" onClose={()=>{if(!busy)setOpen(false);}}><div className="tv-form tv-website-publisher">
 <label>Website title<input disabled={busy} value={title} maxLength={140} required onChange={event=>setTitle(event.target.value)}/></label><label>A few words <small>optional · public</small><textarea disabled={busy} value={description} maxLength={2000} rows={3} onChange={event=>setDescription(event.target.value)} placeholder="Leave empty for a photo-only journal."/></label>
 {!!memories.length&&<fieldset><legend>Choose saved photos</legend><div className="tv-website-media">{memories.map(memory=><label key={memory.id}><input type="checkbox" disabled={busy} checked={ids.includes(memory.id)} onChange={()=>toggle(memory.id,ids,setIds)}/><img src={memory.images?.[0]||memory.imageDataUrl} alt={memory.title||'Trip photograph'} loading="lazy"/><span>{memory.images?.length||1} photos{memory.placeName?` · ${memory.placeName}`:''}</span></label>)}</div></fieldset>}
 {!organized&& (nativeR2Available()?<><button type="button" className="tv-secondary" disabled={busy} onClick={()=>void choose()}><Plus size={16}/> Add photos / videos</button><p className="tv-fine">Original files upload directly from Android to your public R2 bucket after you approve publishing. Configure it once in Control Room → Cloud Storage.</p></>:<p className="tv-fine">Open the Android app to upload original photos and videos directly to R2. Small selected local photos can also be published here.</p>)}
 {(organized||!!trip?.websitePlaces?.length)&&<div className="tv-fine"><strong>Media organized by place</strong>{trip?.websitePlaces?.map(group=><details key={group.id}><summary>{group.name} · {group.files.length} selected · {group.publishedMedia.length} uploaded & ready</summary><ul>{group.files.map(file=><li key={file.id}>{file.name}</li>)}</ul></details>)}<p>New files upload only after you approve publishing below. The trip’s map pin is included; recorded routes remain optional.</p></div>}
 {!!files.length&&<label>Place for these files <small>optional · enables the gallery place filter</small><input disabled={busy} value={place} maxLength={54} onChange={event=>setPlace(event.target.value)} /></label>}
 {!!files.length&&<ul>{files.map(file=><li key={file.id}>{previews[file.id]&&<img className="tv-website-file-preview" src={previews[file.id]} alt={`Selected media: ${file.name}`} />}{file.name} · {bytes(file.size)} <button type="button" disabled={busy} onClick={()=>setFiles(previous=>previous.filter(item=>item.id!==file.id))}>Remove</button></li>)}</ul>}
 {!!cloud.length&&<details><summary>Use already-public cloud media</summary>{cloud.map(item=><label className="tv-inline-checkbox" key={item.id}><input type="checkbox" disabled={busy} checked={cloudIds.includes(item.id)} onChange={()=>toggle(item.id,cloudIds,setCloudIds)}/>{item.title} · {item.mimeType.startsWith('video/')?'Video':'Photo'}</label>)}</details>}
 {!!days&&<label className="tv-inline-checkbox"><input type="checkbox" disabled={busy} checked={includeDays} onChange={event=>setIncludeDays(event.target.checked)}/> Include {days} itinerary days</label>}
 {!!trip?.liveExpedition?.legs.some(leg=>leg.coordinates.length)&&<><label className="tv-inline-checkbox"><input type="checkbox" disabled={busy} checked={includeRoute} onChange={event=>setIncludeRoute(event.target.checked)}/> Include recorded route & travel statistics</label><p className="tv-fine">Route locations become public. Older statistics may contain GPS errors; review them before sharing. Existing website route and distance stay unchanged when this is off.</p></>}
 <p className="tv-fine">Only this title, public description, selected media, place names, trip map pin, saved travel dates and chosen optional details are shared. Private notes, spending, tickets and contacts stay in your vault. Public originals can contain EXIF/location metadata; sanitize sensitive files before selecting them.</p>
 <label className="tv-inline-checkbox"><input type="checkbox" disabled={busy} checked={consent} onChange={event=>setConsent(event.target.checked)}/> I approve making these selected files and details public.</label>
 {busy&&<p className="tv-fine">Finish uploads later saves this queue. A file already uploading may continue in Cloud Storage.</p>}
 {busy&&<button type="button" className="tv-secondary" disabled={progress.startsWith('Updating your website')} onClick={()=>{cancelled.current=true;}}>Finish uploads later</button>}
 <button className="tv-primary" disabled={busy||!trip||!title.trim()||!consent} onClick={()=>void publish()}>{busy?'Publishing…':notice?'Resume publishing':'Publish to website'}</button>{progress&&<p role="status" className="tv-fine">{progress}</p>}{notice&&<p role="status" className="tv-notice">{notice}</p>}{problem&&<p role="alert" className="tv-error">{problem}</p>}{url&&<a href={url} target="_blank" rel="noreferrer" className="tv-secondary">View my trip <ExternalLink size={16}/></a>}
 </div></TripSheet>}</section>;
}
