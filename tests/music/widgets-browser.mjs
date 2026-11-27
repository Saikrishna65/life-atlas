import { build } from 'esbuild';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Widget from './src/components/music/MusicWidgetsSection';createRoot(document.getElementById('root')).render(<Widget/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{name:'native-fixtures',setup(b){b.onResolve({filter:/^@\/(lib\/music\/(MusicPlayerContext|storage)|components\/music\/ui|lib\/deviceAuth)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('storage')?`const tracks=[{id:'one',title:'Song',local:true}];export const peekMusicLibrary=()=>tracks;export async function getAllTracks(){window.reads=(window.reads||0)+1;return tracks;}`:a.path.endsWith('MusicPlayerContext')?`export function useMusicPlayer(){return {isPlaying:true,togglePlayPause:()=>window.pauses=(window.pauses||0)+1,playTrack:()=>{}};}`:a.path.endsWith('ui')?`export const hasLocalAudio=t=>t.local;`:`export const triggerHaptic=()=>{};`,loader:'js'}));}}]});
const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(`<div id="root"></div><script>${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.clock.runFor(200);assert.equal(await page.evaluate(()=>window.reads),1);
 await page.evaluate(()=>{for(let i=0;i<100;i++)window.dispatchEvent(new Event('lifeatlas_tracks_updated'));});
 await page.clock.runFor(200);assert.equal(await page.evaluate(()=>window.reads),2);
 await page.getByRole('button',{name:'Refresh local library'}).click();await page.getByText('Library refreshed',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.reads),3);
 await page.getByRole('button',{name:'15m',exact:true}).click();await page.clock.runFor(14*60000);assert.equal(await page.evaluate(()=>window.pauses||0),0);
 await page.clock.runFor(61000);assert.equal(await page.evaluate(()=>window.pauses),1);
 await page.getByRole('button',{name:'15m',exact:true}).click();await page.getByRole('button',{name:'15m',exact:true}).click();await page.clock.runFor(16*60000);assert.equal(await page.evaluate(()=>window.pauses),1);
 console.log('PASS: warm library, 100 events coalesced into one read, real refresh, exact timer deadline and cancellation. Music/native services are fixtures.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
