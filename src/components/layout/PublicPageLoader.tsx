"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useLenis} from 'lenis/react';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import HeroLogo from '@/components/home/HeroLogo';
import {isPublicPath,isPageNavigation,pendingPublicTasks,setPublicLoading} from '@/lib/public-loading/readiness';
import {trackPageAssets,isActivePageNode} from '@/lib/public-loading/assets';
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
  const [navigating,setNavigating]=useState(false);
  const release=useRef<(partial?:boolean)=>void>(()=>{});
  useLayoutEffect(()=>{
    if(phase!=='loading'&&!navigating)return;
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
  },[lenis,phase,navigating]);
  useEffect(()=>{
    if(phase!=='loading'||navigating)return;
    let disposed=false,frame=0,settle=0,failures=0;
    const main=document.querySelector('main');if(!main)return;
    const schedule=()=>{if(disposed)return;clearTimeout(settle);cancelAnimationFrame(frame);frame=requestAnimationFrame(scan);};
    const assets=trackPageAssets(main,schedule);
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
      const markers=Array.from(main!.querySelectorAll<HTMLElement>('[data-public-ready]')).filter(el=>isActivePageNode(el,main!));
      failures=media.failed+markers.filter(el=>el.dataset.publicReady==="error").length;
      const pending=media.pending+markers.filter(el=>el.dataset.publicReady==='pending').length+pendingPublicTasks(path).length+(document.fonts.status==='loaded'?0:1)+(document.readyState==='complete'?0:1);
      const hydrated=Array.from(main!.querySelectorAll<HTMLElement>('[data-public-page]')).some(el=>isActivePageNode(el,main!)&&el.dataset.publicPage===path&&el.dataset.publicReady==='ready');
      setRemaining(count=>count===pending?count:pending);
      if(hydrated&&pending===0)settle=window.setTimeout(()=>finish(),350);
    }
    const observer=new MutationObserver(schedule);
    observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','poster','data-public-ready']});
    main.addEventListener('load',schedule,true);main.addEventListener('error',schedule,true);
    document.fonts.addEventListener('loading',schedule);document.fonts.addEventListener('loadingdone',schedule);document.fonts.addEventListener('loadingerror',schedule);
    window.addEventListener('atlas-public-work',schedule);window.addEventListener('resize',schedule);window.addEventListener('load',schedule);
    const stalled=setTimeout(()=>{if(!disposed)setWaiting(true);},18000);
    window.dispatchEvent(new Event('atlas-public-preload'));void document.fonts.ready.then(schedule);schedule();
    return ()=>{
      disposed=true;observer.disconnect();assets.dispose();cancelAnimationFrame(frame);clearTimeout(settle);clearTimeout(stalled);
      main.removeEventListener('load',schedule,true);main.removeEventListener('error',schedule,true);
      document.fonts.removeEventListener('loading',schedule);document.fonts.removeEventListener('loadingdone',schedule);document.fonts.removeEventListener('loadingerror',schedule);
      window.removeEventListener('atlas-public-work',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('load',schedule);
    };
  },[path,lenis,phase,navigating]);
  useEffect(()=>{
    if(phase!=='leaving')return;
    const timer=setTimeout(()=>setPhase('ready'),matchMedia('(prefers-reduced-motion:reduce)').matches?0:240);
    return ()=>clearTimeout(timer);
  },[phase]);
  useEffect(()=>{
    if(!navigating)return;
    const timer=setTimeout(()=>setWaiting(true),18000);return ()=>clearTimeout(timer);
  },[navigating]);
  useEffect(()=>{
    const start=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=(event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
      if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download')||!isPageNavigation(anchor.href,location.href))return;
      // Native dialogs occupy the top layer, above any CSS loading overlay.
      const dialog=anchor.closest<HTMLDialogElement>('dialog[open]');
      if(dialog)queueMicrotask(()=>{if(dialog.open){const cancel=new Event('cancel',{cancelable:true,bubbles:true});if(dialog.dispatchEvent(cancel))dialog.close();}});
      setNavigating(true);setPhase('loading');setWaiting(false);setPublicLoading(true);
    };
    document.addEventListener('click',start,true);
    return ()=>document.removeEventListener('click',start,true);
  },[]);
  if(phase==='ready'&&!navigating)return null;
  return <div className="public-page-loader" data-lenis-prevent data-state={phase} role="status" aria-live="polite" aria-label="Preparing Life Atlas">
    <div className="public-loader-mark"><HeroLogo/></div>
    <p>{navigating?'Opening the next chapter.':'Gathering the world.'}</p>
    <div className="public-loader-track" aria-hidden="true"><span/></div>
    <small aria-hidden="true">{remaining?`${remaining} ${remaining===1?"detail":"details"} coming into focus`:'Finishing the details'}</small>
    {waiting&&<div className="public-loader-recovery"><p>This is taking longer than usual. The page will open when its media is ready.</p><button onClick={()=>location.reload()}>Try again</button><button onClick={()=>{if(navigating){setNavigating(false);setPhase('ready');setPublicLoading(false);}else release.current(true);}}>Open available content</button></div>}
  </div>;
}
