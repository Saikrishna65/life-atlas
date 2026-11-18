"use client";
import {useEffect,useRef,useState} from 'react';
import {Play,Pause,Volume2,VolumeX,Maximize,RotateCw,ExternalLink} from 'lucide-react';
export const videoTime=(seconds:number)=>Number.isFinite(seconds)?`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`:'0:00';
/** Controls live outside the intrinsic video rectangle, so letterboxing cannot stretch them. */
export default function JournalVideo({src,poster,label}:{src:string;poster?:string;label:string}){
 const video=useRef<HTMLVideoElement>(null),root=useRef<HTMLDivElement>(null);
 const [playing,setPlaying]=useState(false),[muted,setMuted]=useState(true),[buffering,setBuffering]=useState(true),[slow,setSlow]=useState(false),[failed,setFailed]=useState(false),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[feedback,setFeedback]=useState('');
 useEffect(()=>{const element=video.current!;element.muted=true;element.defaultMuted=true;void element.play().catch(()=>setBuffering(false));return()=>element.pause();},[src]);
 useEffect(()=>{if(!buffering||failed)return;const timer=setTimeout(()=>setSlow(true),12000);return()=>clearTimeout(timer);},[buffering,failed]);
 const toggle=()=>{const element=video.current!;if(element.paused){void element.play().catch(()=>{setBuffering(false);setPlaying(false);});}else element.pause();};
 const retry=()=>{setFailed(false);setSlow(false);setBuffering(true);const element=video.current!;element.load();void element.play().catch(()=>setBuffering(false));};
 const full=()=>{const element=video.current as HTMLVideoElement&{webkitEnterFullscreen?:()=>void};if(root.current?.requestFullscreen)void root.current.requestFullscreen().catch(()=>setFeedback('Full screen is unavailable here. You can open the original film.'));else if(element.webkitEnterFullscreen)element.webkitEnterFullscreen();else setFeedback('Full screen is unavailable here. You can open the original film.');};
 return <div ref={root} className="journal-player" data-media-controls>
  <div className="journal-player-picture" aria-busy={buffering&&!failed}>
   <video ref={video} src={src} poster={poster} autoPlay muted playsInline preload="auto" aria-label={label}
    onPlay={()=>setPlaying(true)} onPause={()=>{setPlaying(false);setBuffering(false);}} onPlaying={()=>{setPlaying(true);setBuffering(false);setSlow(false);}} onWaiting={()=>setBuffering(true)}
    onCanPlay={()=>{setBuffering(false);setSlow(false);}} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onEnded={()=>setPlaying(false)} onError={()=>{setFailed(true);setBuffering(false);setPlaying(false);}}/>
   {!playing&&!buffering&&!failed&&<button className="journal-play-overlay" onClick={toggle} aria-label="Play video"><Play size={28}/></button>}
   {buffering&&!failed&&<div className="journal-player-loading" role="status"><span/>{slow?'Still buffering…':'Loading film…'}{slow&&<button onClick={retry}>Retry</button>}</div>}
   {failed&&<div className="journal-player-error" role="status"><p>This film could not play. Its connection or format may not be supported by this browser.</p><button onClick={retry}><RotateCw size={16}/> Retry film</button><a href={src} target="_blank" rel="noreferrer">Open original <ExternalLink size={15}/></a></div>}
  </div>
  <div className="journal-player-controls">
   <button onClick={toggle} aria-label={playing?'Pause video':'Play video'} disabled={failed}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>
   <span className="journal-player-time">{videoTime(time)} / {videoTime(duration)}</span>
   <input type="range" aria-label="Seek video" min={0} max={Number.isFinite(duration)&&duration>0?duration:1} step={.1} value={Math.min(time,Number.isFinite(duration)&&duration>0?duration:1)} disabled={!Number.isFinite(duration)||duration<=0||failed} onChange={e=>{const seconds=Number(e.target.value);video.current!.currentTime=seconds;setTime(seconds);}}/>
   <button onClick={()=>{video.current!.muted=!muted;setMuted(!muted);}} aria-label={muted?'Unmute video':'Mute video'}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>
   <button onClick={full} aria-label="Full screen video"><Maximize size={18}/></button>
  </div>
  {feedback&&<p className="journal-player-feedback" role="status">{feedback} <a href={src} target="_blank" rel="noreferrer">Open original ↗</a></p>}
 </div>;
}
