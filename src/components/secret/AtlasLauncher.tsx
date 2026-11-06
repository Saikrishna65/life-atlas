'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {useMusicPlayer} from '@/lib/music/MusicPlayerContext';
import {canShowAtlasLauncher} from '@/lib/atlas-ai/visibility';
import styles from './atlas-launcher.module.css';
const subscribeHydration=()=>()=>{};
export default function AtlasLauncher() {
  const pathname=usePathname();
  const {currentTrack,isNowPlayingOpen}=useMusicPlayer();
  const mounted=useSyncExternalStore(subscribeHydration,()=>true,()=>false);
  const [keyboard,setKeyboard]=useState(false),[blocked,setBlocked]=useState(false);
  useEffect(()=>{
    const update=()=>{
      const active=document.activeElement;
      setKeyboard(!!active?.matches('input,textarea,[contenteditable="true"]') || (window.visualViewport?.height??window.innerHeight)<window.innerHeight-120);
      setBlocked(!!document.querySelector('[role="dialog"][aria-modal="true"], [data-atlas-security-screen]'));
    };
    const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-modal','data-atlas-security-screen']});
    window.visualViewport?.addEventListener('resize',update);document.addEventListener('focusin',update);document.addEventListener('focusout',update);update();
    return()=>{observer.disconnect();window.visualViewport?.removeEventListener('resize',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);};
  },[]);
  if(!mounted||!canShowAtlasLauncher(pathname,blocked||isNowPlayingOpen,keyboard))return null;
  return createPortal(<Link href="/secret/atlas" aria-label="Open Atlas local assistant" className={styles.orb} style={{bottom:`calc(env(safe-area-inset-bottom, 0px) + ${currentTrack?190:100}px)`}}><span aria-hidden="true">✦</span><small>Atlas</small></Link>,document.body);
}
