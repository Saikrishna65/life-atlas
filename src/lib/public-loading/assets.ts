/** React can retain inactive routes in hidden Activity/streaming containers. */
export function isActivePageNode(node:Element,root:Element):boolean {
  for(let parent=node.parentElement;parent&&parent!==root;parent=parent.parentElement){
    if(parent.hidden||parent.style.display==='none')return false;
  }
  return true;
}
type Asset = {source:string; state:'pending'|'ready'|'error'; dispose:()=>void};
/** Track decoded display assets, never full video downloads or unseen originals. */
export function trackPageAssets(root:Element,changed:()=>void) {
  const elements=new Map<Element,Asset>();
  const images=new Map<string,Asset>();
  let disposed=false;
  const notify=()=>{if(!disposed)changed();};
  const watchImage=(image:HTMLImageElement)=>{
    const source=image.currentSrc||image.src;
    if(!source||source===location.href)return;
    const previous=elements.get(image);
    if(previous?.source===source)return;
    previous?.dispose();
    const loaded=()=>{
      asset.source=image.currentSrc||image.src;
      void image.decode().catch(()=>{}).then(()=>{asset.state=image.naturalWidth?'ready':'error';notify();});
    };
    const failed=()=>{asset.state='error';notify();};
    const asset:Asset={source,state:'pending',dispose:()=>{image.removeEventListener('load',loaded);image.removeEventListener('error',failed);}};
    elements.set(image,asset);
    image.addEventListener('load',loaded);image.addEventListener('error',failed);
    image.loading='eager';
    if(image.complete){if(image.naturalWidth)loaded();else failed();}
  };
  const watchURL=(source:string,active:Set<string>)=>{
    if(!source)return;active.add(source);if(images.has(source))return;
    const image=new window.Image();
    const asset:Asset={source,state:'pending',dispose:()=>{image.onload=null;image.onerror=null;}};
    images.set(source,asset);
    image.onload=()=>{void image.decode().catch(()=>{}).then(()=>{asset.state='ready';notify();});};
    image.onerror=()=>{asset.state='error';notify();};
    image.src=source;
  };
  const watchVideo=(video:HTMLVideoElement,active:Set<string>)=>{
    if(video.poster)watchURL(video.poster,active);
    if(matchMedia('(prefers-reduced-motion:reduce)').matches&&video.poster)return;
    const source=video.getAttribute('src')?video.src:video.querySelector('source')?.src||video.currentSrc||'';
    if(!source)return;
    const previous=elements.get(video);if(previous?.source===source)return;previous?.dispose();
    const selected=()=>video.currentSrc.split('#')[0]===source.split('#')[0];
    const loaded=()=>{if(!selected())return;asset.state='ready';if(document.documentElement.dataset.publicLoading==='true'){video.preload='metadata';video.pause();}notify();};
    const failed=()=>{if(!selected())return;asset.state='error';notify();};
    const asset:Asset={source,state:!selected()?'pending':video.error?'error':video.readyState>=2?'ready':'pending',dispose:()=>{video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);}};
    elements.set(video,asset);
    video.addEventListener('loadeddata',loaded);video.addEventListener('error',failed);
    if(asset.state==='pending'){
      video.preload='auto';if(video.networkState===HTMLMediaElement.NETWORK_EMPTY||(video.error&&!selected()))video.load();
    }
  };
  return {
    scan(){
      const active=new Set<string>();
      root.querySelectorAll<HTMLImageElement>('img').forEach(image=>{if(isActivePageNode(image,root))watchImage(image);});
      root.querySelectorAll<HTMLVideoElement>('video').forEach(video=>{if(isActivePageNode(video,root))watchVideo(video,active);});
      root.querySelectorAll<HTMLElement>('[style*="background-image"]').forEach(el=>{
        if(!isActivePageNode(el,root))return;
        for(const match of el.style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g))watchURL(match[1],active);
      });
      const current=[...[...elements].filter(([el])=>el.isConnected&&root.contains(el)&&isActivePageNode(el,root)).map(([,asset])=>asset),...[...images.values()].filter(asset=>active.has(asset.source))];
      return {pending:current.filter(asset=>asset.state==='pending').length,failed:current.filter(asset=>asset.state==='error').length,total:current.length};
    },
    dispose(){disposed=true;elements.forEach(asset=>asset.dispose());images.forEach(asset=>asset.dispose());elements.clear();images.clear();},
  };
}
