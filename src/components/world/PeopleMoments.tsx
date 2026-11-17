"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { peoplePhotos, type PeoplePhoto } from "@/data/demo/people";
import { Modal } from "./primitives";
import "./people-moments.css";

export default function PeopleMoments({ photos = peoplePhotos }: { photos?: readonly PeoplePhoto[] }) {
  const root = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const index = photos.findIndex(photo => photo.id === selected);
  const current = photos[index];
  const signature = photos.map(photo => photo.id).join('|');
  useEffect(() => {
    if (!root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add('(min-width:801px) and (prefers-reduced-motion:no-preference)', () => {
      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('.people-float').forEach((frame, i) => {
          gsap.fromTo(frame, { y:45 + i % 3 * 18 }, { y:-45 - i % 3 * 18, ease:'none', scrollTrigger:{trigger:root.current,start:'top bottom',end:'bottom top',scrub:1} });
        });
      }, root);
      return () => context.revert();
    });
    media.add('(prefers-reduced-motion:no-preference)', () => {
      const context = gsap.context(() => {
        const path = root.current!.querySelector<SVGPathElement>('.people-route path')!;
        const length = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray:length, strokeDashoffset:length }, { strokeDashoffset:0, ease:'none', scrollTrigger:{trigger:root.current,start:'top 65%',end:'bottom 85%',scrub:1} });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, [signature]);
  useEffect(() => {
    if (!current) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      setSelected(photos[(index + (event.key === 'ArrowRight' ? 1 : -1) + photos.length) % photos.length].id);
    };
    window.addEventListener('keydown',key);
    return () => window.removeEventListener('keydown',key);
  }, [current,index,photos]);
  if (!photos.length) return null;
  return <section id="people" className="people-moments" ref={root} aria-labelledby="people-title">
    <div className="people-canvas">
      <svg className="people-route" viewBox="0 0 1400 1300" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M-100 130C180-70 470 40 350 280S40 650 300 710 1150 270 1290 550 650 870 880 1060 1280 1100 1500 1280" /></svg>
      <header className="people-heading" data-world-reveal><span className="people-eyebrow">THE PEOPLE ALONG THE WAY</span><h2 id="people-title">Some places<br />are <em>people.</em></h2><p>The laughs between the miles.<br />The people who make a place feel like home.</p></header>
      <div className="people-photos">{photos.map((photo,i)=><div key={photo.id} className={`people-float people-position-${i % 8 + 1}`}><button className="people-print" aria-label={`Open photo: ${photo.title || photo.alt}`} onClick={()=>setSelected(photo.id)}><div><Image src={photo.src} alt={photo.alt} unoptimized={!photo.sample} fill sizes="(max-width:800px) 45vw, 30vw" loading="lazy" /></div></button></div>)}</div>
      <p className="people-signoff">The company I keep.<br /><em>The moments I keep coming back to.</em></p>
    </div>
    {current && <Modal title={current.title || 'A moment worth keeping'} className="people-viewer" onClose={()=>setSelected(null)}><div className="people-viewer-image"><Image key={current.id} src={current.original||current.src} unoptimized={!current.sample} alt={current.alt} width={1600} height={1200} sizes="90vw" /></div><div className="people-viewer-bar"><div>{current.context && <p>{current.context}</p>}{current.sample && <small>Real stock photography, used with permission under its source license. Not my personal collection.</small>}</div><div className="people-viewer-nav"><button aria-label="Previous people photo" onClick={()=>setSelected(photos[(index-1+photos.length)%photos.length].id)}><ArrowLeft size={18}/></button><span aria-live="polite">{index+1} / {photos.length}</span><button aria-label="Next people photo" onClick={()=>setSelected(photos[(index+1)%photos.length].id)}><ArrowRight size={18}/></button></div></div></Modal>}
  </section>;
}
