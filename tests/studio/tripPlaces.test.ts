import {test} from 'node:test';import assert from 'node:assert/strict';import 'fake-indexeddb/auto';
import {savePastTrip} from '../../src/lib/studio/store';
import {addTripPlace,addPlaceFiles,rememberPlaceTransfer,rememberPlacePublication} from '../../src/lib/studio/trip-places';
import {getTrip,patchTripFields} from '../../src/lib/vault/storage';
import {websitePayload} from '../../src/lib/vault/website-payload';
import {mergeTripPublication} from '../../src/lib/studio/publication';
import type {PublishedMedia,SelectedMedia} from '../../src/lib/r2/types';
const file=(id:string):SelectedMedia=>({id,name:`${id}.jpg`,mimeType:'image/jpeg',size:100,persistent:true});
const media:PublishedMedia={id:'public-a',key:'galleries/originals/a.bin',url:'https://media.example.com/a.bin',title:'My trip',description:'',tags:['place:Waterfall'],category:'expedition',collection:'trip',mimeType:'image/jpeg',size:100,publishedAt:'2026-11-18',metadataPolicy:'retained'};
test('trip-specific places and media survive reopen without sharing similarly named groups',async()=>{
 const a=await savePastTrip({title:'Trip A',destination:'Kyoto',startDate:'',endDate:'',mapLocation:{latitude:35.01,longitude:135.76}}),b=await savePastTrip({title:'Trip B',destination:'',startDate:'',endDate:''});
 const pa=(await addTripPlace(a.id,'Waterfall')).websitePlaces![0],pb=(await addTripPlace(b.id,'Waterfall')).websitePlaces![0];assert.notEqual(pa.id,pb.id);
 await addPlaceFiles(a.id,pa.id,[file('a')]);assert.equal((await getTrip(a.id))?.websitePlaces?.[0].files[0].id,'a');assert.equal((await getTrip(b.id))?.websitePlaces?.[0].files.length,0);
 await assert.rejects(addPlaceFiles(a.id,pa.id,Array.from({length:21},(_,i)=>file(String(i)))),/20/);assert.equal((await getTrip(a.id))?.websitePlaces?.[0].files.length,1);
 await assert.rejects(addTripPlace(a.id,' waterfall '),/already/);
 await rememberPlaceTransfer(a.id,pa.id,'a','transfer');assert.equal((await getTrip(a.id))?.websitePlaces?.[0].transferIds.a,'transfer');
 await patchTripFields(a.id,{publishedSlug:'my-existing-trip'});await rememberPlacePublication(a.id,pa.id,'a',media);const saved=(await getTrip(a.id))!;assert.equal(saved.publishedSlug,'my-existing-trip');assert.equal(saved.websitePlaces?.[0].files.length,0);assert.equal(saved.websitePlaces?.[0].publishedMedia[0].id,media.id);
 const body=websitePayload(saved,[],[],{memoryIds:[],publicMedia:[media],appendExistingMedia:true});assert.ok(body.places.some(p=>p.name==='Waterfall'));const pin=body.places.find(p=>p.id==='trip-location');assert.equal(pin?.latitude,35.01);assert.equal(body.routeData,undefined);assert.equal(body.publicMedia[0].place,'Waterfall');assert.equal(body.appendExistingMedia,true);
 await assert.rejects(savePastTrip({title:'Invalid map',destination:'',startDate:'',endDate:'',mapLocation:{latitude:200,longitude:0}}),/valid map/);
});
test('concurrent place additions preserve both groups instead of replacing each other',async()=>{
 const t=await savePastTrip({title:'Together',destination:'',startDate:'',endDate:''});await Promise.all([addTripPlace(t.id,'Lake'),addTripPlace(t.id,'Forest')]);assert.deepEqual((await getTrip(t.id))?.websitePlaces?.map(p=>p.name),['Lake','Forest']);
});
test('adding place media preserves the previous public gallery and updates existing metadata by ID',()=>{
 const old={id:'old',url:'https://media.example.com/old.jpg'},updated={...media,place:'Lake'};const merged=mergeTripPublication([old,media],[updated],true);assert.deepEqual(merged,[old,updated]);assert.deepEqual(mergeTripPublication([old],[media],false),[media]);assert.throws(()=>mergeTripPublication([],Array.from({length:251},(_,i)=>({id:String(i)})),true),/PUBLIC_MEDIA_LIMIT/);
});
