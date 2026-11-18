"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useLenis} from 'lenis/react';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import HeroLogo from '@/components/home/HeroLogo';
import {isPublicPath,setPublicLoading} from '@/lib/public-loading/readiness';
import {trackPageAssets,isActivePageNode,isInitialViewportAsset} from '@/lib/public-loading/assets';
import './public-page-loader.css';

export default function PublicPageLoader(){
  const pathname=usePathname();
  return isPublicPath(pathname)?<RouteReadiness key={pathname} path={pathname!}/>:null;
}
function RouteReadiness({path}:{path:string}){
  const lenis=useLenis();
  const [phase,setPhase]=useState<'loading'|'leaving'|'ready'>('loading');
  const [waiting,setWaiting]=useState(false);
  const [remaining,setRemaining]=useState(0);
  const release=useRef<(partial?:boolean)=>void>(()=>{});
  useLayoutEffect(()=>{
    if(phase!=='loading')return;
    const inert=new Map<HTMLElement,boolean>();
    setPublicLoading(true);
    const lock=()=>{
      lenis?.stop();
      document.querySelectorAll<HTMLElement>('main').forEach(el=>{
        if(!inert.has(el)){inert.set(el,el.inert);el.inert=true;el.setAttribute('aria-busy','true');}
      });
    };
    lock();
    const observer=new MutationObserver(lock);observer.observe(document.body,{childList:true,subtree:true});
    return ()=>{observer.disconnect();inert.forEach((old,el)=>{el.inert=old;el.removeAttribute('aria-busy');});setPublicLoading(false);if(!document.querySelector('dialog[open]'))lenis?.start();};
  },[lenis,phase]);
  useEffect(()=>{
    if(phase!=='loading')return;
    let disposed=false,frame=0,settle=0,failures=0,deadlineReached=false;
    const main=document.querySelector('main');if(!main)return;
    const schedule=()=>{if(disposed)return;clearTimeout(settle);cancelAnimationFrame(frame);frame=requestAnimationFrame(scan);};
    const assets=trackPageAssets(main,schedule,{initialViewportOnly:true});
    const finish=(partial=false)=>{
      if(disposed)return;disposed=true;
      performance.mark(`atlas:ready:${path}`,{detail:{partial,failedAssets:failures}});
      document.documentElement.dataset.publicReady=path;
      document.documentElement.dataset.publicReadyMode=partial?'partial':failures?'degraded':'complete';
      setPublicLoading(false);setPhase('leaving');
      requestAnimationFrame(()=>{lenis?.resize();ScrollTrigger.refresh();window.dispatchEvent(new Event('atlas-public-ready'));});
    };
    release.current=finish;
    function scan(){
      if(disposed)return;clearTimeout(settle);
      const media=assets.scan();
      const markers=Array.from(main!.querySelectorAll<HTMLElement>('[data-public-ready]')).filter(el=>isActivePageNode(el,main!)&&isInitialViewportAsset(el));
      failures=media.failed+markers.filter(el=>el.dataset.publicReady==="error").length;
      const pending=media.pending+markers.filter(el=>el.dataset.publicReady==='pending').length;
      const hydrated=Array.from(main!.querySelectorAll<HTMLElement>('[data-public-page]')).some(el=>isActivePageNode(el,main!)&&el.dataset.publicPage===path&&el.dataset.publicReady==='ready');
      setRemaining(count=>count===pending?count:pending);
      if(hydrated&&(pending===0||deadlineReached))settle=window.setTimeout(()=>finish(deadlineReached&&pending>0),120);
    }
    const observer=new MutationObserver(schedule);
    observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','poster','data-public-ready']});
    main.addEventListener('load',schedule,true);main.addEventListener('error',schedule,true);
    document.fonts.addEventListener('loading',schedule);document.fonts.addEventListener('loadingdone',schedule);document.fonts.addEventListener('loadingerror',schedule);
    window.addEventListener('atlas-public-work',schedule);window.addEventListener('resize',schedule);window.addEventListener('load',schedule);
    const deadline=setTimeout(()=>{deadlineReached=true;schedule();},4000);
    const stalled=setTimeout(()=>{if(!disposed)setWaiting(true);},8000);
    void document.fonts.ready.then(schedule);schedule();
    return ()=>{
      disposed=true;observer.disconnect();assets.dispose();cancelAnimationFrame(frame);clearTimeout(settle);clearTimeout(stalled);clearTimeout(deadline);
      main.removeEventListener('load',schedule,true);main.removeEventListener('error',schedule,true);
      document.fonts.removeEventListener('loading',schedule);document.fonts.removeEventListener('loadingdone',schedule);document.fonts.removeEventListener('loadingerror',schedule);
      window.removeEventListener('atlas-public-work',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('load',schedule);
    };
  },[path,lenis,phase]);
  useEffect(()=>{
    if(phase!=='leaving')return;
    const timer=setTimeout(()=>setPhase('ready'),matchMedia('(prefers-reduced-motion:reduce)').matches?0:240);
    return ()=>clearTimeout(timer);
  },[phase]);
  if(phase==='ready')return null;
  return <div className="public-page-loader" data-lenis-prevent data-state={phase} role="status" aria-live="polite" aria-label="Preparing Life Atlas">
    <div className="public-loader-mark"><HeroLogo/></div>
    <p>Opening my atlas.</p>
    <div className="public-loader-track" aria-hidden="true"><span/></div>
    <small aria-hidden="true">{remaining?`${remaining} ${remaining===1?"detail":"details"} coming into focus`:'Preparing this view'}</small>
    {waiting&&<div className="public-loader-recovery"><p>The connection is taking longer than usual. You can open the available content.</p><button onClick={()=>location.reload()}>Try again</button><button onClick={()=>release.current(true)}>Open available content</button></div>}
  </div>;
}
