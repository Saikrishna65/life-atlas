"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { depthPose, selectDepthPhotos } from '@/lib/public-trips/photo-depth';
import { catalogScrapbookFrames, type ScrapbookFrame } from '@/lib/public-trips/scrapbook';
import { usePublicCatalog } from './usePublicCatalog';
import { Modal } from './primitives';

export default function PhotoDepth({media=[]}:{media?:ScrapbookFrame[]}) {
  const root=useRef<HTMLElement>(null);
  const {catalog}=usePublicCatalog();
  const photos=useMemo(()=>selectDepthPhotos([...catalogScrapbookFrames(catalog?.items??[],media),...media]),[catalog,media]);
  const [selected,setSelected]=useState<number|null>(null);
  const current=selected===null?null:photos[selected];
  const held=useRef(false);
  const cards=useMemo(()=>Array.from({length:27},(_,index)=>({photo:photos[index===13?0:index===0&&photos.length>13?13:index<photos.length?index:(index*5+Math.floor(index/9)*2)%photos.length],index})),[photos]);
  useEffect(()=>{held.current=selected!==null;},[selected]);
  useEffect(()=>{
    if(!CSS.supports('transform-style','preserve-3d')) return;
    gsap.registerPlugin(ScrollTrigger);
    if(!CSS.supports('transform-style','preserve-3d')) return;
    const section=root.current!;
    const stage=section.querySelector<HTMLElement>('.photo-depth-stage')!;
    const frames=Array.from(section.querySelectorAll<HTMLButtonElement>('.photo-depth-frame'));
    const world=section.querySelector<HTMLElement>('.photo-depth-world')!;
    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion:no-preference)',()=>{
      let width=stage.clientWidth,height=stage.clientHeight;
      const state={position:0,pointerX:0,pointerY:0};
      const draw=()=>{
        const mobile=width<701,p=state.position;
        section.dataset.progress=p.toFixed(4);
        const sway=Math.sin(Math.PI*p)*Math.sin(Math.PI*Math.min(1,p/.18));
        const exit=Math.max(0,Math.min(1,(p-.78)/.22));
        world.style.transform=`rotateX(${(Math.sin(p*Math.PI*2)*22+state.pointerY)*sway*(mobile?.45:1)*(1-exit)}deg) rotateY(${(Math.sin(p*Math.PI*2-.4)*42+state.pointerX)*sway*(mobile?.45:1)*(1-exit)}deg) rotateZ(${Math.sin(p*Math.PI*2)*-16*sway*(1-exit)}deg)`;
        frames.forEach((frame,index)=>{
          const pose=depthPose(index,p,width,height,mobile);
          const opacity=mobile&&index>=18?0:pose.opacity;
          frame.style.transform=`translate(-50%,-50%) translate3d(${pose.x}px,${pose.y}px,${pose.z}px) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg) scale(${pose.scale})`;
          frame.style.opacity=String(opacity);
          frame.style.visibility=opacity<.025?'hidden':'visible';
          frame.tabIndex=opacity>.25?0:-1;
        });
      };
      // Keep refreshes from the deferred globe from reverting an entrance tween.
      // ScrollTrigger owns the position; one reusable tween eases toward it.
      const glide=gsap.quickTo(state,'position',{duration:.9,ease:'power2.out',onUpdate:draw});
      const trigger=ScrollTrigger.create({trigger:section,start:'top top',end:'bottom bottom',
        onUpdate:self=>glide(self.progress),
        onRefresh:self=>{glide(self.progress,self.progress);glide.tween.progress(1).pause();draw();},
      });
      const resize=new ResizeObserver(()=>{width=stage.clientWidth;height=stage.clientHeight;draw();});resize.observe(stage);
      const move=(event:PointerEvent)=>{
        if(event.pointerType!=='mouse'||held.current)return;
        gsap.to(state,{pointerX:(event.clientX/width-.5)*5,pointerY:(event.clientY/height-.5)*-4,duration:1,overwrite:'auto',onUpdate:draw});
      };
      const leave=()=>{gsap.to(state,{pointerX:0,pointerY:0,duration:1,overwrite:'auto',onUpdate:draw});};
      stage.addEventListener('pointermove',move);stage.addEventListener('pointerleave',leave);
      draw();
      return ()=>{
        resize.disconnect();stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerleave',leave);
        trigger.kill();glide.tween.kill();gsap.killTweensOf(state);
        world.style.removeProperty('transform');delete section.dataset.progress;
        frames.forEach(frame=>{frame.removeAttribute('style');frame.removeAttribute('tabindex');});
      };
    });
    return ()=>media.revert();
  },[cards]);
  useEffect(()=>{
    if(selected===null)return;
    const key=(event:KeyboardEvent)=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();setSelected(index=>index===null?null:(index+(event.key==='ArrowRight'?1:-1)+photos.length)%photos.length);
    };
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
  },[selected,photos.length]);
  return <section id="through-the-lens" className="photo-depth" ref={root} aria-label="Through the lens: a spatial travel gallery">
    <h2 className="sr-only">Through the lens</h2>
    <a href="#observatory" className="photo-depth-skip">Continue to the globe</a>
    <div className="photo-depth-stage">
      <div className="photo-depth-world">{cards.map(({photo,index})=><button key={index} className={`photo-depth-frame depth-format-${index%4}`} data-repeat={cards.findIndex(card=>card.photo.src===photo.src)!==index} aria-label={`Open photograph: ${photo.title}`} onClick={()=>setSelected(photos.indexOf(photo))}>
        <Image src={photo.preview||photo.src} alt={photo.title} fill sizes={index===13?"(max-width:700px) 700px, 1100px":"(max-width:700px) 90vw, 640px"} loading="lazy" quality={90} unoptimized={!photo.sample} />
      </button>)}</div>
    </div>
    {current&&<Modal title="Through the lens" className="photo-depth-viewer" onClose={()=>setSelected(null)}>
      <div className="photo-depth-original"><Image src={current.src} alt={current.title} fill sizes="95vw" quality={90} unoptimized={!current.sample} /></div>
      <div className="photo-depth-viewer-bar">{current.sample&&<small>Licensed sample photography · not personal travel photos</small>}<div><button aria-label="Previous photograph" onClick={()=>setSelected(index=>index===null?null:(index-1+photos.length)%photos.length)}><ArrowLeft size={18}/></button><span aria-live="polite">{selected!+1} / {photos.length}</span><button aria-label="Next photograph" onClick={()=>setSelected(index=>index===null?null:(index+1)%photos.length)}><ArrowRight size={18}/></button></div></div>
    </Modal>}
  </section>;
}
