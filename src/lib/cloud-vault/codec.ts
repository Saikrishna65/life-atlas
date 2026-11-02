import {CHUNK_BYTES,type ChunkRef} from './protocol';
const bytes=(input:Uint8Array)=>input as Uint8Array<ArrayBuffer>;
export async function sha256(value:Uint8Array|string){const data=typeof value==='string'?new TextEncoder().encode(value):value;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(data)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export function newRecoveryCode(){const hex=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');return `ATLAS-${hex.match(/.{1,8}/g)!.join('-')}`;}
export async function vaultIdentity(code:string){const secret=code.trim().replace(/^ATLAS-/i,'').replace(/[-\s]/g,'').toLowerCase();if(!/^[a-f0-9]{64}$/.test(secret))throw new Error('Enter the complete Atlas recovery code.');const id=await sha256('atlas-vault-id-v1:'+secret),token=await sha256('atlas-vault-access-v1:'+secret);const raw=Uint8Array.from(secret.match(/../g)!,v=>parseInt(v,16));const material=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveKey']);const key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new TextEncoder().encode(id),info:new TextEncoder().encode('atlas-private-files-v1')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);return {id,token,key};}
export async function encryptChunk(plain:Uint8Array,key:CryptoKey){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes(plain));return new Blob([iv,encrypted],{type:'application/octet-stream'});}
export async function decryptChunk(blob:Blob,key:CryptoKey,id:string){const data=new Uint8Array(await blob.arrayBuffer());if(data.length<28)throw new Error('The cloud file is incomplete.');const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.subarray(0,12)},key,data.subarray(12)));if(await sha256(plain)!==id)throw new Error('The cloud file failed verification.');return plain;}
export interface ChunkSink { (plain:Uint8Array): Promise<ChunkRef>; }
export async function encodeCloud(value:unknown,sink:ChunkSink):Promise<any>{
 if(value instanceof Blob||value instanceof ArrayBuffer||ArrayBuffer.isView(value)){
  const blob=value instanceof Blob?value:value instanceof ArrayBuffer?new Blob([value]):new Blob([new Uint8Array(value.buffer,value.byteOffset,value.byteLength) as Uint8Array<ArrayBuffer>]);const refs:ChunkRef[]=[];
  for(let offset=0;offset<blob.size;offset+=CHUNK_BYTES)refs.push(await sink(new Uint8Array(await blob.slice(offset,offset+CHUNK_BYTES).arrayBuffer())));
  return {$atlasCloud:value instanceof Blob?'blob':'buffer',type:value instanceof Blob?value.type:'',size:blob.size,chunks:refs};
 }
 if(value instanceof Date)return {$atlasCloud:'date',value:value.toISOString()};
 if(Array.isArray(value)){const result=[];for(const item of value)result.push(await encodeCloud(item,sink));return result;}
 if(value&&typeof value==='object'){const result:Record<string,unknown>={};for(const key of Object.keys(value).sort()){if(['__proto__','prototype','constructor','$atlasCloud'].includes(key))throw new Error('Unsupported record field.');const v=(value as any)[key];if(v!==undefined)result[key]=await encodeCloud(v,sink);}return result;}
 return value;
}
export async function decodeCloud(value:any,read:(ref:ChunkRef)=>Promise<Uint8Array>):Promise<any>{
 if(!value||typeof value!=='object')return value;
 if(value.$atlasCloud==='date'){const date=new Date(value.value);if(!Number.isFinite(date.getTime()))throw new Error('Invalid cloud date.');return date;}
 if(value.$atlasCloud==='blob'||value.$atlasCloud==='buffer'){
  if(!Array.isArray(value.chunks)||!Number.isSafeInteger(value.size)||value.size<0)throw new Error('Invalid cloud file.');const parts:BlobPart[]=[];let size=0;
  for(const ref of value.chunks){const data=await read(ref);parts.push(bytes(data));size+=data.byteLength;}if(size!==value.size)throw new Error('The cloud file is incomplete.');const blob=new Blob(parts,{type:value.type||''});return value.$atlasCloud==='blob'?blob:blob.arrayBuffer();
 }
 if(Array.isArray(value)){const result=[];for(const v of value)result.push(await decodeCloud(v,read));return result;}
 const result:Record<string,unknown>={};for(const [key,v]of Object.entries(value)){if(['__proto__','prototype','constructor','$atlasCloud'].includes(key))throw new Error('Invalid cloud record field.');result[key]=await decodeCloud(v,read);}return result;
}
