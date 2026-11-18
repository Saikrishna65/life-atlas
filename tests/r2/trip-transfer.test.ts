import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waitForTripTransfer,PublicationPaused,publicationSessionUnavailable,type TripTransferControls} from '../../src/lib/r2/trip-transfer';
import type {Transfer} from '../../src/lib/r2/types';
const job=(status:Transfer['status'],verified=false):Transfer=>({id:'saved-video',slot:'public',key:'galleries/video.mp4',name:'original.mp4',mimeType:'video/mp4',status,verified,totalBytes:110,uploadedBytes:110,direction:'upload',createdAt:0});
const controls=(overrides:Partial<TripTransferControls>={}):TripTransferControls=>({transfers:async()=>[job('complete',true)],resume:async()=>{throw Error('must not restart completed uploads');},paused:()=>false,offline:()=>false,progress:()=>{},delay:async()=>{},...overrides});
test('finish later is a recoverable pause and does not start, resume, cancel or delete any transfer',async()=>{
 await assert.rejects(waitForTripTransfer('saved-video',controls({paused:()=>true,transfers:async()=>{throw Error('must not touch transfer');}})),PublicationPaused);
});
test('a 100-percent byte count still waits for native integrity verification',async()=>{
 let reads=0;const phases:string[]=[];
 const done=await waitForTripTransfer('saved-video',controls({transfers:async()=>[reads++===0?job('verifying'):job('complete',true)],progress:phase=>phases.push(phase)}));
 assert.equal(done.verified,true);assert.equal(reads,2);assert.equal(phases[0],'Verifying original file…');
});
test('resuming publishing reuses the same paused upload ID exactly once',async()=>{
 let reads=0;const resumed:string[]=[];
 const done=await waitForTripTransfer('saved-video',controls({transfers:async()=>[reads++===0?job('paused'):job('complete',true)],resume:async id=>{resumed.push(id);}}));
 assert.deepEqual(resumed,['saved-video']);assert.equal(done.id,'saved-video');
});
test('repeated transfer failures stop with recovery guidance instead of looping retries',async()=>{
 let attempts=0;await assert.rejects(waitForTripTransfer('saved-video',controls({transfers:async()=>[job('failed')],resume:async()=>{attempts++;}})),/could not resume/);assert.equal(attempts,1);
});
test('verified completed files can be reused offline; incomplete offline uploads remain saved',async()=>{
 assert.equal((await waitForTripTransfer('saved-video',controls({offline:()=>true}))).id,'saved-video');
 await assert.rejects(waitForTripTransfer('saved-video',controls({offline:()=>true,transfers:async()=>[job('uploading')]})),PublicationPaused);
 await assert.rejects(waitForTripTransfer('saved-video',controls({transfers:async()=>[job('complete',false)]})),/integrity/);
});

test('only a missing or replaced native session produces the session recovery notice',()=>{
 for(const error of [{code:'PUBLICATION_SESSION_REQUIRED'},{code:'PUBLICATION_SESSION_EXPIRED'},new Error('PUBLICATION_SESSION_EXPIRED'),'PUBLICATION_SESSION_EXPIRED'])assert.equal(publicationSessionUnavailable(error),true);
 for(const error of [null,{code:'PERMISSION_DENIED'},new Error('SDK failure: PUBLICATION_SESSION_EXPIRED'),{code:'PUBLICATION_SCOPE_MISMATCH',message:'PUBLICATION_SESSION_EXPIRED'}])assert.equal(publicationSessionUnavailable(error),false);
});

test('background transfers are polled and verified without waiting for a foreground signal',async()=>{
 let reads=0;
 const complete=await waitForTripTransfer('saved-video',controls({transfers:async()=>[reads++===0?job('uploading'):job('complete',true)]}));
 assert.equal(reads,2);assert.equal(complete.verified,true);
});
