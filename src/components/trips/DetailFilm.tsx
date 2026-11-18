"use client";
import {onPublicPreload,publicPreloading} from '@/lib/public-loading/readiness';
import {useEffect,useRef,useState} from 'react';
/** Only approaching films get a source; off-screen films release decoding and network buffers. */
export default function DetailFilm({src,poster,paused,label,posterPolicy='always',onMetadata}:{src:string;poster?:string;paused:boolean;label:string;posterPolicy?:'always'|'reduced-motion';onMetadata?:(video:HTMLVideoElement)=>void}){
 const ref=useRef<HTMLVideoElement>(null),pausedRef=useRef(paused),refresh=useRef<()=>void>(()=>{});const [blocked,setBlocked]=useState(false);
 useEffect(()=>{
  const video=ref.current!,motion=matchMedia('(prefers-reduced-motion: reduce)');let near=false,disposed=false;
  video.muted=true;video.defaultMuted=true;video.playsInline=true;
  const update=()=>{
   if(posterPolicy==='reduced-motion'){if(motion.matches&&poster)video.poster=poster;else video.removeAttribute('poster');}
   if(near&&!video.getAttribute('src')){video.src=src;video.preload='metadata';}
   if(near&&!pausedRef.current&&!document.hidden&&!motion.matches&&!publicPreloading()){
    void video.play().then(()=>{if(!disposed)setBlocked(false);}).catch(()=>{if(!disposed)setBlocked(true);});
   }else video.pause();
   if(!near&&video.getAttribute('src')){video.removeAttribute('src');video.load();}
  };
  refresh.current=update;
  const observer=new IntersectionObserver(([entry])=>{near=entry.isIntersecting;update();},{rootMargin:'180px',threshold:0});observer.observe(video);
  const release=onPublicPreload(update);window.addEventListener('atlas-public-loading',update);document.addEventListener('visibilitychange',update);motion.addEventListener('change',update);
  return()=>{disposed=true;refresh.current=()=>{};release();observer.disconnect();window.removeEventListener('atlas-public-loading',update);document.removeEventListener('visibilitychange',update);motion.removeEventListener('change',update);video.pause();video.removeAttribute('src');video.load();};
 },[src,poster,posterPolicy]);
 useEffect(()=>{pausedRef.current=paused;refresh.current();},[paused]);
 return <><video ref={ref} className="td-auto-film" data-poster-policy={posterPolicy} poster={posterPolicy==='always'?poster:undefined} onLoadedMetadata={e=>{const video=e.currentTarget;if(video.videoWidth&&video.videoHeight)video.style.aspectRatio=`${video.videoWidth} / ${video.videoHeight}`;onMetadata?.(video);}} onLoadedData={e=>{e.currentTarget.dataset.ready='true';setBlocked(false);}} onError={e=>{setBlocked(true);if(poster&&posterPolicy==='reduced-motion'){e.currentTarget.poster=poster;e.currentTarget.dataset.ready='true';}}} muted loop playsInline autoPlay preload="none" aria-label={label}/>{blocked&&posterPolicy==='always'&&<span className="td-film-open-hint" aria-hidden="true">Open film ↗</span>}</>;
}
