import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {newRecoveryCode,vaultIdentity,sha256} from '../src/lib/cloud-vault/codec';
import {createCloudLink,connectCloudLink,uploadSections,restoreSections,sectionDB,cloudStatus,beginAutomaticCloudSync,setAutomaticUploads,getCloudLink} from '../src/lib/cloud-vault/client';
import {CLOUD_SECTIONS} from '../src/lib/cloud-vault/protocol';
import {saveTrip,saveDocument,getTrip,getDocument,saveItineraryDay,getItinerariesForTrip} from '../src/lib/vault/storage';
import {saveTrack,getTrack,savePlaylist,getPlaylist} from '../src/lib/music/storage';
import {IndexedDBUnitOfWork} from '../src/lib/finance/storage/indexeddb/unitOfWork';
import {AccountService} from '../src/lib/finance/application/accountService';
import {controlPut} from '../src/lib/control-room/store';
import {installMobileNetwork} from '../mobile/network';
if(process.argv.includes('--check-imports')){console.log('Cloud verifier imports ready');process.exit(0);}
const origin=process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN||'https://life-atlas-eight-five.vercel.app';
const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}});Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
const realFetch=globalThis.fetch;
Object.defineProperty(globalThis,'location',{configurable:true,value:{href:'https://localhost/secret/control-room',origin:'https://localhost'}});
const checkedFetch:typeof fetch=async(input,init={})=>{const url=new URL(input instanceof Request?input.url:String(input));if(url.origin===origin&&url.pathname.startsWith('/api/')&&url.pathname!=='/api/cloud-vault')throw new Error('Cloud verification must not write published app records.');return realFetch(input,{...init,signal:init.signal||AbortSignal.timeout(60000)});};
installMobileNetwork(checkedFetch,{enabled:true,request:async options=>{const response=await checkedFetch(options.url,{method:options.method,headers:options.headers,body:options.data});return {status:response.status,headers:Object.fromEntries(response.headers.entries()),data:await response.text(),url:options.url};}});
globalThis.fetch=(window as any).fetch;

