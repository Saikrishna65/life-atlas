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

test('ordinary day/week questions preserve scene words and confirmed people',()=>{
 const now=new Date(2026,0,1,12);
 const yesterday=gallerySearchIntent('show me photos of mountains from yesterday',trips,now);
 assert.equal(yesterday.from,'2025-12-31');assert.equal(yesterday.to,'2025-12-31');assert.equal(yesterday.text,'mountains');
 const week=gallerySearchIntent('find photos at Tungnath with Kiran last week',trips,now,[{id:'kiran',name:'Kiran'}]);
 assert.equal(week.from,'2025-12-22');assert.equal(week.to,'2025-12-28');assert.equal(week.placeId,'temple');assert.equal(week.personId,'kiran');assert.equal(week.text,'');
 const days=gallerySearchIntent('videos from the past 7 days',[],now);
 assert.equal(days.from,'2025-12-26');assert.equal(days.to,'2026-01-01');
 assert.equal(gallerySearchIntent('photos from the last 0 days',[],now).from,undefined);
 assert.equal(gallerySearchIntent('photos from the last 999 days',[],now).from,undefined);
});
