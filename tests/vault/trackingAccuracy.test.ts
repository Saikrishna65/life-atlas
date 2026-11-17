import {test} from 'node:test';
import assert from 'node:assert/strict';
import {positionBreadcrumb,startExpedition,addBreadcrumbToExpedition,shouldRecordPoint,advanceExpeditionClock,pauseExpedition,resumeExpedition,exportExpeditionToGeoJson} from '../../src/lib/vault/liveTrackingEngine';
import {publishedRoute} from '../../src/lib/public-trips/route';
import type {BreadcrumbPoint} from '../../src/lib/vault/types';
const fix=(meters:number,seconds:number,extra:Partial<BreadcrumbPoint>={}):BreadcrumbPoint=>({latitude:0,longitude:meters/111194.9266,accuracy:3,timestamp:100000+seconds*1000,speed:null,altitude:null,...extra});
function recording(category:'WALK'|'DRIVE'='WALK'){return startExpedition('test','Test track',category);}
test('GPS boundary converts once: 1.4 m/s walking and 20 m/s bike remain about 5 and 72 km/h',()=>{
 for(const [mps,meters,category] of [[1.4,14,'WALK'],[20,200,'DRIVE']] as const){
  const source={timestamp:110000,coords:{latitude:0,longitude:meters/111194.9266,speed:mps,altitude:null,altitudeAccuracy:null,accuracy:3,heading:null}};
  let session=addBreadcrumbToExpedition(recording(category),fix(0,0));session=addBreadcrumbToExpedition(session,positionBreadcrumb(source));
  assert.ok(Math.abs(session.currentSpeedKmh!-mps*3.6)<.01);
 }
});
test('bad reported 100/600 km/h never becomes a walking/bike speed record; positional teleports are rejected',()=>{
 for(const [meters,reported,category,expected] of [[14,100,'WALK',5.04],[200,600,'DRIVE',72]] as const){
  let session=addBreadcrumbToExpedition(recording(category),fix(0,0));session=addBreadcrumbToExpedition(session,fix(meters,10,{speed:reported}));
  assert.ok(Math.abs(session.currentSpeedKmh!-expected)<.1);assert.ok(session.legs[0].maxSpeedKmh<100);
  const before=session;session=addBreadcrumbToExpedition(session,fix(10000,11,{speed:600}));assert.equal(session,before);
 }
});
test('sub-kilometre GPS increments keep full precision and use actual moving intervals',()=>{
 let session=recording();for(let i=0;i<=100;i++)session=addBreadcrumbToExpedition(session,fix(i*3.1,i*3));
 assert.ok(Math.abs(session.totalDistanceKm-.31)<.00001);assert.equal(session.movingSeconds,300);assert.equal(session.legs[0].movingSeconds,300);
 assert.ok(session.legs[0].avgSpeedKmh>3.7&&session.legs[0].avgSpeedKmh<3.8);
});
test('unreliable, repeated and out-of-order fixes cannot change statistics',()=>{
 const initial=addBreadcrumbToExpedition(recording(),fix(0,0));
 for(const point of [fix(10,0),fix(10,-1),fix(10,10,{accuracy:41}),fix(10,10,{latitude:NaN}),fix(10,10,{longitude:190}),fix(.5,3)])assert.equal(addBreadcrumbToExpedition(initial,point),initial);
 assert.equal(shouldRecordPoint(undefined,fix(0,0,{accuracy:-1})),false);
});
test('pause/resume and signal loss create real route gaps rather than invented distance',()=>{
 let session=addBreadcrumbToExpedition(recording(),fix(0,0));session=addBreadcrumbToExpedition(session,fix(10,10));
 session=resumeExpedition(pauseExpedition(session));session=addBreadcrumbToExpedition(session,fix(1000,20));session=addBreadcrumbToExpedition(session,fix(1010,30));
 session=addBreadcrumbToExpedition(session,fix(5000,200));session=addBreadcrumbToExpedition(session,fix(5010,210));
 assert.ok(Math.abs(session.totalDistanceKm-.03)<.00001);assert.equal(publishedRoute(session).paths.length,3);
 assert.equal((exportExpeditionToGeoJson(session) as {features:unknown[]}).features.length,3);
});
test('altitude requires vertical accuracy, suppresses spikes and preserves zero/negative heights',()=>{
 let session=addBreadcrumbToExpedition(recording(),fix(0,0,{altitude:0,altitudeAccuracy:3}));assert.equal(session.currentElevationMeters,0);
 session=addBreadcrumbToExpedition(session,fix(10,10,{altitude:8000,altitudeAccuracy:3}));assert.equal(session.currentElevationMeters,undefined);assert.equal(session.maxElevationMeters,0);
 session=addBreadcrumbToExpedition(session,fix(20,20,{altitude:1000,altitudeAccuracy:100}));assert.equal(session.currentElevationMeters,undefined);
 session=addBreadcrumbToExpedition(session,fix(30,30,{altitude:-20,altitudeAccuracy:3}));assert.ok(session.currentElevationMeters!<0);assert.equal(session.elevationGainMeters,0);
 let unknown=addBreadcrumbToExpedition(recording(),fix(0,0,{altitude:3000,altitudeAccuracy:null}));assert.equal(unknown.maxElevationMeters,undefined);
});
test('elapsed time accounts for delayed timers without callback-count assumptions or backwards clocks',()=>{
 let session=recording();session={...session,lastClockAt:100000};session=advanceExpeditionClock(session,107500);assert.equal(session.totalDurationSeconds,7.5);
 session=advanceExpeditionClock(session,107000);assert.equal(session.totalDurationSeconds,7.5);
});
test('reading and extending historical recordings does not recalculate or delete old cloud-era measurements',()=>{
 let session=recording();session={...session,totalDistanceKm:123.456,elevationGainMeters:789,maxElevationMeters:3000,legs:[{...session.legs[0],maxSpeedKmh:600,coordinates:[fix(0,0)]}]};
 const before=structuredClone(session);const next=addBreadcrumbToExpedition(session,fix(10,10));assert.deepEqual(session,before);
 assert.ok(next.totalDistanceKm>123.456);assert.equal(next.legs[0].maxSpeedKmh,600);assert.equal(next.legs[0].coordinates.length,2);
});
