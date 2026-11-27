import { isVideoWebPath } from "../video/routes";
/** Only public routes participate. Native/private and admin screens are untouched. */
export function isPublicPath(path: string | null): boolean {
  return !!path && !isVideoWebPath(path) && !/^\/(?:secret|admin|api|_next)(?:\/|$)/.test(path);
}

export function isPageNavigation(href:string,current:string): boolean {
  try {
    const target=new URL(href,current),from=new URL(current);
    return target.origin===from.origin && target.pathname!==from.pathname && isPublicPath(target.pathname);
  } catch { return false; }
}

const tasks=new Map<symbol,{path:string;label:string}>();
export function beginPublicTask(label:string):()=>void {
  if(typeof window==='undefined'||!isPublicPath(location.pathname)) return ()=>{};
  const token=Symbol(label);
  tasks.set(token,{path:location.pathname,label});
  window.dispatchEvent(new Event('atlas-public-work'));
  return ()=>{if(tasks.delete(token))window.dispatchEvent(new Event('atlas-public-work'));};
}
export function pendingPublicTasks(path:string):string[] { return [...tasks.values()].filter(task=>task.path===path).map(task=>task.label); }
export function publicPreloading():boolean { return typeof document!=='undefined'&&document.documentElement.dataset.publicLoading==='true'; }
export function setPublicLoading(active:boolean) {
  if(active===publicPreloading())return;
  if(active){document.documentElement.dataset.publicLoading='true';delete document.documentElement.dataset.publicReady;delete document.documentElement.dataset.publicReadyMode;}else delete document.documentElement.dataset.publicLoading;
  window.dispatchEvent(new Event('atlas-public-loading'));
}
/** Listeners also check current state, so a lazy chapter cannot miss preparation. */
export function onPublicPreload(prepare:()=>void):()=>void {
  window.addEventListener('atlas-public-preload',prepare);
  if(publicPreloading())prepare();
  return ()=>window.removeEventListener('atlas-public-preload',prepare);
}
