import type {Transfer} from './types';
export function transferScheduleText(job:Transfer){
 if(job.reused&&job.status==='complete')return 'Already in cloud. Existing verified file reused; no duplicate uploaded.';
 if(job.duplicateCheck&&job.status==='verifying')return 'Checking an existing cloud copy…';
 if(['complete','cancelled','cancelling','paused'].includes(job.status))return '';
 if(job.canRecover)return 'No active Android job. Resume approved uploads to restore this transfer.';
 if(job.androidWait==='QUOTA')return 'Android upload quota reached. Waiting for Android to allow work again.';
 if(job.androidWait==='BACKGROUND')return 'Android is restricting background work. Open Atlas Next to continue.';
 if(job.androidWait==='NETWORK')return 'Android is waiting for a network connection.';
 if(job.retryScheduled)return 'Android scheduled an automatic retry. Your saved upload will be reused.';
 if(job.workerState==='BLOCKED')return 'Waiting for the preceding transfer to finish or retry.';
 if(job.workerState==='ENQUEUED')return 'Queued with Android. Waiting for network or scheduling.';
 if(job.status==='verifying')return 'Checking uploaded bytes against the original…';
 return '';
}
export function sortTransfers(jobs:Transfer[]){
 const rank=(job:Transfer)=>job.workerState==='RUNNING'?0:job.canRecover?1:job.retryScheduled?2:job.status==='queued'?3:job.status==='complete'?5:4;
 return [...jobs].sort((a,b)=>rank(a)-rank(b)||a.createdAt-b.createdAt);
}
