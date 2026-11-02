import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {newRecoveryCode,vaultIdentity,sha256} from '../src/lib/cloud-vault/codec';
import {createCloudLink,connectCloudLink,uploadSections,restoreSections,sectionDB,cloudStatus} from '../src/lib/cloud-vault/client';
import {CLOUD_SECTIONS} from '../src/lib/cloud-vault/protocol';
import {saveTrip,saveDocument,getTrip,getDocument} from '../src/lib/vault/storage';
import {saveTrack,getTrack,savePlaylist,getPlaylist} from '../src/lib/music/storage';
import {IndexedDBUnitOfWork} from '../src/lib/finance/storage/indexeddb/unitOfWork';
import {AccountService} from '../src/lib/finance/application/accountService';
import {controlPut} from '../src/lib/control-room/store';
if(process.argv.includes('--check-imports')){console.log('Cloud verifier imports ready');process.exit(0);}
const origin=process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN||'https://life-atlas-eight-five.vercel.app';
const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}});Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
const realFetch=globalThis.fetch;
globalThis.fetch=(async(input:any,init:any={})=>{const local=typeof input==='string'&&input.startsWith('/api/');const headers=new Headers(init.headers);if(local){headers.set('Origin','https://localhost');headers.set('X-Capacitor-Platform','android');}return realFetch(local?new URL(input,origin):input,{...init,headers,signal:init.signal||AbortSignal.timeout(45000)});}) as typeof fetch;
async function clear(){for(const section of CLOUD_SECTIONS){const db=await sectionDB(section);const stores=Array.from(db.objectStoreNames);await new Promise<void>((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');for(const store of stores)tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});if(section==='studio')db.close();}data.clear();}
const code=newRecoveryCode(),identity=await vaultIdentity(code);let created=false;
try{
 const now=new Date().toISOString();await saveTrip({id:'cloud-live-trip',title:'Temporary cloud recovery check',destination:'Test',startDate:now,endDate:now,status:'PLANNING',travelStyle:'LEISURE',budgetTotal:1000,currency:'INR',createdAt:now,updatedAt:now});
 await saveDocument({id:'cloud-live-doc',tripId:'cloud-live-trip',title:'Temporary document',fileName:'test.txt',fileType:'OTHER',mimeType:'text/plain',sizeBytes:6,blobData:new Blob(['ticket']),createdAt:now,updatedAt:now});
 const audio=new Uint8Array(4*1024*1024+101);crypto.getRandomValues(audio.subarray(0,65536));
 await saveTrack({id:'cloud-live-audio',title:'Temporary recovery audio',artist:'Test',album:'',genre:'',duration:1,size:audio.length,format:'audio/wav',audioBlob:new Blob([audio],{type:'audio/wav'}),source:'IMPORTED',isFavorite:false,playCount:0,addedAt:Date.now(),fileName:'test.wav'});await savePlaylist({id:'cloud-live-playlist',title:'Temporary playlist',trackIds:['cloud-live-audio'],createdAt:Date.now(),updatedAt:Date.now()});
 const uow=new IndexedDBUnitOfWork();const account=await new AccountService(uow).createAccount({name:'Temporary recovery account',accountType:'bank',openingBalancePaise:12345,currency:'INR'});
 const studio=await sectionDB('studio');await new Promise<void>((resolve,reject)=>{const tx=studio.transaction('entries','readwrite');tx.objectStore('entries').put({id:'cloud-live-studio',section:'Memories',createdAt:now,fields:{title:'Temporary private note'}});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});studio.close();await controlPut('settings',{id:'preferences',value:{cloudBudgetBytes:null,musicSyncPaused:false,tripRemindersPaused:false,mutedNotificationIds:[]}});
 await createCloudLink(code);created=true;await uploadSections();assert.equal(Object.keys((await cloudStatus())!.sections).length,5);
 for(let cycle=0;cycle<2;cycle++){await clear();await connectCloudLink(code);await restoreSections();assert.equal((await getTrip('cloud-live-trip'))!.title,'Temporary cloud recovery check');assert.equal(await((await getDocument('cloud-live-doc'))!.blobData as Blob).text(),'ticket');const track=(await getTrack('cloud-live-audio'))!;assert.equal(track.audioBlob!.size,audio.length);assert.equal(await sha256(new Uint8Array(await track.audioBlob!.arrayBuffer())),await sha256(audio));assert.deepEqual((await getPlaylist('cloud-live-playlist'))!.trackIds,['cloud-live-audio']);assert.equal((await uow.accounts.getById(account.id))!.openingBalancePaise,12345);}
 console.log('Live cloud verification passed: all five sections uploaded; multi-chunk audio and document restored twice after clearing local data.');
}finally{
 if(created){const response=await globalThis.fetch('/api/cloud-vault',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Cloud':'1','X-Atlas-Vault-Token':identity.token},body:JSON.stringify({action:'delete-vault',confirm:'DELETE THIS CLOUD VAULT',vaultId:identity.id})});if(!response.ok)throw new Error('Temporary verification vault cleanup failed.');console.log('Temporary encrypted cloud verification files removed.');}
 globalThis.fetch=realFetch;
}
