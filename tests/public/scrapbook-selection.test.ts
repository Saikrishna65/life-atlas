import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogScrapbookFrames, scrapbookSamples, selectScrapbookFrames, type ScrapbookFrame } from '../../src/lib/public-trips/scrapbook';
import type { PublishedMedia } from '../../src/lib/r2/types';
const fixture = (trip: string, kind: 'photo' | 'film', index = 0): ScrapbookFrame => ({ id: `${trip}-${kind}-${index}`, tripId: trip, tripTitle: trip, src: `https://media.example.com/${trip}/${kind}-${index}`, preview: '', title: 'A moment', kind, sample: false });
test('takes one photo and film from every trip before extras, and mixes their order', () => {
  const pool = ['trip-a', 'trip-b', 'trip-c'].flatMap(trip => [fixture(trip, 'photo'), fixture(trip, 'film'), fixture(trip, 'photo', 1), fixture(trip, 'photo', 2)]);
  const selected = selectScrapbookFrames(pool, 128);
  assert.equal(selected.length, 8);
  for (const trip of ['trip-a', 'trip-b', 'trip-c']) for (const kind of ['photo', 'film']) assert.ok(selected.some(frame => frame.tripId === trip && frame.kind === kind));
  assert.equal(new Set(selected.map(frame => frame.id)).size, 8);
  assert.deepEqual(selected, selectScrapbookFrames(pool, 128));
  assert.notDeepEqual(selected, selectScrapbookFrames(pool, 129));
});
test('the strip retains all trips beyond the eight collage slots', () => {
  const pool = Array.from({ length: 12 }, (_, i) => [fixture(`trip-${i}`, 'photo'), fixture(`trip-${i}`, 'film')]).flat();
  assert.equal(selectScrapbookFrames(pool, 7).length, 24);
});
test('does not pad real media with fictional samples or invent missing films', () => {
  const photo = fixture('one-real-trip', 'photo');
  assert.deepEqual(selectScrapbookFrames([...scrapbookSamples, photo], 42), [photo]);
  assert.equal(selectScrapbookFrames(scrapbookSamples, 42).length, 8);
});
test('accepts published trip films without thumbnails and matches trip title to slug', () => {
  const base: PublishedMedia = { id: 'film', key: 'travel/a.mp4', url: 'https://media.example.com/a.mp4', title: 'A film', description: '', tags: [], category: 'expedition', collection: ' A Real Journey ', mimeType: 'video/mp4', size: 1000, publishedAt: '2026-01-01', metadataPolicy: 'removed' };
  const known = { ...fixture('a-real-journey', 'photo'), tripTitle: 'A Real Journey' };
  const frames = catalogScrapbookFrames([base, { ...base, id: 'unrelated', category: 'music-artwork' }], [known]);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].tripId, 'a-real-journey');
  assert.equal(frames[0].kind, 'film');
  assert.equal(frames[0].preview, '');
});
