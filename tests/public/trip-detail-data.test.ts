import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoTripDetail, publicTripDetail, type PublicTripInput } from '../../src/lib/public-trips/detail';
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
    assert.equal(detail.metrics.length, 0, 'No invented telemetry');
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
  assert.equal(detail.duration, 'Travel journal');
  assert.equal(detail.next, undefined);
});
test('public recordings preserve segment gaps and only publish available metrics', () => {
  const detail = publicTripDetail({ ...trip, routeData:{ totalDistanceKm:12, movingSeconds:7200, legs:[{ coordinates:[{latitude:30,longitude:79},{latitude:30.01,longitude:79.02},null,{latitude:31,longitude:80},{latitude:31.01,longitude:80.02}]}] } });
  assert.equal(detail.paths.length, 2);
  assert.ok(detail.metrics.some(metric => metric.label === 'Distance' && metric.value === '12'));
  assert.ok(detail.metrics.some(metric => metric.label === 'Moving average' && metric.value === '6'));
  assert.ok(!detail.metrics.some(metric => metric.label === 'Highest point'));
});
test('real photographs keep optional captions and place metadata; unknown location fixes are excluded', () => {
  const detail = publicTripDetail({ ...trip, photos:[{id:'p',url:'https://example.com/original.jpg',caption:null,place:{name:'Kyoto'}}], tripPlaces:[{place:{id:'bad',name:'Invalid',latitude:100,longitude:500,description:null}}], tripDays:[{id:'day',dayIndex:1,date:new Date('2026-02-01'),title:'Arrival',description:'The original public description.'}] });
  assert.equal(detail.media[0].place, 'Kyoto');
  assert.equal(detail.media[0].caption, undefined);
  assert.equal(detail.stops.length, 0);
  assert.equal(detail.days[0].description, 'The original public description.');
  assert.deepEqual(detail.days[0].beats, []);
});
