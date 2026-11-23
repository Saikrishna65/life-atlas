import type {Transfer} from './types';

/** Leaving the publishing queue does not cancel or delete a native transfer. */
export class PublicationPaused extends Error {
 constructor(){super('Publishing saved for later.');this.name='PublicationPaused';}
}
export function publicationSessionUnavailable(error:unknown){
 const object=error&&typeof error==='object'?error:null;
 const code=object&&'code' in object?object.code:object&&'message' in object?object.message:error;
 return code==='PUBLICATION_SESSION_REQUIRED'||code==='PUBLICATION_SESSION_EXPIRED';
}
export interface TripTransferControls {
 transfers:()=>Promise<Transfer[]>;
 resume:(id:string)=>Promise<void>;
 recover?:()=>Promise<unknown>;
 paused:()=>boolean;
 offline:()=>boolean;
 progress:(message:string,job:Transfer)=>void;
 delay?:()=>Promise<void>;
}
export async function waitForTripTransfer(id:string, controls:TripTransferControls):Promise<Transfer>{
 let resumed=false,recovered=false;
 for(;;){
  if(controls.paused())throw new PublicationPaused();
  const transfers=await controls.transfers();
  const current=transfers.find(job=>job.id===id);
  if(!current)throw Error('This saved upload is unavailable. Check Cloud Storage; your selected originals are still saved.');
  const verifying=current.status==='verifying';
  controls.progress(current.reused?'Already in cloud · reusing the verified original…':current.duplicateCheck?'Checking existing cloud copy…':verifying?'Verifying original file…':current.status==='preparing'?'Preparing original file…':'Uploading original file…',current);
  if(current.status==='complete'){
   if(!current.verified)throw Error('This upload did not pass integrity verification.');
   return current;
  }
  if(['cancelled','cancelling'].includes(current.status))throw Error('This upload was cancelled in Cloud Storage. Your selected original remains saved; check the transfer before retrying.');
  if(controls.offline())throw new PublicationPaused();
  if(current.retryScheduled||current.workerState==='BLOCKED'||current.workerState==='ENQUEUED'||current.workerState==='RUNNING'){
   await (controls.delay?.()??new Promise(resolve=>setTimeout(resolve,1000)));continue;
  }
  if(current.canRecover){
   if(!recovered&&controls.recover){await controls.recover();recovered=true;await (controls.delay?.()??new Promise(resolve=>setTimeout(resolve,1000)));continue;}
   throw Error('Android has no active job for this upload. Open Cloud Storage → Transfers → Resume approved uploads. Your selections and completed files are saved.');
  }
  if(['paused','interrupted','failed'].includes(current.status)){
   if(resumed)throw Error('This upload could not resume. Check its details in Cloud Storage; completed uploads and selected originals are saved.');
   await controls.resume(id);resumed=true;
  }
  await (controls.delay?.()??new Promise(resolve=>setTimeout(resolve,1000)));
 }
}
