"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { useSpring } from "framer-motion";

interface TimelineEvent {
  id: string;
  latitude: number | null;
  longitude: number | null;
}

interface TimelineGlobeProps {
  events: TimelineEvent[];
  activeIndex: number;
}

export default function TimelineGlobe({ events, activeIndex }: TimelineGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeInstance = useRef<any>(null);

  // Smooth rotation springs
  const phiSpring = useSpring(0, { stiffness: 100, damping: 40, mass: 1 });
  const thetaSpring = useSpring(0, { stiffness: 100, damping: 40, mass: 1 });

  // Update target rotation when activeIndex changes
  useEffect(() => {
    const activeEvent = events[activeIndex];
    if (activeEvent && activeEvent.latitude !== null && activeEvent.longitude !== null) {
      const targetPhi = (activeEvent.longitude + 180) * (Math.PI / 180);
      const targetTheta = (activeEvent.latitude) * (Math.PI / 180);
      
      phiSpring.set(targetPhi);
      thetaSpring.set(targetTheta);
    }
  }, [activeIndex, events, phiSpring, thetaSpring]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let phi = 0;
    const validEvents = events.filter(e => e.latitude !== null && e.longitude !== null);
    
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 1000,
      height: 1000,
      phi: 0,
      theta: 0,
      dark: 1, // DARK MODE: guarantees the globe is drawn as a stark dark sphere
      diffuse: 1.2,
      mapSamples: 14000,
      mapBrightness: 6,
      baseColor: [0.1, 0.1, 0.15], // Dark slate blue
      markerColor: [0.12, 0.31, 0.85], // Vibrant blue markers
      glowColor: [0.3, 0.3, 0.3], // Soft dark glow
      markers: validEvents.map(e => ({
        location: [e.latitude!, e.longitude!],
        size: 0.05
      })),
      onRender: (state: Record<string, any>) => {
        if (events.length === 0) {
          phi += 0.005;
          state.phi = phi;
        } else {
          state.phi = phiSpring.get();
          state.theta = thetaSpring.get() * -0.5; 
        }
      }
    } as any);

    globeInstance.current = globe;

    return () => {
      globe.destroy();
    };
  }, [events, phiSpring, thetaSpring]); 

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none opacity-100">
      <div className="w-[400px] h-[400px] md:w-[500px] md:h-[500px]">
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
          }}
          width="1000"
          height="1000"
        />
      </div>
    </div>
  );
}
