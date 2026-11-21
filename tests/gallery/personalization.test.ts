import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicAssetRegistry} from '../../src/lib/r2/media-registry';
import {mediaForTrip} from '../../src/lib/r2/public-media';
import type {PublishedMedia} from '../../src/lib/r2/types';
const item:PublishedMedia={id:'public-one',assetId:'public-one',key:'galleries/originals/a.jpg',url:'https://media.example/galleries/originals/a.jpg',title:'A public photo',description:'',category:'expedition',collection:'trip-a',tags:[],mimeType:'image/jpeg',size:100,publishedAt:'2026-11-21',metadataPolicy:'removed'};
test('one public object can have multiple placements without duplicating stored media',()=>{
 const records=[item,{...item,id:'second-publication',collection:'trip-b'}];
 const registry=publicAssetRegistry(records);
 assert.equal(registry.length,1);assert.equal(registry[0].placements.length,2);
 const shared={...item,placements:registry[0].placements};
 assert.equal(mediaForTrip([shared],'trip-a','A').length,1);
 assert.equal(mediaForTrip([shared],'trip-b','B').length,1);
 assert.equal(mediaForTrip([shared],'other','Other').length,0);
});
test('private keys and conflicting public identities cannot be treated as reusable web assets',()=>{
 assert.throws(()=>publicAssetRegistry([{...item,key:'encrypted/photos/private.atlas'}]));
 assert.throws(()=>publicAssetRegistry([item,{...item,size:200}]));
 const registry=publicAssetRegistry([{...item,privateFaces:['Someone']} as PublishedMedia]);
 assert.equal('privateFaces' in registry[0],false);
});

test('a shared public photo retains each trip’s approved place metadata',()=>{
 const shared={...item,placements:[{category:'expedition' as const,collection:'trip-a',placeId:'place-a',placeName:'Tungnath'},{category:'expedition' as const,collection:'trip-b',placeId:'place-b',placeName:'Chopta'}]};
 assert.ok(mediaForTrip([shared],'trip-a','A')[0].tags.includes('place:Tungnath'));
 assert.ok(mediaForTrip([shared],'trip-b','B')[0].tags.includes('place:Chopta'));
 assert.equal(publicAssetRegistry([shared])[0].placements.length,2);
});
