"use client";

import {Capacitor,registerPlugin} from "@capacitor/core";
import { useState, useEffect, useCallback, useRef, useMemo,createElement,createContext,useContext,type ReactNode } from "react";
import {
  ExpeditionLegCategory,
  LiveExpeditionSession,
  ID,
} from "./types";
import {
  getLiveExpedition,
  saveLiveExpedition,
} from "./storage";
import {
  startExpedition,
  startNewLeg,
  pauseExpedition,
  resumeExpedition,
  endExpedition,
  addBreadcrumbToExpedition,
  positionBreadcrumb,
  advanceExpeditionClock,
  exportExpeditionToGeoJson,
  formatDuration,
} from "./liveTrackingEngine";
import { notifyVaultChange } from "./useTripVault";
import { syncActiveTripToWidget } from "./tripWidgetSync";
import { triggerHaptic } from "@/lib/deviceAuth";

// Native Capacitor Plugins Bridge helper
interface TrackingPlugins {
  ExpeditionTracking?:{startTracking(input:{tripId:string;legTitle?:string;category?:ExpeditionLegCategory;distanceKm?:number}):Promise<unknown>;stopTracking():Promise<unknown>;isTracking():Promise<{tracking:boolean}>;getPendingLocations(input:{tripId:string;after:number}):Promise<{points:{latitude:number;longitude:number;accuracy:number;timestamp:number;speed:number|null;altitude:number|null;altitudeAccuracy:number|null}[]}>};
  AtlasPermissions?:{requestLocationPermission():Promise<{granted:boolean}>};
}
const NativeTracking=registerPlugin<NonNullable<TrackingPlugins["ExpeditionTracking"]>>("ExpeditionTracking");
const NativePermissions=registerPlugin<NonNullable<TrackingPlugins["AtlasPermissions"]>>("AtlasPermissions");
function getCapacitorPlugins():TrackingPlugins|null {
  return Capacitor.getPlatform()==="android"?{ExpeditionTracking:NativeTracking,AtlasPermissions:NativePermissions}:null;
}

