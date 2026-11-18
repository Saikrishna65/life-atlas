import {demoTripDetail} from "../../src/data/demo/trip-detail";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicTripDetail, formatJourneyDuration, type PublicTripInput } from '../../src/lib/public-trips/detail';
import { sampleJourneyTelemetry } from '../../src/data/demo/journey-telemetry';
import { expeditions } from '../../src/data/demo/expeditions';
const trip: PublicTripInput = {
  id:'real-trip', slug:'my-journey', title:'My journey', destination:'Japan', description:'A published journal', coverImage:null, duration:null,
  startDate:new Date('2026-02-01T00:00:00Z'), routeData:null, totalDistanceKm:null, maxElevationMeters:null, elevationGainMeters:null,
  tripPlaces:[], tripDays:[], photos:[],
};
test('every demo trip has a complete itinerary, media, a valid next journey and an honest sample label', () => {
  for (const expedition of expeditions) {
    const detail = demoTripDetail(expedition);
    assert.equal(detail.sample, true);
    assert.equal(detail.days.length, expedition.duration);
    assert.ok(detail.days.every(day => day.beats.length >= 5));
    assert.ok(detail.media.some(media => media.kind === 'video'));
    assert.ok(detail.media.some(media => media.kind === 'photo'));
    assert.equal(new Set(detail.media.map(media => media.id)).size, detail.media.length);
    assert.ok(expeditions.some(trip => trip.slug === detail.next?.slug));
    assert.ok(detail.paths.every(path => path.length > 1));
    assert.ok(detail.stops.every(stop => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)));
    assert.equal(detail.metrics.length, 7, 'Clearly labelled example figures');
    const telemetry = sampleJourneyTelemetry(detail.id, expedition.duration)!;
    assert.equal(telemetry.example, true);
    assert.ok(telemetry.elapsedSeconds >= telemetry.movingSeconds);
    assert.ok(telemetry.distanceKm / (telemetry.movingSeconds / 3600) <= telemetry.maxSpeedKmh);
  }
});
test('a real trip without a GPS recording or media never gains a fictional path, photo or statistic', () => {
  const detail = publicTripDetail(trip);
  assert.equal(detail.sample, false);
  assert.deepEqual(detail.paths, []);
  assert.deepEqual(detail.metrics, []);
  assert.deepEqual(detail.media, []);
  assert.equal(detail.cover, '');
  assert.equal(detail.coverFilm, undefined);
  assert.equal(detail.duration, '');
  assert.equal(publicTripDetail({...trip, description:null}).overview, '');
  assert.equal(detail.next, undefined);
});
test('public recordings preserve segment gaps and only publish available metrics', () => {
  const detail = publicTripDetail({ ...trip, routeData:{ totalDistanceKm:12, movingSeconds:7200, legs:[{ coordinates:[{latitude:30,longitude:79},{latitude:30.01,longitude:79.02},null,{latitude:31,longitude:80},{latitude:31.01,longitude:80.02}]}] } });
  assert.equal(detail.paths.length, 2);
  assert.ok(detail.metrics.some(metric => metric.label === 'Distance travelled' && metric.value === '12'));
  assert.ok(detail.metrics.some(metric => metric.label === 'Average moving speed' && metric.value === '6'));
  assert.ok(!detail.metrics.some(metric => metric.label === 'Highest altitude'));
});
test('real photographs keep optional captions and place metadata; unknown location fixes are excluded', () => {
  const detail = publicTripDetail({ ...trip, photos:[{id:'p',url:'https://example.com/original.jpg',caption:null,place:{name:'Kyoto'}}], tripPlaces:[{place:{id:'bad',name:'Invalid',latitude:100,longitude:500,description:null}}], tripDays:[{id:'day',dayIndex:1,date:new Date('2026-02-01'),title:'Arrival',description:'The original public description.'}] });
  assert.equal(detail.media[0].place, 'Kyoto');
  assert.equal(detail.media[0].caption, undefined);
  assert.equal(detail.stops.length, 0);
  assert.equal(detail.days[0].description, 'The original public description.');
  assert.deepEqual(detail.days[0].beats, []);
});

test('recorded totals drive average speed consistently and below-sea-level altitudes remain valid', () => {
  const detail = publicTripDetail({ ...trip, totalDistanceKm:120, maxElevationMeters:-20, routeData:{totalDistanceKm:12,movingSeconds:7200,totalDurationSeconds:9000} });
  assert.ok(detail.metrics.some(metric => metric.label === 'Distance travelled' && metric.value === '120'));
  assert.ok(detail.metrics.some(metric => metric.label === 'Average moving speed' && metric.value === '60'));
  assert.ok(detail.metrics.some(metric => metric.label === 'Highest altitude' && metric.value === '-20'));
  assert.ok(detail.metrics.some(metric => metric.label === 'Moving time' && metric.value === '2h 0m'));
  assert.ok(detail.metrics.some(metric => metric.label === 'Elapsed time' && metric.value === '2h 30m'));
});
test('invalid stored totals fall back to valid published GPS figures without creating sample statistics', () => {
  const detail = publicTripDetail({ ...trip, totalDistanceKm:-10, routeData:{totalDistanceKm:12,movingSeconds:7200} });
  assert.equal(detail.sample,false);
  assert.ok(detail.metrics.some(metric => metric.label === 'Distance travelled' && metric.value === '12'));
  assert.equal(sampleJourneyTelemetry('unknown-trip',5),null);
  assert.equal(formatJourneyDuration(94500),'1d 2h 15m');
});


test('photo-only journals do not acquire missing trip details or empty itinerary days', () => {
  const detail = publicTripDetail({ ...trip, destination:'', startDate:null, description:'  ', duration:' ',
    photos:[{id:'photo-only',url:'/images/people/stock-creator.webp',caption:null}],
    tripDays:[{id:'blank',dayIndex:1,date:null,title:' ',description:null}],
  });
  assert.equal(detail.media.length,1);
  assert.equal(detail.cover,detail.media[0].url);
  assert.deepEqual(detail.days,[]);
  assert.deepEqual(detail.paths,[]);
  assert.deepEqual(detail.stops,[]);
  assert.deepEqual(detail.metrics,[]);
  assert.equal(detail.date,undefined);
  assert.equal(detail.duration,'');
  assert.equal(detail.overview,'');
});

test('partial journals keep genuine zero metrics and an authored itinerary without filler copy', () => {
  const detail = publicTripDetail({...trip,totalDistanceKm:0,maxElevationMeters:0,tripDays:[
    {id:'title-only',dayIndex:1,date:null,title:'A day by the river',description:null},
    {id:'notes-only',dayIndex:2,date:null,title:null,description:'Lunch with friends.'},
  ]});
  assert.equal(detail.metrics.length,2);
  assert.ok(detail.metrics.every(metric=>metric.value==='0'));
  assert.equal(detail.days.length,2);
  assert.equal(detail.days[0].description,'');
  assert.equal(detail.days[0].date,undefined);
  assert.equal(detail.days[1].description,'Lunch with friends.');
  assert.deepEqual(detail.days[0].beats,[]);
});
