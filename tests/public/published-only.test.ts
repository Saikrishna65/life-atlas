import test from 'node:test';
import assert from 'node:assert/strict';
import type prisma from '../../src/lib/prisma';
import {getLatestHeroTrips,getHeroGalleryPhotos} from '../../src/lib/queries/hero-trips';
import {getScrapbookMedia} from '../../src/lib/queries/scrapbook';
import {getTripArchive} from '../../src/lib/queries/trip-archive';
import {getPublicPlaces} from '../../src/lib/queries/public-content';
const source=(records:unknown[]=[],offline=false)=>({trip:{findMany:async()=>{if(offline)throw Error('offline fixture');return records;}},place:{findMany:async()=>{if(offline)throw Error('offline fixture');return [];}}}) as unknown as typeof prisma;
test('empty public database never manufactures trips, stock photos, videos or destinations',async()=>{
 const db=source();for(const records of await Promise.all([getLatestHeroTrips(undefined,db),getHeroGalleryPhotos(db),getScrapbookMedia(db),getTripArchive(undefined,db),getPublicPlaces(db)]))assert.deepEqual(records,[]);
});
test('public database outage never substitutes the old demo atlas',async()=>{
 const db=source([],true);for(const records of await Promise.all([getLatestHeroTrips(undefined,db),getHeroGalleryPhotos(db),getScrapbookMedia(db),getTripArchive(undefined,db),getPublicPlaces(db)]))assert.deepEqual(records,[]);
});
test('hero and gallery retain explicitly published R2 media without inventing a cover or film',async()=>{
 const photo={id:'real-photo',url:'https://media.example.com/photo.jpg',kind:'photo',place:'My place',category:'Trip journal'};
 const db=source([{id:'trip',slug:'my-trip',title:'My trip',coverImage:null,photos:[],routeData:{publication:{media:[photo]}}}]);
 const hero=await getLatestHeroTrips(undefined,db);assert.equal(hero[0].image,photo.url);assert.equal(hero[0].video,undefined);assert.equal(hero[0].sample,false);
 const gallery=await getHeroGalleryPhotos(db);assert.equal(gallery[0].src,photo.url);
 const scrapbook=await getScrapbookMedia(db);assert.equal(scrapbook[0].src,photo.url);assert.equal(scrapbook[0].kind,'photo');
});
