"use client";
import {useEffect,useRef,useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {publicPreloading} from '@/lib/public-loading/readiness';
export function usePublicLoading() {
  return useSyncExternalStore(listener=>{window.addEventListener('atlas-public-loading',listener);return ()=>window.removeEventListener('atlas-public-loading',listener);},publicPreloading,()=>true);
}
/** Hydration marker, separate from server markup and asset completion. */
export default function PublicPageReady() {
  const pathname=usePathname();const ref=useRef<HTMLSpanElement>(null);
  useEffect(()=>{if(ref.current)ref.current.dataset.publicReady='ready';},[pathname]);
  return <span ref={ref} hidden data-public-page={pathname} data-public-ready="pending" />;
}
