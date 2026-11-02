import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cloudVaultAction,type VaultDependencies} from '../../src/lib/cloud-vault/server';
import {vaultIdentity,newRecoveryCode,sha256,encryptChunk,decryptChunk} from '../../src/lib/cloud-vault/codec';
import {createCloudLink,connectCloudLink,uploadSections,restoreSections,captureSection,sectionDB,compareSections,cloudStatus} from '../../src/lib/cloud-vault/client';
import {CLOUD_SECTIONS,type CloudSection} from '../../src/lib/cloud-vault/protocol';
import {saveTrip,saveDocument,getTrip,getDocument,saveItineraryDay,getItinerariesForTrip} from '../../src/lib/vault/storage';
import {saveTrack,getTrack,savePlaylist,getPlaylist} from '../../src/lib/music/storage';
import {IndexedDBUnitOfWork,AccountService,TransactionService} from '../../src/lib/finance';
import {controlPut,getControlSettings} from '../../src/lib/control-room/store';
const memory=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>memory.get(k)||null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}});
Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
class MemoryFiles {
 rows=new Map<string,{blob:Blob;etag:string}>();revision=0;
 exists=async(key:string)=>this.rows.has(key);
 head=async(key:string)=>{const row=this.rows.get(key);if(!row)throw new Error('Missing');return {key,size:row.blob.size,etag:row.etag};};
 download=async(key:string)=>{const row=this.rows.get(key);if(!row)throw new Error('Missing');return {...await this.head(key),text:()=>row.blob.text()};};
 upload=async(key:string,value:any)=>{this.rows.set(key,{blob:value instanceof Blob?value:new Blob([value]),etag:String(++this.revision)});return this.head(key);};
 list=async(options:any={})=>({items:await Promise.all([...this.rows.keys()].filter(k=>k.startsWith(options.prefix||'')).map(this.head)),cursor:undefined});
 delete=async(keys:string|string[])=>{for(const key of Array.isArray(keys)?keys:[keys])this.rows.delete(key);};
 signedUploadUrl=async(key:string)=>({method:'PUT',url:'https://memory.invalid/'+key,headers:{'Content-Type':'application/octet-stream'}});
 url=async(key:string)=>'https://memory.invalid/'+key;
}
const files=new MemoryFiles();let queue=Promise.resolve();const deps:VaultDependencies={files:files as any,serialize:async(_id,fn)=>{const next=queue.then(fn);queue=next.then(()=>{},()=>{});return next;}};
let failUpload=false;
const originalFetch=globalThis.fetch;
globalThis.fetch=(async(input:any,init:any={})=>{
 const url=String(input);if(url==='/api/cloud-vault'){try{const result=await cloudVaultAction(JSON.parse(init.body),new Headers(init.headers).get('x-atlas-vault-token')!,deps);return Response.json(result);}catch(e:any){return Response.json({error:e.message},{status:e.status||503});}}
 if(url.startsWith('https://memory.invalid/')){const key=url.slice('https://memory.invalid/'.length);if(init.method==='PUT'){if(failUpload)return new Response('offline',{status:503});await files.upload(key,init.body);return new Response(null,{status:200});}const item=files.rows.get(key);return item?new Response(item.blob):new Response(null,{status:404});}
 throw new Error('Unexpected request '+url);
}) as typeof fetch;
async function clearDevice(){for(const section of CLOUD_SECTIONS){const db=await sectionDB(section);const names=Array.from(db.objectStoreNames);await new Promise<void>((resolve,reject)=>{const tx=db.transaction(names,'readwrite');for(const name of names)tx.objectStore(name).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});if(section==='studio')db.close();}memory.clear();}
async function put(section:CloudSection,store:string,value:unknown){const db=await sectionDB(section);await new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});if(section==='studio')db.close();}
test('all sections, large audio, attachments, finance and preferences survive a fresh installation',async()=>{
 try{
 const now=new Date().toISOString();await saveTrip({id:'cloud-trip',title:'Real test trip',destination:'Coast',startDate:now,endDate:now,status:'PLANNING',travelStyle:'LEISURE',budgetTotal:1000,currency:'INR',createdAt:now,updatedAt:now});
 await saveDocument({id:'cloud-doc',tripId:'cloud-trip',title:'Ticket',fileName:'ticket.pdf',fileType:'PDF',mimeType:'application/pdf',sizeBytes:6,blobData:new Blob(['ticket'],{type:'application/pdf'}),createdAt:now,updatedAt:now});
 const audio=new Uint8Array(9*1024*1024+17);for(let i=0;i<audio.length;i++)audio[i]=i%251;
 await saveTrack({id:'cloud-track',title:'Local song',artist:'Artist',album:'Album',genre:'',duration:120,size:audio.length,format:'audio/mpeg',audioBlob:new Blob([audio],{type:'audio/mpeg'}),source:'IMPORTED',isFavorite:true,playCount:4,addedAt:1,fileName:'local.mp3'});
 await savePlaylist({id:'cloud-playlist',title:'Travel music',trackIds:['cloud-track'],tripId:'cloud-trip',createdAt:1,updatedAt:1});
 const uow=new IndexedDBUnitOfWork();const emptyFinance=(await compareSections()).find(s=>s.section==='finance')!;assert.equal(emptyFinance.records,0);assert.equal(emptyFinance.pending,0);const account=await new AccountService(uow).createAccount({name:'My bank',accountType:'bank',openingBalancePaise:100000,currency:'INR'});
 await put('studio','entries',{id:'studio-entry',section:'Memories',createdAt:now,fields:{title:'A local note',description:'Saved offline'}});
 await controlPut('settings',{id:'preferences',value:{cloudBudgetBytes:null,musicSyncPaused:false,tripRemindersPaused:true,mutedNotificationIds:[12]}});memory.set('atlas_music_theme','midnight');
 const code=newRecoveryCode();await createCloudLink(code);const accountBefore=await uploadSections();assert.equal(Object.keys(accountBefore.sections).length,5);assert.ok(accountBefore.sections.music!.chunks.length>=3);assert.equal((await compareSections(accountBefore)).reduce((n,s)=>n+s.pending,0),0);
 // Binary payloads and all user text are encrypted; the object store contains no readable private records.
 const storedText=await Promise.all([...files.rows.entries()].filter(([key])=>key.includes('/objects/')).map(async([,row])=>new TextDecoder().decode(await row.blob.arrayBuffer())));assert.ok(storedText.every(t=>!t.includes('A local note')&&!t.includes('My bank')));
 const identity=await vaultIdentity(code);await assert.rejects(()=>cloudVaultAction({action:'status',vaultId:identity.id},'0'.repeat(64),deps),/recovery code/);
 // An interrupted upload never replaces the last complete section copy.
 await saveTrip({...(await getTrip('cloud-trip'))!,title:'Updated title',updatedAt:new Date().toISOString()});failUpload=true;await assert.rejects(()=>uploadSections(['trips']),/upload/);assert.equal((await cloudStatus())!.sections.trips!.revision,accountBefore.sections.trips!.revision);failUpload=false;await uploadSections(['trips']);
 await clearDevice();assert.equal(await getTrip('cloud-trip'),null);await connectCloudLink(code);await restoreSections();
 assert.equal((await getTrip('cloud-trip'))!.title,'Updated title');assert.equal(await ((await getDocument('cloud-doc'))!.blobData as Blob).text(),'ticket');const restored=(await getTrack('cloud-track'))!;assert.equal(restored.audioBlob!.size,audio.length);assert.equal(await sha256(new Uint8Array(await restored.audioBlob!.arrayBuffer())),await sha256(audio));assert.deepEqual((await getPlaylist('cloud-playlist'))!.trackIds,['cloud-track']);assert.equal((await uow.accounts.getById(account.id))!.name,'My bank');assert.equal((await captureSection('studio')).stores[0].rows.length,1);assert.equal((await getControlSettings()).tripRemindersPaused,true);assert.equal(memory.get('atlas_music_theme'),'midnight');
 const after=await cloudStatus();assert.equal((await compareSections(after)).reduce((n,s)=>n+s.pending,0),0);
 // Repeat restore on another installation using exactly the same recovery code.
 await clearDevice();await connectCloudLink(code);await restoreSections();assert.equal((await getTrack('cloud-track'))!.audioBlob!.size,audio.length);
 const finalAccount=await cloudStatus();await assert.rejects(()=>cloudVaultAction({action:'commit',vaultId:identity.id,section:'trips',baseRevision:accountBefore.sections.trips!.revision,copy:accountBefore.sections.trips},identity.token,deps),/changed on another device/);
 const chunk=finalAccount!.sections.music!.chunks[0],objectKey=`private-vault/${identity.id}/music/objects/${chunk.id}`,original=files.rows.get(objectKey)!;
 const broken=new Uint8Array(await original.blob.arrayBuffer());broken[20]^=1;files.rows.set(objectKey,{...original,blob:new Blob([broken])});
 await saveTrip({...(await getTrip('cloud-trip'))!,title:'Keep this local change'});await assert.rejects(()=>restoreSections(['music','trips']));assert.equal((await getTrip('cloud-trip'))!.title,'Keep this local change');assert.equal((await getTrack('cloud-track'))!.audioBlob!.size,audio.length);files.rows.set(objectKey,original);
 // Resolve a real conflict through the recovery helper, with no local restore.
 const checkpoint=memory.get('atlas_cloud_connection_v1')!;
 await saveTrip({...(await getTrip('cloud-trip'))!,title:'Cloud-side edit'});await uploadSections(['trips']);
 memory.set('atlas_cloud_connection_v1',checkpoint);
 await saveTrip({...(await getTrip('cloud-trip'))!,title:'Unsaved local edit'});
 await saveTrip({...(await getTrip('cloud-trip'))!,id:'new-offline-trip',title:'New offline trip'});
 await put('studio','entries',{id:'new-offline-note',section:'Memories',createdAt:now,fields:{title:'New offline note'}});
 await assert.rejects(()=>uploadSections(),/newer cloud copy/);
 const status=await cloudVaultAction({action:'status',vaultId:identity.id},identity.token,deps) as any;
 const request={action:'preserve-and-restart',vaultId:identity.id,baseVersion:status.version,confirm:'PRESERVE CLOUD AND KEEP DEVICE'};
 await assert.rejects(()=>cloudVaultAction({...request,baseVersion:'stale'},identity.token,deps),/changed since/);
 const beforeFailure=(await cloudStatus())!.sections.trips!.revision;
 const failingDeps={...deps,files:{...files,upload:async()=>{throw new Error('Preservation failed');}}} as unknown as VaultDependencies;
 await assert.rejects(()=>cloudVaultAction(request,identity.token,failingDeps),/Preservation failed/);
 assert.equal((await cloudStatus())!.sections.trips!.revision,beforeFailure);
 const preserved=await cloudVaultAction(request,identity.token,deps) as any;
 assert.equal(Object.keys((await cloudStatus())!.sections).length,0);
 assert.equal((await getTrip('new-offline-trip'))!.title,'New offline trip');
 assert.equal((await getTrip('cloud-trip'))!.title,'Unsaved local edit');
 assert.equal((await getTrack('cloud-track'))!.audioBlob!.size,audio.length);
 await assert.rejects(()=>cloudVaultAction({...request,baseVersion:status.version},identity.token,deps),/changed since/);
 const saved=await cloudVaultAction({action:'list-saved-copies',vaultId:identity.id},identity.token,deps) as any;
 assert.equal(saved.copies.length,1);assert.equal(saved.copies[0].id,preserved.preserved.id);assert.equal(saved.copies[0].sections.trips.revision,beforeFailure);
 // The unmodified installed client's Upload all now succeeds with new local data.
 await uploadSections();const localSaved=await cloudStatus();assert.equal(localSaved!.sections.trips!.records,3);
 const activeVersion=(await cloudVaultAction({action:'status',vaultId:identity.id},identity.token,deps) as any).version;
 const switched=await cloudVaultAction({action:'activate-saved-copy',vaultId:identity.id,baseVersion:activeVersion,savedId:preserved.preserved.id,confirm:'ACTIVATE SAVED CLOUD COPY'},identity.token,deps) as any;
 assert.ok(switched.preserved);assert.equal((await getTrip('new-offline-trip'))!.title,'New offline trip');
 // Both complete cloud snapshots remain restorable, including audio and Finance.
 await clearDevice();await connectCloudLink(code);await restoreSections();assert.equal((await getTrip('cloud-trip'))!.title,'Cloud-side edit');assert.equal(await getTrip('new-offline-trip'),null);
 const oldActive=await cloudVaultAction({action:'status',vaultId:identity.id},identity.token,deps) as any;
 await cloudVaultAction({action:'activate-saved-copy',vaultId:identity.id,baseVersion:oldActive.version,savedId:switched.preserved.id,confirm:'ACTIVATE SAVED CLOUD COPY'},identity.token,deps);
 await clearDevice();await connectCloudLink(code);await restoreSections();assert.equal((await getTrip('cloud-trip'))!.title,'Unsaved local edit');assert.equal((await getTrip('new-offline-trip'))!.title,'New offline trip');assert.equal((await captureSection('studio')).stores[0].rows.length,2);assert.equal((await getTrack('cloud-track'))!.audioBlob!.size,audio.length);assert.equal((await uow.accounts.getById(account.id))!.name,'My bank');

 await saveTrip({id:'cloud-idea',title:'Someday in Japan',destination:'Japan',startDate:'',status:'DRAFT',travelStyle:'LEISURE',budgetTotal:0,currency:'INR',timeZone:'Asia/Kolkata',createdAt:now,updatedAt:now});await saveItineraryDay({id:'relative-day',tripId:'cloud-idea',dayIndex:1,date:'',title:'Explore Kyoto',activities:[],createdAt:now,updatedAt:now});await uploadSections(['trips']);await clearDevice();await connectCloudLink(code);await restoreSections();assert.equal((await getTrip('cloud-idea'))!.startDate,'');assert.equal((await getTrip('cloud-idea'))!.finance,undefined);assert.equal((await getItinerariesForTrip('cloud-idea'))[0].date,'');

 }finally{globalThis.fetch=originalFetch;}
});
test('encrypted chunk rejects a different recovery key and changed ciphertext',async()=>{const a=await vaultIdentity(newRecoveryCode()),b=await vaultIdentity(newRecoveryCode()),plain=new TextEncoder().encode('Private Finance data'),id=await sha256(plain),blob=await encryptChunk(plain,a.key);await assert.rejects(()=>decryptChunk(blob,b.key,id));const damaged=new Uint8Array(await blob.arrayBuffer());damaged[20]^=1;await assert.rejects(()=>decryptChunk(new Blob([damaged]),a.key,id));});
