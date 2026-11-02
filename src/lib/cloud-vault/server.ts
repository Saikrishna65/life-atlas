import type {Files} from 'files-sdk';
import {createHash,timingSafeEqual} from 'node:crypto';
import {CLOUD_PREFIX,cloudObjectKey,isHex,sectionName,validateCopy,type CloudAccount,type SectionCopy,type ChunkRef} from './protocol';
export class VaultRequestError extends Error { constructor(message:string,public status=400){super(message);} }
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
type VaultFiles=Pick<Files,'exists'|'download'|'head'|'upload'|'signedUploadUrl'|'url'|'list'|'delete'>;
export interface VaultDependencies {files:VaultFiles;serialize:<T>(id:string,action:()=>Promise<T>)=>Promise<T>;}
export async function cloudVaultAction(body:Record<string,any>,token:string,deps?:VaultDependencies){
 if(!isHex(body.vaultId)||!isHex(token))throw new VaultRequestError('A valid recovery code is required.',403);
 const files=deps?.files||(await import('../control-room/cloud-server')).controlCloudFiles('music');const run=()=>executeAction(body,token,files);
 if(['create','commit','delete-vault'].includes(body.action)){
  if(deps)return deps.serialize(body.vaultId,run);
  const {default:prisma}=await import('../prisma');
  return prisma.$transaction(async db=>{await db.$queryRaw`SELECT 1::int AS acquired FROM pg_advisory_xact_lock(hashtextextended(${body.vaultId},0))`;return run();},{timeout:50000,maxWait:10000});
 }
 return run();
}
async function executeAction(body:Record<string,any>,token:string,files:VaultFiles){
 if(!isHex(body.vaultId)||!isHex(token))throw new VaultRequestError('A valid recovery code is required.',403);
 const root=`${CLOUD_PREFIX}${body.vaultId}/index.json`;
 let account:CloudAccount|undefined,etag:string|undefined;
 if(await files.exists(root)){const file=await files.download(root);etag=file.etag;account=JSON.parse(await file.text());if(!account||!isHex(account.tokenHash)||!timingSafeEqual(Buffer.from(account.tokenHash,'hex'),Buffer.from(hash(token),'hex')))throw new VaultRequestError('The recovery code does not match this cloud vault.',403);}
 if(body.action==='create'){
  if(account)return {account};
  account={format:'atlas-cloud-v1',tokenHash:hash(token),sections:{}};
  await files.upload(root,JSON.stringify(account),{contentType:'application/json',cacheControl:'no-store'});return {account};
 }
 if(!account)throw new VaultRequestError('No cloud vault was found for this recovery code.',404);
 if(body.action==='status')return {account};
 if(body.action==='delete-vault'){if(body.confirm!=='DELETE THIS CLOUD VAULT')throw new VaultRequestError('Confirm this private cloud vault deletion.');let cursor:string|undefined;const keys:string[]=[];do{const page=await files.list({prefix:`${CLOUD_PREFIX}${body.vaultId}/`,limit:1000,cursor});keys.push(...page.items.map(f=>f.key));cursor=page.cursor;}while(cursor);for(let n=0;n<keys.length;n+=50)await files.delete(keys.slice(n,n+50));return {deleted:true};}
 const section=sectionName(body.section),key=(id:string)=>cloudObjectKey(body.vaultId,section,id);
 if(body.action==='prepare'){
  const ref=body.file as ChunkRef;if(!ref||!isHex(ref.id)||!Number.isSafeInteger(ref.bytes)||ref.bytes<28||ref.bytes>4*1024*1024+28)throw new VaultRequestError('Invalid file size.');
  if(await files.exists(key(ref.id))){const current=await files.head(key(ref.id));if(current.size!==ref.bytes)throw new VaultRequestError('Cloud file size does not match.',409);return {exists:true};}
  return {signed:await files.signedUploadUrl(key(ref.id),{contentType:'application/octet-stream',expiresIn:600,maxSize:ref.bytes})};
 }
 if(body.action==='download'){
  if(!isHex(body.fileId))throw new VaultRequestError('Invalid file identifier.');
  const current=account.sections[section];if(!current||![...current.chunks,...current.manifest].some(r=>r.id===body.fileId))throw new VaultRequestError('This file is not in the saved cloud copy.',404);
  return {url:await files.url(key(body.fileId),{expiresIn:600})};
 }
 if(body.action==='commit'){
  const copy=validateCopy(body.copy as SectionCopy);const current=account.sections[section];
  if((current?.revision||null)!==(body.baseRevision||null))throw new VaultRequestError('This cloud section changed on another device. Restore the latest copy before uploading.',409);
  const refs=[...new Map([...copy.chunks,...copy.manifest].map(r=>[r.id,r])).values()];
  const remaining=new Map(refs.map(ref=>[key(ref.id),ref.bytes]));let cursor:string|undefined;
  do{const page=await files.list({prefix:`${CLOUD_PREFIX}${body.vaultId}/${section}/objects/`,limit:1000,cursor});for(const item of page.items){const size=remaining.get(item.key);if(size!==undefined){if(item.size!==size)throw new VaultRequestError('Some cloud files are incomplete. Retry the upload.',409);remaining.delete(item.key);}}cursor=page.cursor;}while(cursor&&remaining.size);
  if(remaining.size)throw new VaultRequestError('Some files have not finished uploading. Keep your local data and retry.',409);
  account.sections[section]=copy;
  await files.upload(root,JSON.stringify(account),{contentType:'application/json',cacheControl:'no-store'});
  return {account};
 }
 throw new VaultRequestError('Unknown cloud operation.');
}
