import {R2,bytes} from '../r2/native';
import type {SelectedMedia} from '../r2/types';
import type {SceneItem,SectionKey} from './sections';
/** Existing native queue owns original bytes, signing, retries and transfer integrity. */
export async function publishSectionFile(file:SelectedMedia,key:SectionKey,input:{transferId?:string;remember:(id:string)=>Promise<void>;progress:(message:string)=>void;cancelled:()=>boolean}):Promise<SceneItem>{
 let id=input.transferId;if(!id){const transfer=await R2.uploadObject({slot:'public',selectionId:file.id});id=transfer.id;await input.remember(id);}
 for(;;){
  if(input.cancelled()||navigator.onLine===false)throw Error('The upload remains in Cloud Storage. Your section draft and current website are unchanged. Finish the transfer there, then retry.');
  const {transfers}=await R2.getTransferProgress();const transfer=transfers.find(item=>item.id===id);if(!transfer)throw Error('This queued upload is no longer available. Choose the original again.');
  input.progress(`${file.name} · ${bytes(transfer.uploadedBytes)} / ${bytes(transfer.totalBytes)}`);
  if(transfer.status==='complete'){if(!transfer.verified)throw Error('Upload integrity has not been verified.');break;}
  if(['failed','paused','interrupted','cancelled'].includes(transfer.status))throw Error('Finish or resume this transfer in Cloud Storage, then retry publishing.');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 const result=await R2.publishMedia({transferId:id,title:file.name.slice(0,140),description:'',tags:[],category:'gallery',collection:`homepage-${key}`,acknowledgeMetadata:true});
 const item=result.catalog.items.find(item=>item.id===id);if(!item)throw Error('The public catalog did not confirm this uploaded file. Retry without removing its original.');
 return {id:`r2-${item.id}`,kind:item.mimeType.startsWith('video/')?'video':'photo',src:item.url,poster:item.thumbnailUrl,title:item.title,alt:'A moment from my collection'};
}
