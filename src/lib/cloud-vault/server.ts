import type {Files} from 'files-sdk';
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {CLOUD_PREFIX,cloudObjectKey,isHex,sectionName,validateCopy,type CloudAccount,type SectionCopy,type ChunkRef} from './protocol';
export class VaultRequestError extends Error { constructor(message:string,public status=400){super(message);} }
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
type VaultFiles=Pick<Files,'exists'|'download'|'head'|'upload'|'signedUploadUrl'|'url'|'list'|'delete'>;
export interface VaultDependencies {files:VaultFiles;serialize:<T>(id:string,action:()=>Promise<T>)=>Promise<T>;}
export async function cloudVaultAction(body:Record<string,any>,token:string,deps?:VaultDependencies){
 if(!isHex(body.vaultId)||!isHex(token))throw new VaultRequestError('A valid recovery code is required.',403);
 const files=deps?.files||(await import('../control-room/cloud-server')).controlCloudFiles('music');const run=()=>executeAction(body,token,files);
 if(['create','commit','delete-vault','preserve-and-restart','activate-saved-copy'].includes(body.action)){
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
 const version=()=>hash(JSON.stringify(account!.sections));
 const savedPrefix=`${CLOUD_PREFIX}${body.vaultId}/saved-copies/`;
 const preserve=async()=>{const id=randomUUID(),savedAt=new Date().toISOString();await files.upload(`${savedPrefix}${id}.json`,JSON.stringify({format:'atlas-saved-cloud-v1',savedAt,account}),{contentType:'application/json',cacheControl:'no-store'});return {id,savedAt,sections:account!.sections};};
 if(body.action==='status')return {account,version:version()};
 if(body.action==='list-saved-copies'){
  const copies:{id:string;savedAt:string;sections:CloudAccount['sections']}[]=[];let cursor:string|undefined;
  do{const page=await files.list({prefix:savedPrefix,limit:1000,cursor});for(const item of page.items){const id=item.key.slice(savedPrefix.length).replace(/\.json$/,'');if(!/^[a-f0-9-]{36}$/.test(id))continue;const saved=JSON.parse(await(await files.download(item.key)).text());if(saved.format==='atlas-saved-cloud-v1')copies.push({id,savedAt:saved.savedAt,sections:saved.account.sections});}cursor=page.cursor;}while(cursor);
  return {copies:copies.sort((a,b)=>b.savedAt.localeCompare(a.savedAt))};
 }
 if(body.action==='preserve-and-restart'||body.action==='activate-saved-copy'){
  if(body.baseVersion!==version())throw new VaultRequestError('The cloud changed since you checked it. Check again before continuing.',409);
  if(body.action==='preserve-and-restart'){
   if(body.confirm!=='PRESERVE CLOUD AND KEEP DEVICE')throw new VaultRequestError('Confirm that you want to preserve the cloud copy and upload device data.');
   if(!Object.keys(account.sections).length)return {account,version:version(),preserved:null};
   const preserved=await preserve();account={...account,sections:{}};
   await files.upload(root,JSON.stringify(account),{contentType:'application/json',cacheControl:'no-store'});
   return {account,version:version(),preserved};
  }
  if(body.confirm!=='ACTIVATE SAVED CLOUD COPY')throw new VaultRequestError('Confirm the saved cloud copy selection.');
  if(typeof body.savedId!=='string'||!/^[a-f0-9-]{36}$/.test(body.savedId))throw new VaultRequestError('Choose a saved cloud copy.');
  const savedKey=`${savedPrefix}${body.savedId}.json`;if(!await files.exists(savedKey))throw new VaultRequestError('The saved cloud copy was not found.',404);
  const saved=JSON.parse(await(await files.download(savedKey)).text());
  if(saved.format!=='atlas-saved-cloud-v1'||saved.account.tokenHash!==account.tokenHash)throw new VaultRequestError('The saved cloud copy is invalid.');
  for(const copy of Object.values(saved.account.sections))validateCopy(copy as SectionCopy);
  const preserved=Object.keys(account.sections).length?await preserve():null;
  account={...account,sections:saved.account.sections};
  await files.upload(root,JSON.stringify(account),{contentType:'application/json',cacheControl:'no-store'});
  return {account,version:version(),preserved};
 }
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
