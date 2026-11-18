import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSandboxGateway} from '@/lib/atlas-ai/sandbox';
test('gateway enforces permission, session, expiry, cancellation and single-use confirmation',()=>{
 let time=0;const g=createSandboxGateway(()=>time),permissions=new Set(['music'] as const);
 assert.throws(()=>g.request('session',{module:'finance',kind:'summary'},permissions),/permission/);
 assert.match(g.request('session',{module:'music',kind:'summary'},permissions).text,/Demo/);
 const action=g.request('session',{module:'music',kind:'change'},permissions);
 assert.throws(()=>g.confirm('other',action.token!,permissions),/invalid/);
 assert.throws(()=>g.confirm('session',action.token!,new Set()),/invalid/);
 assert.match(g.confirm('session',action.token!,permissions),/Simulated/);
 assert.throws(()=>g.confirm('session',action.token!,permissions),/invalid/);
 const expired=g.request('session',{module:'music',kind:'change'},permissions);time=60001;
 assert.throws(()=>g.confirm('session',expired.token!,permissions),/invalid/);
 const cancelled=g.request('session',{module:'music',kind:'change'},permissions);g.cancel(cancelled.token!);
 assert.throws(()=>g.confirm('session',cancelled.token!,permissions),/invalid/);
});
