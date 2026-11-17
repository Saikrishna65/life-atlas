import {test} from 'node:test';import assert from 'node:assert/strict';import 'fake-indexeddb/auto';
import {savePastTrip,saveSectionDraft,readSectionDrafts,clearSectionDraft} from '../../src/lib/studio/store';
import {getTrip,saveTrip,deleteVaultDB} from '../../src/lib/vault/storage';
import {websitePayload} from '../../src/lib/vault/website-payload';
import {getEntries} from '../../mobile/studio-storage';
test('a past trip can be saved and prepared for publishing with no invented dates, itinerary, route or budget claims',async()=>{
 await deleteVaultDB();const trip=await savePastTrip({title:'Before I kept a journal',destination:'',startDate:'',endDate:''});assert.equal(trip.status,'ARCHIVED');assert.equal(trip.startDate,'');assert.equal(trip.studioOrigin,'past-trip');
 const payload=websitePayload(trip,[],[],{memoryIds:[]});assert.equal(payload.startDate,undefined);assert.equal(payload.routeData,undefined);assert.deepEqual(payload.itineraryDays,[]);
 const edited=await savePastTrip({title:'My first journey',destination:'Coorg',startDate:'',endDate:''},trip.id);assert.equal(edited.id,trip.id);assert.equal((await getTrip(trip.id))?.title,'My first journey');
 await saveTrip({...trip,id:'existing-vault',studioOrigin:undefined,notes:'Keep these private',liveExpedition:{tripId:'existing-vault',status:'COMPLETED',totalDistanceKm:123,movingSeconds:0,totalDurationSeconds:100,elevationGainMeters:20,legs:[]}});
 await assert.rejects(savePastTrip({title:'Rewrite',destination:'',startDate:'',endDate:''},'existing-vault'));assert.equal((await getTrip('existing-vault'))?.liveExpedition?.totalDistanceKm,123);
 await saveTrip({...trip,id:'active-studio',status:'ACTIVE'});await assert.rejects(savePastTrip({title:'Unsafe date edit',destination:'',startDate:'',endDate:''},'active-studio'));assert.equal((await getTrip('active-studio'))?.status,'ACTIVE');
});
test('manual section drafts survive reload and do not enter the older automatic Studio publishing queue',async()=>{
 await saveSectionDraft({key:'people',revision:7,content:{mode:'curated',items:[{id:'a',kind:'photo',src:'https://media.example/a.jpg',title:'A person'}]}});
 assert.equal((await readSectionDrafts()).find(item=>item.key==='people')?.revision,7);
 assert.equal((await getEntries()).some(entry=>entry.id==='website-section-people'),false);
 await clearSectionDraft('people');assert.equal((await readSectionDrafts()).length,0);
});
