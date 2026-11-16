import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {peoplePhotos} from '../../src/data/demo/people';
test('curated people fixtures use distinct local assets and explicit sample provenance',()=>{
 assert.equal(peoplePhotos.length,8);
 assert.equal(new Set(peoplePhotos.map(photo=>photo.id)).size,8);
 assert.equal(new Set(peoplePhotos.map(photo=>photo.src)).size,8);
 for(const photo of peoplePhotos) {
  assert.ok(photo.sample);
  assert.ok(photo.alt.length>20);
  assert.ok(existsSync(`public${photo.src}`));
 }
});
