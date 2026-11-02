import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleFields,tripScheduleInput,tripScheduleLabel} from '../../src/lib/vault/tripSchedule';
import {saveTripSchedule} from '../../src/lib/vault/saveTripSchedule';
import {saveTrip,getTrip,getAllTrips,getItinerariesForTrip} from '../../src/lib/vault/storage';
import {importPlanIntoVaultItinerary} from '../../src/lib/vault/aiItinerary';
import {defaultTripSettings,needsTripConfirmation} from '../../src/lib/finance/trips/policy';
import {getTripDayCount,computeTripDuration} from '../../src/lib/vault/tripDuration';
import type {TripRecord,AIPendingPlan} from '../../src/lib/vault/types';
const input={start:'',end:'',departureTime:'06:45',returnTime:'22:10',timeZone:'Asia/Kolkata'};
test('an undated idea and its day plan stay undated until the chosen travel dates and exact times are saved',async()=>{
 const now=new Date().toISOString(),idea=await saveTrip({id:'future-idea',title:'Someday in Japan',destination:'Japan',...scheduleFields(input),status:'DRAFT',travelStyle:'LEISURE',budgetTotal:0,currency:'INR',notes:'Go there when the time is right.',createdAt:now,updatedAt:now} as TripRecord);
 assert.equal(idea.startDate,'');assert.equal(idea.endDate,undefined);assert.equal(defaultTripSettings(idea),null);assert.equal(needsTripConfirmation(idea),false);assert.equal(tripScheduleLabel(idea),'Dates not set');assert.equal(getTripDayCount('').calendarDays,0);assert.equal(computeTripDuration('').effectiveDays,0);assert.ok((await getAllTrips()).find(t=>t.id===idea.id));
 const plan:AIPendingPlan={destination:'Japan',durationDays:2,travelStyle:'LEISURE',budgetEstimate:0,generatedDays:[{dayNumber:1,title:'Explore Kyoto',highlights:['Old town']},{dayNumber:2,title:'A quiet day',highlights:['Garden walk']}],suggestedGear:[],localAdvisories:[]};
 await importPlanIntoVaultItinerary(idea.id,plan);const undated=await getItinerariesForTrip(idea.id);assert.deepEqual(undated.map(d=>d.date),['','']);assert.deepEqual(undated.map(d=>d.dayIndex),[1,2]);
 const timing=scheduleFields({...input,start:'2027-03-14',end:'2027-03-16'});assert.equal(timing.finance!.startAt,'2027-03-14T01:15:00.000Z');assert.equal(timing.finance!.endAt,'2027-03-16T16:40:00.000Z');
 const saved=await saveTripSchedule({...idea,...timing,status:'PLANNING'},idea.updatedAt);assert.equal(saved.notes,idea.notes);assert.equal(tripScheduleInput(saved).departureTime,'06:45');assert.equal(tripScheduleInput(saved).returnTime,'22:10');assert.deepEqual((await getItinerariesForTrip(idea.id)).map(d=>d.date),['2027-03-14','2027-03-15']);assert.deepEqual((await getItinerariesForTrip(idea.id)).map(d=>d.activities),undated.map(d=>d.activities));
 const fallback=defaultTripSettings({...saved,finance:undefined});assert.equal(fallback!.startAt,timing.finance!.startAt);assert.equal(fallback!.endAt,timing.finance!.endAt);
 await assert.rejects(()=>saveTripSchedule({...saved,title:'Stale overwrite'},'2000-01-01T00:00:00Z'),/changed while editing/);assert.equal((await getTrip(idea.id))!.title,'Someday in Japan');
});
test('unknown return dates have no automatic grouping window; invalid dates and reversed times are rejected',()=>{
 const partial=scheduleFields({...input,start:'2027-03-14'});assert.equal(partial.endDate,undefined);assert.equal(partial.finance,undefined);assert.equal(partial.departureTime,'06:45');
 assert.throws(()=>scheduleFields({...input,end:'2027-03-14'}),/departure date/);
 assert.throws(()=>scheduleFields({...input,start:'2027-03-14',end:'2027-03-14',departureTime:'20:00',returnTime:'08:00'}),/end after/);
 assert.throws(()=>scheduleFields({...input,start:'2027-02-30'}),/valid travel date/);
});
