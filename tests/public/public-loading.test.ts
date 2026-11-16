import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPublicPath,isPageNavigation,beginPublicTask} from '../../src/lib/public-loading/readiness';
test('public loading excludes native/private, admin and non-page routes',()=>{
 for(const path of ['/','/trips','/trips/himalayan-journey','/photography','/missing'])assert.equal(isPublicPath(path),true,path);
 for(const path of [null,'/secret','/secret/vault','/admin','/admin/trips','/api/media','/_next/image'])assert.equal(isPublicPath(path),false,String(path));
});
test('navigation loader ignores hashes, same-page filters and external links',()=>{
 const current='https://atlas.example/trips';
 assert.equal(isPageNavigation('/trips/chopta',current),true);
 for(const href of ['#route','/trips?sort=date','https://elsewhere.example/','mailto:hello@example.com','/secret/vault','javascript:void(0)'])assert.equal(isPageNavigation(href,current),false,href);
});
test('readiness tasks are safe in server rendering',()=>{assert.doesNotThrow(()=>beginPublicTask('SSR')());});

test('public catalog consumers share one request, and failures can be retried',async()=>{
 const {cachedPublicCatalog}=await import('../../src/components/world/public-catalog-cache');
 const original=globalThis.fetch;let requests=0;
 const catalog={format:'life-atlas-public-media',version:1,revision:'test',updatedAt:'2026-11-16T00:00:00.000Z',items:[]};
 try{
  globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify(catalog),{headers:{'content-type':'application/json'}});};
  const url='https://example.com/atlas/catalog/current.json';
  const [first,second]=await Promise.all([cachedPublicCatalog(url),cachedPublicCatalog(url)]);
  assert.equal(requests,1);assert.deepEqual(first,second);
  await cachedPublicCatalog(url);assert.equal(requests,1);
  const retry='https://retry.example.com/atlas/catalog/current.json';
  globalThis.fetch=async()=>{requests++;throw new Error('offline');};
  await assert.rejects(cachedPublicCatalog(retry));
  globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify(catalog),{headers:{'content-type':'application/json'}});};
  assert.equal((await cachedPublicCatalog(retry)).revision,'test');assert.equal(requests,3);
 }finally{globalThis.fetch=original;}
});
