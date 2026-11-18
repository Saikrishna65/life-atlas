"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Plus,Minus,RotateCw,ExternalLink} from 'lucide-react';
import {Modal} from '@/components/world/primitives';
import type {DetailMedia} from '@/lib/public-trips/detail';
import JournalVideo from './JournalVideo';
import './journal-viewer.css';
export default function TripMediaViewer({items,selected,onSelect,onClose,sample=false}:{items:DetailMedia[];selected:string;onSelect:(id:string)=>void;onClose:()=>void;sample?:boolean}){
 const index=items.findIndex(item=>item.id===selected),item=items[index];
 const [zoomedId,setZoomedId]=useState(''),[failedImage,setFailedImage]=useState(''),[loadedImage,setLoadedImage]=useState(''),[reload,setReload]=useState(0);
 const zoomed=zoomedId===selected,imageFailed=failedImage===selected,imageLoading=loadedImage!==selected&&!imageFailed;
 const gesture=useRef<{x:number;y:number;at:number;id:number}|null>(null);
 const move=(delta:number)=>{if(items.length<2)return;setZoomedId('');onSelect(items[(index+delta+items.length)%items.length].id);};
 useEffect(()=>{gesture.current=null;},[selected]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(items.length<2)return;if((e.target as HTMLElement)?.closest('input,select,textarea,[data-media-controls]'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();setZoomedId('');onSelect(items[(index+(e.key==='ArrowRight'?1:-1)+items.length)%items.length].id);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[index,items,onSelect]);
 if(!item)return null;
 return <Modal title={item.place==='Unassigned'?'Trip journal':item.place} onClose={onClose} className="td-viewer journal-viewer">
  <div className={`journal-viewer-stage td-viewer-media ${zoomed?'is-zoomed':''}`} onPointerDown={e=>{if(e.pointerType!=='touch')return;if(!e.isPrimary||zoomed||(e.target as HTMLElement).closest('[data-media-controls]')){gesture.current=null;return;}gesture.current={x:e.clientX,y:e.clientY,at:Date.now(),id:e.pointerId};}} onPointerCancel={()=>{gesture.current=null;}} onPointerUp={e=>{const start=gesture.current;gesture.current=null;if(!start||start.id!==e.pointerId||zoomed)return;const x=e.clientX-start.x,y=e.clientY-start.y;if(Math.abs(x)>=50&&Math.abs(x)>Math.abs(y)*1.3&&Date.now()-start.at<1000)move(x<0?1:-1);}}>
   {item.kind==='video'?<JournalVideo key={item.id} src={item.url} poster={item.poster} label={`Film from ${item.place}`}/>:<>
    {/* Full source, never the small native thumbnail. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={`${item.id}-${reload}`} src={item.url} alt={item.caption||`Trip photograph from ${item.place}`} draggable={false} decoding="async" onLoad={()=>setLoadedImage(item.id)} onError={()=>setFailedImage(item.id)}/>
    {imageLoading&&<span className="journal-image-loading" role="status">Opening photograph…</span>}
    {imageFailed&&<div className="journal-image-error" role="status"><p>This photograph could not load.</p><button onClick={()=>{setFailedImage('');setLoadedImage('');setReload(n=>n+1);}}><RotateCw size={16}/> Retry photo</button><a href={item.url} target="_blank" rel="noreferrer">Open original <ExternalLink size={14}/></a></div>}
   </>}
  </div>
  <div className="journal-viewer-footer td-viewer-details"><div className="journal-viewer-caption"><span>{item.category}</span>{item.place!=='Unassigned'&&<h3>{item.place}</h3>}{item.caption&&<p>{item.caption}</p>}{sample&&<p>Illustrative sample media.</p>}</div>
   <div className="journal-viewer-navigation td-viewer-tools">{item.kind==='photo'&&<button onClick={()=>setZoomedId(zoomed?'':selected)} aria-label={zoomed?'Zoom out':'Zoom in'} aria-pressed={zoomed}>{zoomed?<Minus size={18}/>:<Plus size={18}/>}</button>}
    <button onClick={()=>move(-1)} aria-label="Previous journal moment" disabled={items.length<2}><ArrowLeft size={19}/></button><span aria-live="polite">{index+1} / {items.length}</span><button onClick={()=>move(1)} aria-label="Next journal moment" disabled={items.length<2}><ArrowRight size={19}/></button>
   </div>
  </div>
  {item.kind==='photo'&&items.length>1&&!zoomed&&<p className="journal-swipe-hint">Swipe left or right to explore</p>}
 </Modal>;
}
