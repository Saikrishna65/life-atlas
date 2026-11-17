import {test} from 'node:test';import assert from 'node:assert/strict';import 'fake-indexeddb/auto';
import {saveTrip,getTrip,patchTripFields,saveLiveExpedition,deleteVaultDB} from '../../src/lib/vault/storage';
import {startExpedition} from '../../src/lib/vault/liveTrackingEngine';
import type {TripRecord} from '../../src/lib/vault/types';
test('concurrent recording and publication patches preserve both fields and all unrelated trip data',async()=>{
 await deleteVaultDB();
 const trip:TripRecord={id:'concurrent',title:'Original',destination:'Kyoto',startDate:'2026-11-01',status:'ACTIVE',travelStyle:'LEISURE',currency:'INR',budgetTotal:500,notes:'Private notes',createdAt:'2026-11-01',updatedAt:'2026-11-01'};
 await saveTrip(trip);const session=startExpedition(trip.id);session.totalDistanceKm=15.123456;
 await Promise.all([patchTripFields(trip.id,{publishedSlug:'public-trip',publishedAt:'2026-11-17'}),saveLiveExpedition(trip.id,session)]);
 const saved=await getTrip(trip.id);assert.equal(saved?.publishedSlug,'public-trip');assert.equal(saved?.liveExpedition?.totalDistanceKm,15.123456);assert.equal(saved?.notes,trip.notes);assert.equal(saved?.budgetTotal,trip.budgetTotal);
});
