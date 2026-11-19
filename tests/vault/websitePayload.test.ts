import {test} from 'node:test';import assert from 'node:assert/strict';
import {websitePayload,websiteSlug} from '../../src/lib/vault/website-payload';
import type {TripRecord,TripMemoryRecord} from '../../src/lib/vault/types';
const trip:TripRecord={id:'trip-123',title:'My trip',destination:'Kyoto',startDate:'2026-11-01',status:'COMPLETED',travelStyle:'LEISURE',budgetTotal:50000,currency:'INR',notes:'Private financial and personal notes',createdAt:'2026-11-01',updatedAt:'2026-11-01'};
const memories:TripMemoryRecord[]=[{id:'photo-a',tripId:trip.id,title:'Private photo note',caption:'Do not share this caption',date:'2026-11-01',createdAt:'2026-11-01',isHighlight:false,images:['https://example.com/photo.jpg']},{id:'private-b',tripId:trip.id,title:'Private',date:'2026-11-01',createdAt:'2026-11-01',isHighlight:false,images:['https://example.com/private.jpg']}];
test('empty selection never defaults to exporting every private memory or trip notes',()=>{
 const body=websitePayload(trip,memories,[],{memoryIds:[]});assert.deepEqual(body.memories,[]);assert.equal(body.description,undefined);assert.equal(body.coverImage,undefined);
 assert.ok(!JSON.stringify(body).includes('Private financial'));assert.ok(!JSON.stringify(body).includes('private.jpg'));assert.equal(body.preserveExistingRoute,true);assert.equal(body.preserveExistingMedia,true);assert.equal(body.routeData,undefined);
});
test('only chosen media and an explicitly authored public description are included',()=>{
 const body=websitePayload(trip,memories,[],{memoryIds:['photo-a'],description:'The public version.'});assert.equal(body.memories.length,1);assert.equal(body.coverImage,'https://example.com/photo.jpg');assert.equal(body.description,'The public version.');assert.equal(body.preserveExistingMedia,false);assert.equal(body.itineraryDays.length,0);assert.ok(!JSON.stringify(body).includes('50000'));assert.ok(!JSON.stringify(body).includes('Private photo note'));assert.ok(!JSON.stringify(body).includes('Do not share this caption'));
});
test('stable local ids prevent same-title journals from overwriting each other and retain published slugs',()=>{
 assert.notEqual(websiteSlug(trip),websiteSlug({...trip,id:'other-456'}));assert.equal(websiteSlug({...trip,publishedSlug:'existing-journal'}),'existing-journal');
});

test('approved immutable publication URLs reach the website without local transfer state',()=>{
 const body=websitePayload(trip,[],[],{memoryIds:[],publicMedia:[{id:'public-photo',key:'galleries/photo.jpg',url:'https://media.example/photo.jpg',manifestUrl:'https://media.example/atlas/catalog/publications/photo/revision.json',title:'Public photo',description:'',category:'expedition',collection:'journey',mimeType:'image/jpeg',size:100,tags:['place:Deoria Tal'],publishedAt:'2026-11-18',metadataPolicy:'retained'}]});
 assert.equal(body.publicMedia[0].manifestUrl,'https://media.example/atlas/catalog/publications/photo/revision.json');
 assert.equal(body.publicMedia[0].place,'Deoria Tal');
 assert.ok(!JSON.stringify(body).includes('transferIds'));
});

test('place privacy settings and individual pins remain separate from the globe trip location',()=>{
 const grouped={...trip,websiteLocation:{latitude:30,longitude:78},websitePlaces:[{id:'temple',name:'Tungnath',mapLocation:{latitude:30.49,longitude:79.22},mapPrecision:'approximate' as const,files:[],transferIds:{},publishedMedia:[]},{id:'stay',name:'My stay',mapPrecision:'hidden' as const,files:[],transferIds:{},publishedMedia:[]}]};
 const body=websitePayload(grouped,[],[],{memoryIds:[]});assert.deepEqual(body.globeLocation,{latitude:30,longitude:78});const temple=body.places.find(p=>p.id==='temple')!;assert.equal(temple.latitude,30.49);assert.equal(temple.locationVisibility,'approximate');const stay=body.places.find(p=>p.id==='stay')!;assert.equal(stay.locationVisibility,'hidden');assert.equal(stay.latitude,undefined);assert.equal(body.routeData,undefined);assert.equal(body.preserveExistingRoute,true);
});
