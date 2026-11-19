import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {chooseTripCover,readTripCover,routeWithTripCover,tripCoverCandidates,tripCoverImage} from '../../src/lib/public-trips/cover';
import {updatePublishedTripCover,readPublishedTripCover} from '../../src/lib/studio/trip-cover-server';
import {savePastTrip} from '../../src/lib/studio/store';
import {getTrip,patchTripFields} from '../../src/lib/vault/storage';
import {websitePayload} from '../../src/lib/vault/website-payload';
import {getLatestHeroTrips} from '../../src/lib/queries/hero-trips';
import {publicTripDetail,type PublicTripInput} from '../../src/lib/public-trips/detail';
const media=[{id:'film-first',url:'https://media.example/a.mp4',kind:'video' as const,place:'Lake'}, {id:'photo',url:'https://media.example/photo.jpg',kind:'photo' as const,place:'Summit'}, {id:'film-chosen',url:'https://media.example/b.mp4',kind:'video' as const,poster:'https://media.example/poster.webp',place:'Summit'}];
const route={totalDistanceKm:22,maxElevationMeters:2100,segments:[{points:[{latitude:30,longitude:79}]}],publication:{media}};
const base:PublicTripInput={id:'trip-a',slug:'my-trip',title:'My trip',destination:'Hills',description:null,coverImage:media[1].url,duration:null,startDate:null,routeData:route,totalDistanceKm:22,maxElevationMeters:2100,elevationGainMeters:null,tripPlaces:[],tripDays:[],photos:[]};
test('explicit photo beats first video; later video uses its exact source on trip page and homepage',async()=>{
 for(const selected of [media[1],media[2]]){
  const routeData=routeWithTripCover(route,selected),detail=publicTripDetail({...base,routeData});
  assert.equal(detail.coverKind,selected.kind);assert.equal(detail.coverFilm,selected.kind==='video'?selected.url:undefined);
  if(selected.kind==='photo')assert.equal(detail.cover,selected.url);
  const source={trip:{findMany:async()=>[{...base,routeData}]}} as unknown as Parameters<typeof getLatestHeroTrips>[1];
  const [hero]=await getLatestHeroTrips(undefined,source);assert.equal(hero.video,detail.coverFilm);assert.equal(hero.image,selected.kind==='photo'?selected.url:media[2].poster);
 }
 assert.equal(publicTripDetail(base).coverFilm,media[0].url,'Legacy automatic selection remains unchanged');
});
test('cover choices belong to this trip; sensitive sources and malformed snapshots cannot become covers',()=>{
 assert.throws(()=>chooseTripCover(media,'another-trip-file'));assert.throws(()=>chooseTripCover(media,{}));assert.equal(chooseTripCover(media,null),null);
 for(const url of ['javascript:alert(1)','https://u:secret@cdn.example/a.jpg','https://cdn.example/a.jpg?X-Amz-Signature=secret','https://x.r2.cloudflarestorage.com/a','https://cdn.example/encrypted/photos/a'])assert.deepEqual(tripCoverCandidates({publication:{media:[{id:'bad',url,kind:'photo'}]}}),[]);
 assert.equal(readTripCover({publication:{hero:{id:'x',kind:'video',url:'blob:private'}}}),null);
 const candidates=tripCoverCandidates(route,[{id:'inline',url:'data:image/jpeg;base64,a'},{id:'duplicate',url:media[1].url}]);assert.equal(candidates.length,4);assert.equal(candidates[0].url,'/api/public/studio-photo/inline');assert.equal(candidates.find(item=>item.url===media[1].url)?.id,'photo');
});
test('cover-only server mutation locks the trip and changes only its cover metadata',async()=>{
 const calls:string[]=[],writes:unknown[]=[];const original=structuredClone(route);
 const db={$queryRaw:async()=>{calls.push('lock');},trip:{findUnique:async()=>{calls.push('read');return {...base,photos:[]};},update:async(value:unknown)=>{calls.push('write');writes.push(value);}}};
 const source={trip:db.trip,$transaction:async(fn:(client:typeof db)=>unknown)=>fn(db)} as unknown as Parameters<typeof updatePublishedTripCover>[2];
 const result=await updatePublishedTripCover('my-trip','film-chosen',source);assert.equal(result?.hero?.url,media[2].url);assert.deepEqual(calls,['lock','read','write']);
 const data=(writes[0] as {data:Record<string,unknown>}).data;assert.deepEqual(Object.keys(data).sort(),['coverImage','routeData']);assert.deepEqual((data.routeData as typeof route).segments,original.segments);assert.deepEqual((data.routeData as typeof route).publication.media,media);assert.deepEqual(route,original);assert.equal(data.coverImage,media[2].poster);
 const library=await readPublishedTripCover('my-trip',source);assert.equal(library?.media.length,3);
 await assert.rejects(updatePublishedTripCover('my-trip','foreign',source),/already published/);assert.equal(writes.length,1);
 const automatic=routeWithTripCover(data.routeData,null);assert.equal(readTripCover(automatic),null);assert.deepEqual((automatic.publication as typeof route.publication).media,media);assert.equal(tripCoverImage(null,media[2].poster!,media),media[1].url);
});
test('offline choice survives reopening, remains trip-specific and public payload exposes only its ID',async()=>{
 const a=await savePastTrip({title:'A',destination:'Hills',startDate:'',endDate:''}),b=await savePastTrip({title:'B',destination:'Lake',startDate:'',endDate:''});
 await patchTripFields(a.id,{websiteHeroMediaId:'photo'});const saved=(await getTrip(a.id))!;assert.equal(saved.websiteHeroMediaId,'photo');assert.equal((await getTrip(b.id))?.websiteHeroMediaId,undefined);assert.deepEqual(saved.websitePlaces,a.websitePlaces);
 const body=websitePayload(saved,[],[],{memoryIds:[]});assert.equal(body.heroMediaId,'photo');assert.equal(body.routeData,undefined);assert.equal(body.preserveExistingRoute,true);assert.equal(body.preserveExistingMedia,true);assert.equal('websiteHeroMediaId' in body,false);
 await patchTripFields(a.id,{websiteHeroMediaId:null});assert.equal(websitePayload((await getTrip(a.id))!,[],[],{memoryIds:[]}).heroMediaId,null);
});
