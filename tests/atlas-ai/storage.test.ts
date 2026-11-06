import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AtlasStore} from '@/lib/atlas-ai/storage';
const password = 'synthetic offline recovery phrase';
test('encrypted conversations and memories survive reopen, paginate, merge safely, and reject tampering and stale writes', async () => {
  const store = new AtlasStore();
  await store.unlock(password);
  const id = await store.create('Private synthetic title');
  await Promise.all(Array.from({length: 34}, (_,i) => store.append(id, {role: 'user', text: `Synthetic message ${i}`})));
  await store.rename(id, 'Renamed synthetic conversation');
  const memory = await store.saveMemory('Synthetic preference: tea');
  assert.equal(store.history(id).messages.length, 30);
  assert.equal(store.history(id).hasMore, true);
  assert.equal(store.history(id, 30).messages.length, 4);
  assert.equal(store.sessions('message 32').length, 1);
  const archive = await store.exportArchive();
  assert.ok(!(await archive.text()).includes('Synthetic'));
  assert.ok(!(await archive.text()).includes('Renamed'));
  store.lock();
  assert.throws(() => store.snapshot(), /Unlock/);
  await assert.rejects(() => store.unlock('wrong synthetic phrase'), /unlock/);
  await store.unlock(password);
  assert.equal(store.history(id).messages.length, 30);
  await store.saveMemory('Updated preference', memory);
  assert.equal(store.memories('Updated').length, 1);
  await store.deleteMemory(memory);
  assert.equal(store.memories().length, 0);
  await store.importArchive(archive, password);
  assert.equal(store.sessions().length, 2);
  assert.equal(store.memories().length, 1); // Explicit import restores an older exported memory.
  const stale = new AtlasStore(); await stale.unlock(password);
  await store.create('First window update');
  await assert.rejects(() => stale.create('Stale overwrite'), /another window/);
  const bad = JSON.parse(await archive.text()); bad.ciphertext = 'AAAA' + bad.ciphertext.slice(4);
  await assert.rejects(() => store.importArchive(new Blob([JSON.stringify(bad)]), password), /unlock/);
  assert.equal(store.sessions().length, 3);
  await store.deleteConversation(id);
  assert.equal(store.sessions().length, 2);
  const beforeAbort = store.memories().length;
  const originalTransaction = IDBDatabase.prototype.transaction;
  Object.defineProperty(IDBDatabase.prototype,'transaction',{configurable:true,value:function(this:IDBDatabase,...args:Parameters<IDBDatabase['transaction']>){
    const transaction = originalTransaction.apply(this,args);
    if (args[1] === 'readwrite') queueMicrotask(() => transaction.abort());
    return transaction;
  }});
  try { await assert.rejects(() => store.saveMemory('Interrupted synthetic write'),/interrupted/); }
  finally { Object.defineProperty(IDBDatabase.prototype,'transaction',{configurable:true,value:originalTransaction}); }
  assert.equal(store.memories().length,beforeAbort);
  const reopened = new AtlasStore(); await reopened.unlock(password); assert.equal(reopened.memories().length,beforeAbort); reopened.lock();
  const pending = store.saveMemory('Must not save after lock'); store.lock();
  await assert.rejects(() => pending, /locked/);
});
