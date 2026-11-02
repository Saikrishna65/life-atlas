import {appServiceUrl,MOBILE_API_ORIGIN} from '../appNetwork';
import {allowAtlasMutation} from '../mobileRequest';
export class ControlInputError extends Error {constructor(message:string,public status=400){super(message);this.name="ControlInputError";}}
import type {CloudAsset} from './types';
export const MANAGED_BUCKETS=['images','music'] as const;
export const TRASH_PREFIX='control-room/trash/';
export function cloudBucket(value:unknown):'images'|'music'{if(value!=='images'&&value!=='music')throw new ControlInputError('Choose a managed Atlas storage bucket.');return value;}
export function cloudKey(value:unknown):string{if(typeof value!=='string'||!value||value.length>900||value.startsWith('/')||value.split('/').some(p=>p==='..'||p==='.')||/[\u0000-\u001f\\]/.test(value))throw new ControlInputError('Invalid file path.');return value;}
export function safeFilename(value:string){return value.normalize('NFKC').replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/^\.+/,'').slice(0,150)||'file';}
export function originalTrashKey(key:string){if(!key.startsWith(TRASH_PREFIX))return undefined;try{const encoded=key.slice(TRASH_PREFIX.length).split('/').slice(1).join('/');return cloudKey(decodeURIComponent(encoded));}catch{return undefined;}}
export function newTrashKey(key:string,id:string){if(key.startsWith(TRASH_PREFIX))throw new ControlInputError('This file is already in Trash.');return `${TRASH_PREFIX}${id}/${encodeURIComponent(key)}`;}
export function objectKeyFromUrl(value:string,bucket:string,allowedOrigins:string[]=[]){try{const url=new URL(value,'https://atlas.invalid');if((value.startsWith('/')||allowedOrigins.includes(url.origin)||(process.env.NEXT_PUBLIC_OFFLINE_APP==='true'&&url.origin===new URL(MOBILE_API_ORIGIN).origin))&&url.pathname==='/api/control-room/file'&&url.searchParams.get('bucket')===bucket)return cloudKey(url.searchParams.get('key'));if(!allowedOrigins.includes(url.origin))return undefined;const prefix=`/${bucket}/`,path=decodeURIComponent(url.pathname),index=path.indexOf(prefix);return index>=0?cloudKey(path.slice(index+prefix.length)):undefined;}catch{return undefined;}}
export function stableCloudUrl(bucket:string,key:string){return appServiceUrl(`/api/control-room/file?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`);}
export function allowControlMutation(request:Request){return allowAtlasMutation(request,'x-atlas-control');}
export function cloudActionImpact(asset:CloudAsset){return {bytes:asset.bytes,referenceCount:asset.references.length,permanent:asset.trash};}