async function clear(){for(const section of CLOUD_SECTIONS){const db=await sectionDB(section);const stores=Array.from(db.objectStoreNames);await new Promise<void>((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');for(const store of stores)tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});if(section==='studio')db.close();}data.clear();}
const code=newRecoveryCode(),identity=await vaultIdentity(code);let created=false;
try{
 // Reproduce the installed APK's Origin-stripped native bridge before testing
 // the corrected native transport. This must work without reinstalling.
 const legacy=await checkedFetch(origin+'/api/cloud-vault',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Cloud':'1','X-Capacitor-Platform':'android','X-Atlas-Vault-Token':identity.token},body:JSON.stringify({action:'create',vaultId:identity.id})});
 assert.equal(legacy.status,200,'Installed Android APK must connect without an Origin header');created=true;
 console.log('Installed APK compatibility: Origin-stripped cloud setup passed.');
 const now=new Date().toISOString();await saveTrip({id:'cloud-live-trip',title:'Temporary cloud recovery check',destination:'Test',startDate:now,endDate:now,status:'PLANNING',travelStyle:'LEISURE',budgetTotal:1000,currency:'INR',createdAt:now,updatedAt:now});
 await saveDocument({id:'cloud-live-doc',tripId:'cloud-live-trip',title:'Temporary document',fileName:'test.txt',fileType:'OTHER',mimeType:'text/plain',sizeBytes:6,blobData:new Blob(['ticket']),createdAt:now,updatedAt:now});
 const audio=new Uint8Array(4*1024*1024+101);crypto.getRandomValues(audio.subarray(0,65536));
 await saveTrack({id:'cloud-live-audio',title:'Temporary recovery audio',artist:'Test',album:'',genre:'',duration:1,size:audio.length,format:'audio/wav',audioBlob:new Blob([audio],{type:'audio/wav'}),source:'IMPORTED',isFavorite:false,playCount:0,addedAt:Date.now(),fileName:'test.wav'});await savePlaylist({id:'cloud-live-playlist',title:'Temporary playlist',trackIds:['cloud-live-audio'],createdAt:Date.now(),updatedAt:Date.now()},false);
 const uow=new IndexedDBUnitOfWork();const account=await new AccountService(uow).createAccount({name:'Temporary recovery account',accountType:'bank',openingBalancePaise:12345,currency:'INR'});
 const studio=await sectionDB('studio');await new Promise<void>((resolve,reject)=>{const tx=studio.transaction('entries','readwrite');tx.objectStore('entries').put({id:'cloud-live-studio',section:'Memories',createdAt:now,fields:{title:'Temporary private note'}});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});studio.close();await controlPut('settings',{id:'preferences',value:{cloudBudgetBytes:null,musicSyncPaused:false,tripRemindersPaused:false,mutedNotificationIds:[]}});
 await saveTrip({id:'cloud-live-idea',title:'Someday trip idea',destination:'Japan',startDate:'',status:'DRAFT',travelStyle:'LEISURE',budgetTotal:0,currency:'INR',timeZone:'Asia/Kolkata',createdAt:now,updatedAt:now});await saveItineraryDay({id:'cloud-live-relative-day',tripId:'cloud-live-idea',dayIndex:1,date:'',title:'Future exploring',activities:[],createdAt:now,updatedAt:now});
 await createCloudLink(code);created=true;await uploadSections();assert.equal(Object.keys((await cloudStatus())!.sections).length,5);
 assert.equal(getCloudLink()!.automatic,true);setAutomaticUploads(false);assert.equal(getCloudLink()!.automatic,false);
 const before=(await cloudStatus())!.sections.preferences!.revision;
 const stopSync=beginAutomaticCloudSync();
 try{
  await controlPut('settings',{id:'preferences',value:{cloudBudgetBytes:null,musicSyncPaused:false,tripRemindersPaused:true,mutedNotificationIds:[]}});
  setAutomaticUploads(true);
  const deadline=Date.now()+90000;let saved=false;
  while(Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,2500));if((await cloudStatus())!.sections.preferences!.revision!==before){saved=true;break;}}
  assert.equal(saved,true,'Enabling automatic uploads must save the changed preferences without a manual upload');
  console.log('Native automatic uploads passed: switch enabled and local preferences saved to live cloud.');
 }finally{stopSync();}


 // Exercise recovery for the installed client without replacing local records.
 const api=async(action:string,extra:any={})=>{const response=await globalThis.fetch('/api/cloud-vault',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Cloud':'1','X-Atlas-Vault-Token':identity.token},body:JSON.stringify({action,vaultId:identity.id,...extra})});const result=await response.json();assert.equal(response.status,200,result.error);return result;};
 const checkpoint=JSON.parse(data.get('atlas_cloud_connection_v1')!);checkpoint.copies.trips.revision='unconfirmed-checkpoint';data.set('atlas_cloud_connection_v1',JSON.stringify(checkpoint));
 await saveTrip({...(await getTrip('cloud-live-trip'))!,id:'new-offline-trip',title:'New unsaved local trip'});
 await assert.rejects(()=>uploadSections(),/newer cloud copy/);
 const checked=await api('status');const saved=await api('preserve-and-restart',{baseVersion:checked.version,confirm:'PRESERVE CLOUD AND KEEP DEVICE'});assert.ok(saved.preserved);
 assert.equal((await getTrip('new-offline-trip'))!.title,'New unsaved local trip');await uploadSections();
 assert.equal((await api('list-saved-copies')).copies[0].id,saved.preserved.id);
 const newActive=await api('status');const switched=await api('activate-saved-copy',{baseVersion:newActive.version,savedId:saved.preserved.id,confirm:'ACTIVATE SAVED CLOUD COPY'});
 await clear();await connectCloudLink(code);await restoreSections();assert.equal(await getTrip('new-offline-trip'),null);assert.equal((await getTrack('cloud-live-audio'))!.audioBlob!.size,audio.length);
 const oldActive=await api('status');await api('activate-saved-copy',{baseVersion:oldActive.version,savedId:switched.preserved.id,confirm:'ACTIVATE SAVED CLOUD COPY'});
 console.log('Live conflict recovery passed: local records never replaced; previous cloud snapshot preserved; both copies independently restorable.');
 for(let cycle=0;cycle<2;cycle++){await clear();await connectCloudLink(code);await restoreSections();assert.equal((await getTrip('cloud-live-trip'))!.title,'Temporary cloud recovery check');assert.equal((await getTrip('cloud-live-idea'))!.startDate,'');assert.equal((await getItinerariesForTrip('cloud-live-idea'))[0].date,'');assert.equal((await getTrip('new-offline-trip'))!.title,'New unsaved local trip');assert.equal(await((await getDocument('cloud-live-doc'))!.blobData as Blob).text(),'ticket');const track=(await getTrack('cloud-live-audio'))!;assert.equal(track.audioBlob!.size,audio.length);assert.equal(await sha256(new Uint8Array(await track.audioBlob!.arrayBuffer())),await sha256(audio));assert.deepEqual((await getPlaylist('cloud-live-playlist'))!.trackIds,['cloud-live-audio']);assert.equal((await uow.accounts.getById(account.id))!.openingBalancePaise,12345);}
 console.log('Live cloud verification passed: all five sections uploaded; multi-chunk audio and document restored twice after clearing local data.');
}finally{
 if(created){const response=await globalThis.fetch('/api/cloud-vault',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Cloud':'1','X-Atlas-Vault-Token':identity.token},body:JSON.stringify({action:'delete-vault',confirm:'DELETE THIS CLOUD VAULT',vaultId:identity.id})});if(!response.ok)throw new Error('Temporary verification vault cleanup failed.');console.log('Temporary encrypted cloud verification files removed.');}
 globalThis.fetch=realFetch;
}
