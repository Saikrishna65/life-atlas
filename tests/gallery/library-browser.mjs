import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const photo=await readFile('public/images/world/mountains.webp'), film=await readFile('public/films/hero/highlands.mp4');
const mocks={
 'next/image':`import React from 'react';export default function Image({fill,priority,unoptimized,...p}){return <img {...p}/>}`,
 'next/link':`import React from 'react';export default function Link(p){return <a {...p}/>}`,
 '@capacitor/core':`export const Capacitor={convertFileSrc:s=>s,isNativePlatform:()=>false,getPlatform:()=>'android'};export const registerPlugin=()=>({});export class WebPlugin {};`,
 '@/lib/r2/native':`export const R2=window.native;export const nativeR2Available=()=>true;export const systemAction=async f=>f();export const storageError=e=>e?.code||e?.message||'Failed';export const bytes=n=>(n/1024).toFixed(1)+' KB';`
};
const fixture=`window.calls={saved:[],trash:[],tasks:[],imports:[],downloads:[],sessions:0,phone:[]};window.backup={enabled:false,photos:true,videos:true,albums:[],wifiOnly:true,chargingOnly:false,includeExisting:true,videoPreviews:false};window.records=[{id:'a',name:'Mountain.jpg',slot:'private',scope:'s',state:'active',kind:'photo',mimeType:'image/jpeg',size:10000,totalBytes:10100,changed:1000,verifiedAt:Date.now(),hasThumbnail:true},{id:'b',name:'The valley.mp4',slot:'private',scope:'s',state:'active',kind:'video',mimeType:'video/mp4',size:50000,totalBytes:51000,changed:2000,verifiedAt:Date.now(),hasThumbnail:true,hasClip:true}];window.imports=[];window.native={
 getLibraryStatus:async()=>({androidSdk:36,trashDays:30,autoBackup:window.backup,task:{},imports:window.imports,backupTransfers:{active:0,failed:0},importSummary:{files:0,unmatched:0}}),
 getConfigurationSummary:async()=>({public:{configured:true},private:{configured:true},recoveryVerified:true}),
 getBackupAlbums:async()=>({albums:[{id:'primary:camera',name:'Camera',count:54},{id:'primary:whatsapp',name:'WhatsApp',count:10}]}),setSensitiveScreen:async()=>{},
 configureAutoBackup:async({settings})=>{window.calls.saved.push(settings);window.backup=settings;return settings;},scanBackupNow:async()=>{window.calls.scan=true;},
 beginLibrarySession:async()=>{window.calls.sessions++;return {session:'session'};},endLibrarySession:async()=>{},
 listLibrary:async({session,state,slot})=>{if(!session||slot!=='private')throw Error('Unsafe request');return {items:window.records.filter(r=>r.state===state),offset:50,complete:true,counts:{active:2}};},
 libraryThumbnail:async()=>({path:'/photo.webp'}),libraryPreview:async({id,variant})=>({path:variant==='clip'?'/clip.mp4':'/photo.webp',token:'preview-'+id}),releaseGalleryPreview:async()=>{},
 changeLibraryTrash:async(input)=>{window.calls.trash.push(input);window.records=window.records.map(r=>input.ids.includes(r.id)?{...r,state:input.action==='trash'?'trashed':input.action==='restore'?'active':'deleted',trashAt:Date.now()}:r);return {session:'new-session'};},
 startLibraryTask:async input=>{window.calls.tasks.push(input)},saveLibraryPreferences:async()=>{},
 downloadLibraryOriginal:async input=>{window.calls.downloads.push(input)},getDeviceTrash:async()=>({items:[{id:'image:external:4',name:'Phone trash.jpg',size:5000,mimeType:'image/jpeg',expiresAt:Date.now()+86400000}],complete:true,cursor:'4:external'}),trashDeviceMedia:async input=>{window.calls.phone.push(input);return {approved:true}},
 pickTakeoutArchives:async()=>{window.imports=[{id:'zip',name:'takeout-001.zip',status:'selected',files:0}];return {files:[{id:'zip',name:'takeout-001.zip'}]}},
 controlTakeoutImport:async input=>{window.calls.imports.push(input);window.imports[0].status=input.action==='start'?'running':'paused';}
};`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import Library from './src/components/gallery/LibraryHub';createRoot(document.getElementById('root')).render(<Library/>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},write:false,bundle:true,format:'iife',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env':'{"NODE_ENV":"production"}'},plugins:[{name:'mock-native',setup(b){b.onResolve({filter:/.*/},a=>{const path=a.path==='../r2/native'?'@/lib/r2/native':a.path;return mocks[path]?{path,namespace:'fixture'}:undefined;});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
const css=await readFile('src/components/gallery/library-hub.css','utf8');
const server=createServer(async(req,res)=>{if(req.url==='/photo.webp'){res.setHeader('content-type','image/webp');res.end(photo);return;}if(req.url==='/clip.mp4'){res.setHeader('content-type','video/mp4');res.end(film);return;}res.setHeader('content-type','text/html');res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial;background:white}button,input{font:inherit}${css}</style><div id="root"></div><script>${fixture}</script><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByText('Private backup is off',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.saved.length),0);
 await page.getByLabel('Enable automatic encrypted private backup').check();await page.getByLabel('Camera',{exact:false}).check();
 assert.equal(await page.getByRole('button',{name:'Save backup settings'}).isDisabled(),true);
 await page.getByLabel('I approve automatic uploads',{exact:false}).check();await page.getByRole('button',{name:'Save backup settings'}).click();
 await page.getByText('Private backup is enabled',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>window.calls.saved[0].albums),['primary:camera']);
 await page.getByRole('button',{name:'Scan now',exact:true}).click();await page.waitForFunction(()=>window.calls.scan===true);
 await page.getByRole('button',{name:'Restore index from R2'}).click();await page.waitForFunction(()=>window.calls.tasks.length===1);
 await page.screenshot({path:'work/qa-gallery/library-backup-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Cloud photos',exact:true}).click();await page.getByRole('button',{name:'Open cloud library'}).click();
 await page.getByRole('checkbox',{name:'Select Mountain.jpg',exact:true}).waitFor();
 await page.getByRole('checkbox',{name:'Select Mountain.jpg',exact:true}).check();page.once('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Move cloud copies to trash'}).click();await page.waitForFunction(()=>window.calls.trash.length===1);
 await page.getByRole('button',{name:'Cloud trash',exact:true}).click();await page.getByRole('checkbox',{name:'Select Mountain.jpg',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.sessions),1,'Foreground tab changes reuse the native private viewing session');
 await page.getByRole('checkbox',{name:'Select Mountain.jpg',exact:true}).check();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Restore',exact:true}).click();await page.waitForFunction(()=>window.calls.trash.length===2);
 await page.getByRole('button',{name:'View accessible phone trash'}).click();await page.getByRole('checkbox',{name:'Phone trash.jpg',exact:false}).waitFor();
 await page.getByRole('checkbox',{name:'Phone trash.jpg',exact:false}).check();await page.getByRole('button',{name:'Restore 1 phone files…'}).click();await page.waitForFunction(()=>window.calls.phone.length===1);
 assert.equal(await page.evaluate(()=>window.calls.phone[0].trashed),false);
 await page.getByRole('button',{name:'Takeout import',exact:true}).click();await page.getByRole('button',{name:'Select Takeout ZIP archives'}).click();await page.getByRole('button',{name:'Start import',exact:true}).waitFor();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Start import',exact:true}).click();await page.getByRole('button',{name:'Pause after current operation',exact:true}).waitFor();await page.getByRole('button',{name:'Pause after current operation',exact:true}).click();await page.getByRole('button',{name:'Resume import',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.imports.map(i=>i.action)),['start','pause']);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Backup',exact:true}).click();await page.screenshot({path:'work/qa-gallery/library-backup-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Cloud photos',exact:true}).click();await page.getByRole('checkbox',{name:'Select Mountain.jpg',exact:true}).waitFor();await page.screenshot({path:'work/qa-gallery/library-cloud-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: private backup consent/albums, scan, index restore, single foreground session, separate cloud/phone trash and restore, Takeout explicit start/pause/resume, responsive desktop/mobile without overflow or console errors. Native operations use fixtures; no device or cloud writes.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
