"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";

interface TimelineEvent {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  type: string;
  link: string | null;
  linkText: string | null;
  image: string | null;
}

interface TimelineYear {
  year: number;
  events: TimelineEvent[];
}

export default function AnimatedTimeline({ timelineData }: { timelineData: TimelineYear[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track scroll progress of the entire timeline container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end end"]
  });

  return (
    <div className="relative" ref={containerRef}>
      
      <div className="flex flex-col gap-24">
        {timelineData.map(({ year, events }) => (
          <div key={year} className="flex flex-col md:flex-row items-start gap-8 md:gap-16 relative">
            
            {/* Massive background year */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none select-none z-0">
              <div className="sticky top-1/2 -translate-y-1/2 flex items-center justify-center overflow-hidden">
                <span className="font-display text-[12rem] md:text-[25rem] leading-none text-muted/5 tracking-tighter whitespace-nowrap opacity-50">
                  {year}
                </span>
              </div>
            </div>

            {/* Left Column: Sticky Year */}
            <div className="md:w-32 lg:w-40 sticky top-24 pt-2 z-10">
              <h2 className="font-display text-4xl md:text-5xl text-foreground">
                {year}
              </h2>
            </div>

            {/* Right Column: Timeline Events */}
            <div className="flex-1 relative z-10">
              
              {/* Year specific animated line */}
              <LineProgress />

              <div className="space-y-16 pb-8">
                {events.map((event) => (
                  <TimelineNode key={event.id} event={event} />
                ))}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

function LineProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"]
  });

  return (
    <>
      <div className="absolute left-[3.5px] top-4 bottom-0 w-[1px] bg-muted/30" />
      <motion.div 
        ref={ref}
        className="absolute left-[3.5px] top-4 bottom-0 w-[2px] bg-accent origin-top"
        style={{ scaleY: scrollYProgress }}
      />
    </>
  );
}

function TimelineNode({ event }: { event: TimelineEvent }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: nodeRef,
    offset: ["start center", "end center"]
  });
  
  // Create a fast spring or mapped value for the node filling up
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 1.5]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

  return (
    <article ref={nodeRef} className="relative pl-10 md:pl-16 group">
      {/* Background empty node */}
      <div className="absolute left-0 top-3 w-[8px] h-[8px] rounded-full bg-background border-[1.5px] border-muted z-10" />
      
      {/* Animated filled node */}
      <motion.div 
        className="absolute left-0 top-3 w-[8px] h-[8px] rounded-full bg-accent border-[1.5px] border-accent z-20 shadow-[0_0_15px_rgba(var(--accent),0.5)]"
        style={{ opacity, scale }}
      />

      {/* Event Content */}
      <motion.div 
        className="flex flex-col gap-6"
        initial={{ opacity: 0.4, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        
        {/* Meta */}
        <div className="flex items-center gap-4">
          <span className="font-sans text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <span className="w-4 h-[1px] bg-muted" />
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-accent/90">
            {event.type}
          </span>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          
          <div className="flex-1 flex flex-col gap-3">
            <h3 className="font-display text-2xl md:text-3xl text-foreground leading-tight group-hover:text-accent transition-colors">
              {event.title}
            </h3>
            
            {event.description && (
              <p className="font-body text-muted-foreground leading-relaxed text-base font-light max-w-xl">
                {event.description}
              </p>
            )}

            {event.link && event.linkText && (
              <div className="mt-3">
                <Link 
                  href={event.link} 
                  className="inline-flex items-center font-sans text-xs uppercase tracking-[0.1em] text-foreground hover:text-accent transition-colors border-b border-muted hover:border-accent pb-0.5"
                >
                  {event.linkText} <span className="ml-2 font-normal">&rarr;</span>
                </Link>
              </div>
            )}
          </div>

          {/* Optional Image */}
          {event.image && (
            <div className="w-full lg:w-48 aspect-[16/9] lg:aspect-square flex-shrink-0 mt-4 lg:mt-0">
              <Link href={event.link || '#'}>
                <div 
                  className="w-full h-full bg-cover bg-center rounded-sm bg-muted opacity-90 hover:opacity-100 transition-opacity"
                  style={{ backgroundImage: `url(${event.image})` }}
                />
              </Link>
            </div>
          )}

        </div>
      </motion.div>
    </article>
  );
}
