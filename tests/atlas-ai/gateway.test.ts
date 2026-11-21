import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ActionGateway, parseAction, type LocalAdapter, type Permission} from '@/lib/atlas-ai/gateway';
import {runtimeStatus, generateLocal, requireNativeTrust} from '@/lib/atlas-ai/native';
test('bounded action schemas reject arbitrary execution, extra fields, invalid values and destinations', () => {
  for (const value of [{kind:'shell',command:'noop'},{kind:'navigate',section:'https://example.com'},{kind:'finance.expense',accountId:'x',amountPaise:-1,description:'x'},{kind:'music.pause',url:'https://example.com'},{kind:'music.search',query:'x'.repeat(121)}]) assert.throws(() => parseAction(value));
});
test('permissions, trust, cancellation, immutable request binding and single-use expiry guard local writes', async () => {
  let writes = 0, reads = 0, time = 0, trusted = true, available = true;
  const permissions = new Set<Permission>();
  const adapter: LocalAdapter = {execute: async () => ++reads, prepare: async (action, guard) => ({description: JSON.stringify(action), commit: async () => {guard(); writes++; return action;}})};
  const gateway = new ActionGateway(adapter, () => permissions, async () => {if (!trusted) throw new Error('Trust denied');}, () => available, () => time);
  const action = {kind:'finance.expense',accountId:'synthetic',amountPaise:123,description:'Synthetic expense'};
  await assert.rejects(() => gateway.request('a',action), /Permission/);
  permissions.add('finance.write'); trusted = false;
  await assert.rejects(() => gateway.request('a',action), /Trust/);
  trusted = true;
  const {proposal} = await gateway.request('a',action);
  proposal!.action = {kind:'music.pause'};
  action.amountPaise = 999;
  await assert.rejects(() => gateway.confirm('b',proposal!.token), /does not match/);
  const receipt = await gateway.confirm('a',proposal!.token);
  assert.equal((receipt.result as {amountPaise:number}).amountPaise,123);
  assert.equal(writes,1);
  await assert.rejects(() => gateway.confirm('a',proposal!.token), /expired|match/);
  const expired = await gateway.request('a',action); time = 60001;
  await assert.rejects(() => gateway.confirm('a',expired.proposal!.token), /expired/);
  const revoked = await gateway.request('a',action); permissions.clear();
  await assert.rejects(() => gateway.confirm('a',revoked.proposal!.token), /Permission/);
  permissions.add('finance.write'); const canceled = await gateway.request('a',action); gateway.revoke();
  await assert.rejects(() => gateway.confirm('a',canceled.proposal!.token));
  available = false; await assert.rejects(() => gateway.request('a',action), /Unlock/);
  assert.equal(writes,1); assert.equal(reads,0);
});
test('revocation during authentication prevents access and concurrent confirmations cannot replay', async () => {
  let release: (()=>void) | undefined, writes = 0;
  const grants = new Set<Permission>(['finance.write']);
  const g = new ActionGateway({execute: async()=>null, prepare: async (_action,guard)=>({description:'Synthetic',commit:async()=>{guard(); writes++;}})},()=>grants,()=>new Promise<void>(resolve=>{release=resolve;}));
  const operation = g.request('a',{kind:'finance.expense',accountId:'a',amountPaise:1,description:'x'});
  g.revoke(); release!(); await assert.rejects(()=>operation,/canceled/);
  const next = g.request('a',{kind:'finance.expense',accountId:'a',amountPaise:1,description:'x'}); release!(); const {proposal} = await next;
  const first = g.confirm('a',proposal!.token), second = g.confirm('a',proposal!.token);
  await assert.rejects(()=>second); release!(); await first; assert.equal(writes,1);
});
test('missing local runtime and browser biometrics fail honestly without network inference', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {throw new Error('Unexpected network');};
  try {
    assert.equal((await runtimeStatus()).available,false);
    await assert.rejects(()=>generateLocal('Private synthetic prompt',new AbortController().signal,()=>{throw new Error('Unexpected token');}),/unavailable/);
    await assert.rejects(()=>requireNativeTrust(),/Android device authentication/);
  } finally {globalThis.fetch = original;}
});

test('late local read results are withheld after revocation', async () => {
  let release: (()=>void) | undefined;
  const g = new ActionGateway({execute: async()=>{await new Promise<void>(resolve=>{release=resolve;}); return 'private synthetic result';},prepare:async()=>{throw new Error('not a mutation');}},()=>new Set<Permission>(['finance.read']),async()=>{});
  const result=g.request('a',{kind:'finance.summary'});
  await new Promise(resolve=>setImmediate(resolve));
  g.revoke(); release!();
  await assert.rejects(()=>result,/canceled/);
});