const ExpeditionContext=createContext<{tripId:string;data:ReturnType<typeof useLiveExpeditionController>}|null>(null);
export function LiveExpeditionProvider({tripId,children}:{tripId:string;children:ReactNode}) {
  const data=useLiveExpeditionController(tripId);
  // This module is .ts, so keep the provider free of JSX.
  return createElement(ExpeditionContext.Provider,{value:{tripId,data}},children);
}
export function useLiveExpedition(tripId:ID) {
  const shared=useContext(ExpeditionContext);
  const local=useLiveExpeditionController(shared?.tripId===tripId?null:tripId);
  return shared?.tripId===tripId?shared.data:local;
}
function useLiveExpeditionController(tripId: ID|null) {
  const [session, setSession] = useState<LiveExpeditionSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const sessionRef = useRef<LiveExpeditionSession | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const operationVersion=useRef(0);
  const pendingWrites=useRef(0);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load session from IndexedDB
  const loadSession = useCallback(async () => {
    try {
      if(!tripId||pendingWrites.current)return;
      const version=operationVersion.current;
      let data = await getLiveExpedition(tripId);
      if(data?.status==="ACTIVE"&&!sessionRef.current&&data.lastClockAt&&Date.now()-data.lastClockAt>120000){
        const running=Capacitor.getPlatform()==="android"?await NativeTracking.isTracking().catch(()=>({tracking:false})):{tracking:false};
        if(!running.tracking){data=pauseExpedition({...data,lastClockAt:Date.now()});setError("Recording was interrupted. Your existing route is safe; resume to continue a new segment.");}
      }
      if(version===operationVersion.current&&!pendingWrites.current){sessionRef.current=data;setSession(data);}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load expedition session.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    queueMicrotask(()=>void loadSession());
    const handleVaultChange = () => loadSession();
    window.addEventListener("life_atlas_vault_change", handleVaultChange);
    return () => {
      window.removeEventListener("life_atlas_vault_change", handleVaultChange);
    };
  }, [loadSession]);

  // Persist session update helper
  const persist = useCallback(
    async (updated: LiveExpeditionSession) => {
      if(!tripId||updated.tripId!==tripId)return;
      pendingWrites.current++;
      operationVersion.current++;
      sessionRef.current=updated;setSession(updated);
      const write=writeQueue.current.catch(()=>{}).then(async()=>{
      try {
        await saveLiveExpedition(tripId, updated);
        notifyVaultChange();

        // Sync with Native Android Notification Service & Home Screen Widget
        // The native service measures its own filtered fixes. Never overwrite
        // a newer native distance with a delayed WebView persistence callback.
        void syncActiveTripToWidget(tripId);
      } catch (err) {
        setError("The latest GPS update could not be saved. Existing trip data is unchanged.");
        throw err;
      }
      });
      writeQueue.current=write;
      try{await write;}finally{pendingWrites.current--;}
    },
    [tripId]
  );

  // Live stopwatch timer when tracking is ACTIVE
  useEffect(() => {
    if (session?.status === "ACTIVE") {
      let lastSaved=Date.now();
      timerRef.current = setInterval(() => {
        const current=sessionRef.current;if(!current||current.tripId!==tripId||current.status!=="ACTIVE")return;
        const updated=advanceExpeditionClock(current,Date.now());
        if(updated.currentLocation && Date.now()-updated.currentLocation.timestamp>10000)updated.currentSpeedKmh=0;
        operationVersion.current++;sessionRef.current=updated;setSession(updated);
        if(Date.now()-lastSaved>=10000){lastSaved=Date.now();void persist(updated).catch(()=>{});}
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.status, session?.activeLegId, persist,tripId]);

  // Geolocation Watcher
  useEffect(() => {
    if(!tripId)return;
    if(session?.status==="ACTIVE" && Capacitor.getPlatform()==="android"){
      let alive=true,polling=false;
      const poll=async()=>{if(polling)return;polling=true;try{
        const current=sessionRef.current;if(!current)return;
        const leg=current.legs.find(leg=>leg.id===current.activeLegId);
        const after=Math.max(leg?.coordinates.at(-1)?.timestamp??0,leg?.segmentStartedAt??Date.parse(leg?.startedAt||"0"));
        const batch=await NativeTracking.getPendingLocations({tripId,after});
        if(!alive)return;
        let updated=sessionRef.current;
        if(!updated||updated.status!=="ACTIVE")return;
        for(const point of batch.points)updated=addBreadcrumbToExpedition(updated,positionBreadcrumb({timestamp:point.timestamp,coords:point}));
        if(updated!==sessionRef.current)await persist(updated);
      }catch{if(alive)setError("Native GPS updates are unavailable. Check location permission and resume tracking; saved points remain intact.");}finally{polling=false;}};
      void poll();const timer=setInterval(()=>void poll(),3000);return()=>{alive=false;clearInterval(timer);};
    }
    if (session?.status === "ACTIVE" && typeof window !== "undefined" && "geolocation" in navigator) {
      const handlePosition = (pos: GeolocationPosition) => {
        const currentSession = sessionRef.current;
        if (!currentSession || currentSession.status !== "ACTIVE") return;

        const newPoint = positionBreadcrumb(pos);
        const updated = addBreadcrumbToExpedition(currentSession,newPoint);
        if(updated!==currentSession)void persist(updated).catch(()=>{});
      };

      const handleError = (err: GeolocationPositionError) => {
        console.warn("GPS tracking warning:", err.message);
      };

      watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      });
    } else {
      if (watchIdRef.current !== null && typeof window !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null && typeof window !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [session?.status, session?.activeLegId, persist,tripId]);

  // Actions
  const start = useCallback(
    async (title = "Full Expedition", category: ExpeditionLegCategory = "TREK") => {
      if(!tripId)return;
      triggerHaptic("tap");
      if(sessionRef.current?.legs.some(leg=>leg.coordinates.length))throw new Error("This trip already has a recording. Resume it or add a leg; the saved route was preserved.");

      // Request native Android permission if available
      const plugins = getCapacitorPlugins();
      if (plugins?.AtlasPermissions) {
        const permission=await plugins.AtlasPermissions.requestLocationPermission();
        if(!permission.granted)throw new Error("Allow precise location permission to record a GPS route.");
      }

      if (plugins?.ExpeditionTracking) {
        await plugins.ExpeditionTracking.startTracking({ tripId, legTitle: title, category, distanceKm:sessionRef.current?.totalDistanceKm??0 });
      }

      const newSession = startExpedition(tripId, title, category);
      await persist(newSession);
    },
    [tripId, persist]
  );

  const startLeg = useCallback(
    async (title: string, category: ExpeditionLegCategory = "TREK") => {
      triggerHaptic("tap");
      if (!session||!tripId) return;
      const updated = startNewLeg(sessionRef.current || session, title, category);
      const plugins=getCapacitorPlugins();
      if(plugins?.ExpeditionTracking)await plugins.ExpeditionTracking.startTracking({tripId,legTitle:title,category,distanceKm:updated.totalDistanceKm});
      await persist(updated);
    },
    [session, persist,tripId]
  );

  const pause = useCallback(async () => {
    triggerHaptic("tap");
    if (!sessionRef.current||!tripId) return;
    const plugins=getCapacitorPlugins();
    if(plugins?.ExpeditionTracking)await plugins.ExpeditionTracking.stopTracking();
    const updated = pauseExpedition(sessionRef.current);
    await persist(updated);
  }, [session, persist]);

  const resume = useCallback(async () => {
    triggerHaptic("tap");
    if (!sessionRef.current||!tripId) return;
    const current=sessionRef.current;
    const leg=current.legs.find(leg=>leg.id===current.activeLegId);
    const plugins=getCapacitorPlugins();
    if(plugins?.ExpeditionTracking)await plugins.ExpeditionTracking.startTracking({tripId,legTitle:leg?.title,category:leg?.category,distanceKm:current.totalDistanceKm});
    const updated = resumeExpedition(current);
    await persist(updated);
  }, [session, persist,tripId]);

  const end = useCallback(async () => {
    triggerHaptic("success");
    if (!session) return;

    const plugins = getCapacitorPlugins();
    if (plugins?.ExpeditionTracking) {
      try {
        await plugins.ExpeditionTracking.stopTracking();
      } catch {}
    }

    const updated = endExpedition(sessionRef.current || session);
    await persist(updated);
  }, [session, persist]);

  const activeLeg = useMemo(() => {
    if (!session || !session.activeLegId) return null;
    return session.legs.find((l) => l.id === session.activeLegId) ?? null;
  }, [session]);

  const geoJson = useMemo(() => {
    if (!session) return null;
    return exportExpeditionToGeoJson(session);
  }, [session]);

  const elapsedFormatted = useMemo(() => {
    return formatDuration(session?.totalDurationSeconds ?? 0);
  }, [session?.totalDurationSeconds]);

  return {
    session,
    isLoading,
    error,
    isTracking: session?.status === "ACTIVE",
    isPaused: session?.status === "PAUSED",
    isCompleted: session?.status === "COMPLETED",
    activeLeg,
    geoJson,
    elapsedFormatted,
    start,
    startLeg,
    pause,
    resume,
    end,
    refresh: loadSession,
  };
}
