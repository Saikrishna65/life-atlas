import {build} from 'esbuild';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Browser wiring/contrast regression with synthetic data and a mocked native bridge.
// No credentials, actual native transfers, website API, or personal files are accessed.
const mock=`
const fixture=window.fixture;
export async function getTrip(){return structuredClone(fixture.trip)}
export async function getMemoriesForTrip(){return []}
export async function getItinerariesForTrip(){return []}
export async function rememberPlaceTransfer(_,place,file,job){fixture.trip.websitePlaces[0].transferIds[file]=job;return getTrip()}
export async function rememberPlacePublication(_,place,file,item){const group=fixture.trip.websitePlaces[0];group.files=group.files.filter(f=>f.id!==file);group.publishedMedia.push(item);return getTrip()}
export async function publishTripToWebsite(){fixture.posts++;return {publicUrl:'https://website.example/trips/fixture'}}
export function websiteSlug(){return 'fixture-trip'}
export function nativeR2Available(){return true}
export async function systemAction(fn){return fn()}
export function storageError(error){return String(error.message||error)}
export function bytes(value=0){return value+' B'}
export const R2={
 getPublicCatalog:async()=>({catalog:{items:[]}}),
 beginTripPublication:async input=>{fixture.auth++;fixture.session='batch-'+fixture.auth;fixture.batches.push(input);return {publicationSession:fixture.session}},
 endTripPublication:async()=>{fixture.session=null},
 uploadObject:async input=>{if(input.publicationSession!==fixture.session)throw Error('Missing batch grant');fixture.uploads++;const id='job-'+input.selectionId;fixture.jobs[id]={id,slot:'public',direction:'upload',name:input.selectionId+'.jpg',mimeType:'image/jpeg',key:'galleries/'+id,createdAt:0,uploadedBytes:100,totalBytes:100,status:input.selectionId==='first'?'complete':'verifying',verified:input.selectionId==='first'};return fixture.jobs[id]},
 getTransferProgress:async()=>({transfers:Object.values(fixture.jobs).map(job=>job.id==='job-second'&&fixture.release?{...job,status:'complete',verified:true}:job)}),
 resumeTransfer:async()=>{throw Error('Already running or complete; do not restart')},
 publishTripMedia:async input=>{if(input.publicationSession!==fixture.session)throw Error('Missing batch grant');fixture.records++;return {item:{id:input.transferId,key:'galleries/'+input.transferId,url:'https://media.example/'+input.transferId+'.jpg',mimeType:'image/jpeg',tags:input.tags,collection:input.collection}}},
};`;
const aliases=new Set(['@/lib/vault/storage','@/lib/vault/publishTrip','@/lib/studio/trip-places','@/lib/vault/website-payload','@/lib/r2/native']);
const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Publisher from './src/components/trip-vault/TripWebsitePublisher';createRoot(document.getElementById('root')).render(<Publisher tripId="fixture" organized/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'synthetic-native',setup(b){b.onResolve({filter:/^@\//},args=>aliases.has(args.path)?{path:'fixture',namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js'}));}}]});
const css=await readFile('src/components/trip-vault/trip-vault.css','utf8');
const fixture={trip:{id:'fixture',title:'Synthetic trip',destination:'Test place',websitePlaces:[{id:'lake',name:'Lake',files:[{id:'first',name:'first.jpg'},{id:'second',name:'second.jpg'}],publishedMedia:[],transferIds:{}}]},auth:0,batches:[],uploads:0,records:0,posts:0,jobs:{},release:false};
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial;margin:0}*{box-sizing:border-box}${css}</style><div id="root"></div><script>window.fixture=${JSON.stringify(fixture)}</script><script>${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Publish / update website'}).click();
 await page.getByRole('checkbox',{name:'I approve making these selected files and details public.'}).check();
 const button=page.getByRole('button',{name:'Publish to website',exact:true});
 const colors=await button.evaluate(node=>{const s=getComputedStyle(node);return {background:s.backgroundColor,color:s.color}});
 assert.equal(colors.background,'rgb(40, 85, 71)');assert.equal(colors.color,'rgb(255, 255, 255)');
 await button.click();await page.getByText(/Verifying original file… second.jpg/).waitFor();
 assert.equal(await page.evaluate(()=>fixture.auth),1);assert.equal(await page.evaluate(()=>fixture.records),1);
 await page.getByRole('button',{name:'Finish uploads later'}).click();
 await page.getByRole('button',{name:'Resume publishing',exact:true}).waitFor();
 assert.equal(await page.locator('.tv-error').count(),0);assert.match(await page.locator('.tv-notice').innerText(),/progress saved/);
 assert.match(await page.locator('.tv-website-publisher summary').first().innerText(),/1 selected · 1 uploaded & ready/);
 await mkdir('work/qa-publishing-149',{recursive:true});await page.screenshot({path:'work/qa-publishing-149/saved-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Resume publishing',exact:true}).click();
 await page.waitForFunction(()=>fixture.auth===2);await page.evaluate(()=>{fixture.release=true});
 await page.getByRole('link',{name:'View my trip'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>({auth:fixture.auth,uploads:fixture.uploads,records:fixture.records,posts:fixture.posts})),{auth:2,uploads:2,records:2,posts:1});
 assert.deepEqual(await page.evaluate(()=>fixture.batches[1].transferIds),['job-second']);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await page.screenshot({path:'work/qa-publishing-149/published-mobile.png',fullPage:true});
 console.log('PASS visible primary text outside Trip Vault; one native batch grant per attempt; 100% verification; saved notice; live place counts; resume reuses transfer; final website update once; mobile overflow; no browser exceptions (mocked native bridge).');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
