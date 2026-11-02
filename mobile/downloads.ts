import {Capacitor,registerPlugin} from '@capacitor/core';
export function installNativeDownloads() {
 if(!Capacitor.isNativePlatform()||!Capacitor.isPluginAvailable('AtlasFileExport'))return;
 const plugin=registerPlugin<{saveFile(options:{name:string;mimeType:string;data:string}):Promise<{saved:boolean}>}>('AtlasFileExport');
 const save=async(anchor:HTMLAnchorElement)=>{
  try {
   // Begin reading synchronously: existing exporters revoke their blob URL immediately after click().
   const response=await fetch(anchor.href);if(!response.ok)throw new Error('The export could not be read.');const blob=await response.blob();
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
   await plugin.saveFile({name:anchor.download||'atlas-export',mimeType:blob.type||'application/octet-stream',data});
  }catch(error){window.alert(error instanceof Error?error.message:'The file could not be saved.');}
 };
 const handles=(a:HTMLAnchorElement)=>a.hasAttribute('download')&&!!a.href;
 const original=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){if(handles(this)){void save(this);return;}original.call(this);};
 document.addEventListener('click',event=>{const a=(event.target as Element)?.closest?.('a');if(a instanceof HTMLAnchorElement&&handles(a)){event.preventDefault();void save(a);}},true);
}
