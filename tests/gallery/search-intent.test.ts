import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gallerySearchIntent} from '../../src/lib/gallery/search-intent';
const trips=[{id:'himalaya',title:'My mountain journey',websitePlaces:[{id:'temple',name:'Tungnath'}]}] as Parameters<typeof gallerySearchIntent>[1];
test('local search combines saved place, media type, date and favourites without guessing places',()=>{
 const result=gallerySearchIntent('my favourite photos at Tungnath in November 2026',trips);
 assert.equal(result.tripId,'himalaya');assert.equal(result.placeId,'temple');assert.equal(result.kind,'photo');assert.equal(result.favorites,true);assert.equal(result.from,'2026-11-01');assert.equal(result.to,'2026-11-30');assert.equal(result.text,'');
 assert.equal(gallerySearchIntent('coffee in an unknown town',trips).text,'coffee in an unknown town');
});
test('relative dates roll over the year and unmatched scene words remain searchable',()=>{
 const result=gallerySearchIntent('videos from last month with friends',trips,new Date(2026,0,15));
 assert.equal(result.from,'2025-12-01');assert.equal(result.to,'2025-12-31');assert.equal(result.kind,'video');assert.equal(result.text,'with friends');
 assert.equal(gallerySearchIntent('photos on 2026-02-30',trips).from,undefined);
});
test('ambiguous saved place names require choosing the trip',()=>{
 const other={...trips[0],id:'other',title:'Second holiday'};
 assert.equal(gallerySearchIntent('Tungnath',[...trips,other]).placeId,undefined);
 assert.equal(gallerySearchIntent('Tungnath My mountain journey',[...trips,other]).tripId,'himalaya');
});
