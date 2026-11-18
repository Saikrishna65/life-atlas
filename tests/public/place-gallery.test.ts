import {test} from 'node:test';import assert from 'node:assert/strict';
import {placeGalleryFrames} from '../../src/lib/public-trips/place-gallery';
test('a place gallery contains only assigned photographs and films from its linked trips',()=>{
 const trip={id:'a',slug:'trip-a',title:'Trip A',routeData:{publication:{media:[{id:'waterfall-photo',url:'https://media.example/w.jpg',kind:'photo',place:'Waterfall'},{id:'waterfall-film',url:'https://media.example/w.mp4',kind:'video',place:'Waterfall'},{id:'lake',url:'https://media.example/l.jpg',kind:'photo',place:'Lake'}]}}};
 const items=placeGalleryFrames(' waterfall ',[],[{trip}]);assert.deepEqual(items.map(i=>i.id),['waterfall-photo','waterfall-film']);assert.ok(items.every(i=>i.tripId==='a'&&!i.sample));assert.deepEqual(placeGalleryFrames('Forest',[],[{trip}]),[]);
});
