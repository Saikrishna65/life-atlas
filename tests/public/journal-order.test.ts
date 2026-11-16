import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixJournalMedia } from '../../src/lib/public-trips/journal-order';
test('films are spread through photographs, keeping all media and relative order', () => {
  const photos=Array.from({length:9},(_,id)=>({id:`p${id}`,kind:'photo' as const}));
  const films=Array.from({length:3},(_,id)=>({id:`v${id}`,kind:'video' as const}));
  const result=mixJournalMedia([...photos,...films]);
  assert.deepEqual(result.filter(item=>item.kind==='photo'),photos);
  assert.deepEqual(result.filter(item=>item.kind==='video'),films);
  assert.deepEqual(result.flatMap((item,i)=>item.kind==='video'?[i]:[]),[1,5,9]);
  assert.deepEqual(mixJournalMedia([...photos,...films]),result);
  assert.deepEqual(mixJournalMedia(photos),photos);
  assert.deepEqual(mixJournalMedia([]),[]);
});

test('a single film sits inside the gallery rather than at the end', () => {
 const result=mixJournalMedia([...Array.from({length:12},(_,id)=>({id,kind:'photo' as const})),{id:12,kind:'video' as const}]);
 assert.equal(result.findIndex(item=>item.kind==='video'),6);
});
