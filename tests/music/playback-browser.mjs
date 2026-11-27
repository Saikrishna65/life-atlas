// Source fixture only: React/render and asynchronous playback tests, not an APK or app build.
import { build } from "esbuild";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const source = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MusicPlayerProvider,useMusicPlayer,useMusicProgress} from './src/lib/music/MusicPlayerContext';
class TestAudio extends EventTarget {
 currentTime=0; duration=90; paused=true; playbackRate=1; volume=1; src='';
 pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
 play(){this.paused=false;return new Promise((resolve,reject)=>window.pendingPlays.push({resolve,reject}));}
}
window.pendingPlays=[]; window.Audio=function(){return window.testAudio=new TestAudio();};
window.rowRenders=0;
function Row(){useMusicPlayer();window.rowRenders++;return <span>Song</span>;}
function Controls(){window.player=useMusicPlayer();return <p id="state">{window.player.currentTrack?.id}:{window.player.error || 'ok'}</p>;}
function Clock(){return <output>{useMusicProgress()}</output>;}
createRoot(document.getElementById('root')).render(<MusicPlayerProvider><Controls/><Clock/>{Array.from({length:100},(_,i)=><Row key={i}/>)}</MusicPlayerProvider>);
`;
const result = await build({stdin:{contents:source,loader:"tsx",resolveDir:process.cwd()},bundle:true,write:false,format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"',"process.env":"{}"}});
const server = createServer((_req,res)=>{res.setHeader("content-type","text/html");res.end(`<div id="root"></div><script>${result.outputFiles[0].text.replaceAll("</script","<\\/script")}</script>`);});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
let browser;
try {
  browser=await chromium.launch({executablePath:"/usr/bin/chromium",args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on("pageerror",error=>{errors.push(error.message);console.error(error.message);});
  page.on("console",message=>{if(message.type()==="error")console.error(message.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>!!window.testAudio && !!window.player);
  const before=await page.evaluate(()=>window.rowRenders);
  for(let i=1;i<=30;i++) {
    await page.evaluate(seconds=>{testAudio.currentTime=seconds;testAudio.dispatchEvent(new Event('timeupdate'));},i);
    await page.waitForFunction(seconds=>document.querySelector('output').textContent===String(seconds),i);
  }
  const after=await page.evaluate(()=>window.rowRenders);
  assert.equal(after,before,"Playback ticks must not rerender the 100 library rows");
  await page.evaluate(()=>{
    const song=id=>({id,title:id,artist:'Test',album:'Test',duration:90,audioBlob:new Blob([new Uint8Array(3000)]),addedAt:1});
    window.player.playTrack(song('first'));
    window.player.playTrack(song('second'));
  });
  await page.waitForFunction(()=>pendingPlays.length===2);
  await page.evaluate(()=>pendingPlays[1].resolve());
  await page.waitForFunction(()=>player.isPlaying && player.currentTrack.id==='second');
  await page.evaluate(()=>pendingPlays[0].reject(new Error('Older play request interrupted')));
  await page.waitForFunction(()=>document.querySelector('#state').textContent==='second:ok');
  assert.equal(await page.evaluate(()=>player.error),null);
  await page.evaluate(()=>{player.playTrack({...player.currentTrack,id:'third'});});
  await page.waitForFunction(()=>pendingPlays.length===3);
  await page.evaluate(()=>{player.stop();pendingPlays[2].resolve();});
  await page.waitForFunction(()=>!player.isPlaying && player.currentTrack.id==='third' && document.querySelector('output').textContent==='0');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',progressUpdates:30,libraryRows:100,extraLibraryRowRenders:after-before,rapidTrackSwitch:'passed',stopDuringPendingPlay:'passed',pageErrors:errors.length}));
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
