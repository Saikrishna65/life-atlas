import {test} from 'node:test';import assert from 'node:assert/strict';
import {transferScheduleText,sortTransfers} from '../../src/lib/r2/transfer-status';
import type {Transfer} from '../../src/lib/r2/types';
const job=(values:Partial<Transfer>={}):Transfer=>({id:'file',slot:'public',key:'galleries/file',name:'original.mp4',mimeType:'video/mp4',status:'queued',createdAt:0,direction:'upload',...values});
test('missing jobs, blocked serial work, retries and Android quotas have distinct actionable statuses',()=>{
 assert.match(transferScheduleText(job({canRecover:true,workerState:'MISSING'})),/Resume approved/);
 assert.match(transferScheduleText(job({workerState:'BLOCKED'})),/preceding transfer/);
 assert.match(transferScheduleText(job({retryScheduled:true})),/automatic retry/);
 assert.match(transferScheduleText(job({androidWait:'QUOTA'})),/quota/);
 assert.match(transferScheduleText(job({status:'verifying',workerState:'RUNNING'})),/Checking uploaded bytes/);
 assert.equal(transferScheduleText(job({status:'complete',canRecover:true})), '');
});
test('the running file appears before later queued files so an idle row does not look like a stalled batch',()=>{
 const jobs=[job({id:'later',createdAt:2}),job({id:'running',workerState:'RUNNING',status:'uploading',createdAt:1}),job({id:'done',status:'complete'})];
 assert.deepEqual(sortTransfers(jobs).map(item=>item.id),['running','later','done']);assert.equal(jobs[0].id,'later');
});
