import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudApprovalGate, CLOUD_ENDPOINT} from '../../src/lib/atlas-ai/cloud-approval';

const model = 'example/model:free';
const signal = () => new AbortController().signal;
const ok = () => new Response(JSON.stringify({choices:[{message:{content:'Test response'}}]}),{status:200});
test('requires one specific free model', () => {
  const gate = new CloudApprovalGate();
  for (const id of ['openrouter/auto','example/model','example/model:free,other/model','https://example/model:free']) assert.throws(()=>gate.preview(id,'hello'));
});
test('preview contains only the explicit question, fixed system and zero price cap', () => {
  const gate = new CloudApprovalGate();
  const p = gate.preview(model,'hello');
  const body = JSON.parse(p.body);
  assert.equal(p.endpoint,CLOUD_ENDPOINT);
  assert.equal(body.messages.length,2);
  assert.deepEqual(body.messages[1],{role:'user',content:'hello'});
  assert.deepEqual(body.provider.max_price,{prompt:0,completion:0});
  assert.equal(body.provider.allow_fallbacks,false);
  assert.equal(body.provider.zdr,true);
  assert.equal(body.models,undefined);
  assert.equal(body.tools,undefined);
});
test('execute sends exactly the preview once and rejects replay',async()=>{
  const gate = new CloudApprovalGate(); const p = gate.preview(model,'hello'); let calls=0;
  const transport: typeof fetch = async (url,init) => {calls++;assert.equal(url,p.endpoint);assert.equal(init?.body,p.body);assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-key');return ok();};
  assert.equal(await gate.execute(p.id,'test-key',signal(),transport),'Test response');
  await assert.rejects(gate.execute(p.id,'test-key',signal(),transport));
  assert.equal(calls,1);
});
test('no network before approval, after cancellation, expiry or replacement',async()=>{
  let now=100;const gate=new CloudApprovalGate(()=>now);let calls=0;
  const transport: typeof fetch=async()=>{calls++;return ok();};
  await assert.rejects(gate.execute('unapproved','key',signal(),transport));
  const a=gate.preview(model,'first');gate.cancel();await assert.rejects(gate.execute(a.id,'key',signal(),transport));
  const b=gate.preview(model,'second');now+=60000;await assert.rejects(gate.execute(b.id,'key',signal(),transport));
  const c=gate.preview(model,'third');gate.preview(model,'fourth');await assert.rejects(gate.execute(c.id,'key',signal(),transport));
  assert.equal(calls,0);
});
test('aborted and failed requests do not retry',async()=>{
  const gate=new CloudApprovalGate();let calls=0;const transport:typeof fetch=async()=>{calls++;return new Response('',{status:429});};
  const a=gate.preview(model,'hello');const ctrl=new AbortController();ctrl.abort();await assert.rejects(gate.execute(a.id,'key',ctrl.signal,transport));assert.equal(calls,0);
  const b=gate.preview(model,'hello');await assert.rejects(gate.execute(b.id,'key',signal(),transport),/429/);
  await assert.rejects(gate.execute(b.id,'key',signal(),transport));assert.equal(calls,1);
});
test('invalid preview clears prior authorization',async()=>{
  const gate=new CloudApprovalGate();const a=gate.preview(model,'hello');
  assert.throws(()=>gate.preview('paid/model','hello'));
  await assert.rejects(gate.execute(a.id,'key',signal(),async()=>{throw new Error('unexpected transport');}),/fresh request/);
});
