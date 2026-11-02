import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createMemory,createPlace,getEntries,flushStudioEntries} from '../../mobile/studio-storage';
test('offline drafts persist, failed publication keeps data, reconnect replay uses stable IDs',async()=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),originalOnline=Object.getOwnPropertyDescriptor(navigator,'onLine'),originalFetch=globalThis.fetch;
 Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
 try{
 const f=new FormData();f.set('title','Saved without internet');await createMemory(f);
 const saved=await getEntries();assert.equal(saved.length,1);assert.equal(saved[0].syncedAt,undefined);
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
 globalThis.fetch=async()=>Response.json({error:'Temporarily unavailable'},{status:503});await flushStudioEntries();assert.equal((await getEntries())[0].id,saved[0].id);assert.equal((await getEntries())[0].syncedAt,undefined);
 const sent:string[]=[];globalThis.fetch=async(_input,init)=>{sent.push(JSON.parse(String(init?.body)).id);return Response.json({success:true})};await flushStudioEntries();assert.deepEqual(sent,[saved[0].id]);assert.ok((await getEntries())[0].syncedAt);await flushStudioEntries();assert.equal(sent.length,1);
 // A second save during an in-flight flush must also be included before that flush finishes.
 Object.defineProperty(navigator,'onLine',{configurable:true,value:false});const g=new FormData();g.set('title','First');await createMemory(g);
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve});let started!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve});let count=0;
 globalThis.fetch=async()=>{if(++count===1){started();await held;}return Response.json({success:true})};const flushing=flushStudioEntries();await ready;const h=new FormData();h.set('name','Second');h.set('country','India');await createPlace(h);release();await flushing;
 assert.equal((await getEntries()).filter(e=>!e.syncedAt).length,0);assert.equal(count,2);
 }finally{globalThis.fetch=originalFetch;if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');if(originalOnline)Object.defineProperty(navigator,'onLine',originalOnline);else Reflect.deleteProperty(navigator,'onLine');}
});
