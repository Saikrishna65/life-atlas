import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertResourceOwner,sensitiveApiDenial} from '@/lib/security/api-authorization';
import {ensureCleanStart} from '@/lib/cloud-vault/clean-start';
import {saveTrack,getAllTracks} from '@/lib/music/storage';
import {readFileSync,readdirSync} from 'node:fs';
function routes(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?routes(`${dir}/${entry.name}`):entry.name==='route.ts'?[`${dir}/${entry.name}`]:[]);}
test('sensitive server APIs deny every identity transport without network access',async()=>{
 for(const headers of ([{},{authorization:'Bearer forged'},{'x-capacitor-platform':'android','x-atlas-cloud':'1'},{cookie:'session=forged'}] as Record<string,string>[])){
  const response=await sensitiveApiDenial(new Request('https://atlas.invalid',{headers}));
  assert.equal(response?.status,403);
 }
 const principal={id:'local-test',subject:'synthetic'};
 assert.throws(()=>assertResourceOwner(principal,undefined),/denied/);
 assert.throws(()=>assertResourceOwner(principal,'other'),/denied/);
});
test('every sensitive route handler is guarded before resource operations',()=>{
 for(const path of routes('src/app/api')){
  if(!/api\/(music|control-room|cloud-vault|upload|vault|mobile\/studio)\//.test(path))continue;
  const source=readFileSync(path,'utf8');
  assert.equal((source.match(/const denial=await sensitiveApiDenial\(/g)||[]).length,(source.match(/export async function /g)||[]).length,path);
 }
});
test('startup never touches storage or native tracking; reading tracks preserves sample-like records',async()=>{
 const previous=globalThis.localStorage;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Startup touched storage');}});
 try{await ensureCleanStart();await ensureCleanStart();}finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:previous});}
 const record={id:'sample_nature_1',title:'Synthetic edited sample',artist:'Owner',album:'',genre:'',duration:1,size:5,format:'audio/mpeg',source:'IMPORTED' as const,isFavorite:false,playCount:0,addedAt:1,audioBlob:new Blob(['media'])};
 await saveTrack(record);
 assert.equal(await (await getAllTracks()).find(t=>t.id===record.id)!.audioBlob!.text(),'media');
});
