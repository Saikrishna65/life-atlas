'use client';
import {useEffect,useState} from 'react';
import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import {AtlasNative} from '@/lib/atlas-ai/native';
interface Model {id:string;name:string;bytes:number;installed:boolean;}
interface Bridge {
 list():Promise<{models:Model[];availableBytes:number;selected:string}>;
 install(options:{id:string;consent:boolean}):Promise<void>;
 cancel():Promise<void>;
 select(options:{id:string}):Promise<void>;
 remove(options:{id:string;confirmed:boolean}):Promise<void>;
 addListener(event:'progress',fn:(event:{id:string;received:number;total:number})=>void):Promise<PluginListenerHandle>;
}
const models=registerPlugin<Bridge>('AtlasModels');
export default function ModelManager(){
 const [items,setItems]=useState<Model[]>([]),[selected,setSelected]=useState(''),[space,setSpace]=useState(0),[pending,setPending]=useState<{model:Model;remove:boolean}|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('No verified models are available. No automatic downloads.');
 const native=Capacitor.isPluginAvailable('AtlasModels');
 async function refresh(){if(!native)return;const result=await models.list();setItems(result.models);setSelected(result.selected);setSpace(result.availableBytes);}
 useEffect(()=>{let alive=true;let listener:PluginListenerHandle|undefined;if(native){void models.list().then(r=>{if(alive){setItems(r.models);setSelected(r.selected);setSpace(r.availableBytes);}}).catch(e=>{if(alive)setStatus(String(e));});void models.addListener('progress',e=>{if(alive)setStatus(`Downloading ${Math.floor(e.received/e.total*100)}%`);}).then(l=>{if(alive)listener=l;else void l.remove();});}return()=>{alive=false;if(listener)void listener.remove();if(native)void models.cancel();};},[native]);
 async function perform(fn:()=>Promise<void>){setBusy(true);try{await AtlasNative.unload();await fn();await refresh();setStatus('Model operation complete. Refresh device capabilities before generating.');}catch(e){setStatus(e instanceof Error?e.message:String(e));}finally{setBusy(false);setPending(null);}}
 return <details><summary>Offline models</summary><p role="status">{status}</p>{native&&<p>Available storage: {Math.floor(space/1048576)} MB. Cancel discards the partial download; resume is not supported.</p>}{items.map(m=><div key={m.id}><strong>{m.name}</strong> · {Math.ceil(m.bytes/1048576)} MB · {m.installed?'Verified installed':'Not installed'}{selected===m.id?' · Selected':''}<button disabled={busy} onClick={()=>setPending({model:m,remove:false})}>Download</button><button disabled={busy||!m.installed} onClick={()=>void perform(()=>models.select({id:m.id}))}>Select</button><button disabled={busy||!m.installed} onClick={()=>setPending({model:m,remove:true})}>Remove</button></div>)}{busy&&<button onClick={()=>void models.cancel()}>Cancel model operation</button>}{pending&&<div role="alert"><p>{pending.remove?'Delete this model file? Conversations remain intact.':`Download ${pending.model.name} (${Math.ceil(pending.model.bytes/1048576)} MB) to this device?`}</p><button disabled={busy} onClick={()=>void perform(()=>pending.remove?models.remove({id:pending.model.id,confirmed:true}):models.install({id:pending.model.id,consent:true}))}>Confirm</button><button disabled={busy} onClick={()=>setPending(null)}>Cancel</button></div>}</details>;
}
