"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { DetailMedia } from "@/lib/public-trips/detail";
import {optimizeJournalImage} from "@/lib/public-trips/image-source";
import DetailFilm from "./DetailFilm";

/** Three flowing columns, with native media and one existing scroll clock. */
export default function TripJournalGallery({ items, paused, onOpen }: { items: DetailMedia[]; paused: boolean; onOpen: (id: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const signature = items.map(item => item.id).join("|");
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();
    motion.add("(min-width:801px) and (prefers-reduced-motion:no-preference)", () => {
      const context = gsap.context(() => {
        const columns = root.current!.querySelectorAll<HTMLElement>(".td-gallery-column");
        columns.forEach((column, index) => {
          const middle = index === 1;
          gsap.fromTo(column, { y: middle ? -35 : 65 }, { y: middle ? 35 : -65, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: .8, invalidateOnRefresh: true } });
        });
        gsap.fromTo(root.current, { clipPath: "inset(0 32% 0 32%)" }, { clipPath: "inset(0 0% 0 0%)", ease: "none", scrollTrigger: { trigger: root.current, start: "top 70%", end: "top 15%", scrub: .65 } });
      }, root);
      return () => context.revert();
    });
    return () => motion.revert();
  }, [signature]);
  const size = Math.ceil(items.length / 3);
  const columns = size ? Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size)) : [];
  return <div className="td-photo-wall" ref={root} data-columns={columns.length}>
    {columns.map((column, index) => <div className="td-gallery-column" key={index}>{column.map(item => <button key={item.id} className="td-frame" onClick={() => onOpen(item.id)} aria-label={`Open ${item.kind === "video" ? "film" : "photo"} from ${item.place}`}><div>{item.kind === "video" ? <DetailFilm src={item.url} poster={item.poster} paused={paused} label={`Silent film from ${item.place}`} /> : <Image src={item.url} alt={`Trip photograph from ${item.place}`} width={1400} height={1000} loading="lazy" sizes="(max-width:800px) 100vw, 33vw" quality={90} unoptimized={!optimizeJournalImage(item.url)} onError={event=>{const image=event.currentTarget;if(image.dataset.originalFallback)return;image.dataset.originalFallback='true';image.removeAttribute('srcset');image.src=item.url;}} />}</div></button>)}</div>)}
  </div>;
}
