import type {Files} from 'files-sdk';
import {cloudKey,newTrashKey,originalTrashKey,TRASH_PREFIX,ControlInputError} from './cloud-policy';
interface Dependencies {files:Pick<Files,'head'|'url'|'copy'|'delete'|'exists'>;referencesAvailable:()=>Promise<unknown>;rewrite:(key:string,next:string|null)=>Promise<unknown>;id:()=>string;}
export async function executeCloudAction(body:Record<string,any>,deps:Dependencies){const {files}=deps,key=cloudKey(body.key),current=await files.head(key);
 if(body.action==='url')return {url:await files.url(key,{expiresIn:300,responseContentDisposition:body.download?'attachment':undefined})};
 if(!body.etag||current.etag!==body.etag)throw new ControlInputError('This file changed. Refresh before trying again.',409);
 const copy=async(target:string)=>{if(await files.exists(target))throw new ControlInputError('A file already exists at the destination. Choose another path.');await files.copy(key,target);};
 const removeSource=async()=>{if((await files.head(key)).etag!==current.etag)throw new ControlInputError('This file changed during the operation. Refresh to review its copies.',409);await files.delete(key);};
 if(body.action==='trash'){if(key.startsWith(TRASH_PREFIX))throw new ControlInputError('File is already in Trash.');const target=newTrashKey(key,deps.id());await copy(target);await removeSource();return {success:true,key:target};}
 if(body.action==='restore'){const original=originalTrashKey(key);if(!original)throw new ControlInputError('This is not a restorable Trash file.');await copy(original);await removeSource();return {success:true,key:original};}
 if(body.action==='delete'){if(!key.startsWith(TRASH_PREFIX)||body.confirm!=='DELETE')throw new ControlInputError('Move the file to Trash first, then confirm permanent deletion.');await deps.referencesAvailable();const original=originalTrashKey(key);if(original)await deps.rewrite(original,null);await removeSource();return {success:true,originalKey:original};}
 if(body.action==='rename'||body.action==='copy'){if(key.startsWith(TRASH_PREFIX))throw new ControlInputError('Restore the file before renaming or copying it.');const target=cloudKey(body.target);if(key.endsWith('.atlasbackup')!==target.endsWith('.atlasbackup'))throw new ControlInputError('Encrypted backup file extensions must remain unchanged.');if(target.startsWith(TRASH_PREFIX)||target===key)throw new ControlInputError('Choose another file path.');await deps.referencesAvailable();await copy(target);if(body.action==='rename'){try{await deps.rewrite(key,target);}catch(error){await files.delete(target).catch(()=>{});throw error;}await removeSource();}return {success:true,key:target};}
 throw new ControlInputError('Unknown storage action.');
}
