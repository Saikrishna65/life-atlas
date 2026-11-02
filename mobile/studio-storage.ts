export type StudioEntry = {id: string; section: string; createdAt: string; fields: Record<string, string>; cloudFields?: Record<string,string>; syncedAt?:string; syncError?:string};
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('life_atlas_studio_db', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('entries', {keyPath:'id'});
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
async function put(entry: StudioEntry) {
 const db=await open();
 try { await new Promise<void>((resolve,reject) => { const tx=db.transaction('entries','readwrite');tx.objectStore('entries').put(entry);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error); }); }
 finally { db.close(); }
 window.dispatchEvent(new Event('atlas-studio-change'));
}
export async function saveEntry(section: string, form: FormData) {
 const fields: Record<string,string>={};form.forEach((v,k)=>{if(typeof v==='string')fields[k]=v;});
 await put({id:crypto.randomUUID(),section,createdAt:new Date().toISOString(),fields});
 void flushStudioEntries();
}
export async function getEntries(): Promise<StudioEntry[]> {
 const db=await open();
 try {return await new Promise((resolve,reject)=>{const r=db.transaction('entries').objectStore('entries').getAll();r.onsuccess=()=>resolve(r.result.sort((a:StudioEntry,b:StudioEntry)=>b.createdAt.localeCompare(a.createdAt)));r.onerror=()=>reject(r.error);});}
 finally {db.close();}
}
let flushing: Promise<void>|undefined;
export function flushStudioEntries(): Promise<void> {
 if(!navigator.onLine)return Promise.resolve();
 return flushing ??= (async()=>{
  for(const entry of await getEntries()) {
   if(entry.syncedAt)continue;
   try {
    const fields={...entry.fields,...entry.cloudFields};
    for(const name of ['coverImage','url'])if(fields[name]?.startsWith('data:')) {
     const blob=await fetch(fields[name]).then(r=>r.blob());const form=new FormData();form.append('file',blob,`studio-${entry.id}-${name}.${blob.type.split('/')[1]||'jpg'}`);
     const response=await fetch('/api/upload',{method:'POST',body:form});const result=await response.json();if(!response.ok||!result.url)throw new Error(result.error||'Photo upload pending.');
     fields[name]=result.url;entry.cloudFields={...entry.cloudFields,[name]:result.url};await put(entry);
    }
    const response=await fetch('/api/mobile/studio',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Studio':'1'},body:JSON.stringify({...entry,fields})});
    const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Publishing is pending.');
    entry.syncedAt=new Date().toISOString();delete entry.syncError;await put(entry);
   } catch(error) {entry.syncError=error instanceof Error?error.message:'Publishing is pending.';await put(entry);}
  }
 })().finally(()=>{flushing=undefined;});
}
export const createTrip=(f:FormData)=>saveEntry('Trips',f);
export const createPlace=(f:FormData)=>saveEntry('Places',f);
export const createPhoto=(f:FormData)=>saveEntry('Photos',f);
export const createMemory=(f:FormData)=>saveEntry('Memories',f);
export const createTimelineEvent=(f:FormData)=>saveEntry('Timeline',f);
