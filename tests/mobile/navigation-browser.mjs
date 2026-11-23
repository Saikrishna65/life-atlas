// Source-component fixture only. No mobile bundle, APK, cloud calls or personal data.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const entry=`import React,{Suspense,lazy,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {navigate,usePathname} from './mobile/navigation';
import {installRouteScroll} from './mobile/scroll-restoration';
import ScreenReady from './mobile/ScreenReady';
import {navigationToken} from './src/lib/performance/metrics';
import {useGalleryBack} from './src/lib/gallery/navigation';
installRouteScroll();window.navigate=navigate;
const B=lazy(()=>new Promise(resolve=>{window.releaseB=()=>resolve({default:()=> <div style={{height:4000}}>Page B</div>});}));
function A(){const[height,setHeight]=useState(window.delayA?200:4000);useEffect(()=>{const timer=setTimeout(()=>setHeight(4000),200);return()=>clearTimeout(timer);},[]);return <div style={{height}}>Page A</div>;}
function Layer(){const[open,setOpen]=useState(false);useGalleryBack(open,()=>setOpen(false),20);return <><button onClick={()=>setOpen(true)}>Open layer</button>{open&&<div role="dialog">Layer</div>}</>;}
function App(){const path=usePathname();return <><nav style={{position:'fixed',top:0}}><button onClick={()=>navigate('/secret/b')}>Go B</button><Layer/></nav><Suspense fallback={<p role="status">Waiting for screen</p>}>{path==='/secret/b'?<B/>:<A/>}<ScreenReady token={navigationToken()}/></Suspense></>;}
createRoot(document.getElementById('root')).render(<App/>);`;
const result=await build({stdin:{contents:entry,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="root"></div><script>${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/secret`);await page.getByText('Page A',{exact:true}).waitFor();
 await page.evaluate(()=>scrollTo(0,1250));await page.waitForFunction(()=>scrollY===1250);
 await page.getByRole('button',{name:'Go B',exact:true}).click();await page.getByRole('status').waitFor();
 await page.evaluate(()=>window.releaseB());await page.getByText('Page B',{exact:true}).waitFor();await page.waitForFunction(()=>scrollY===0);
 await page.evaluate(()=>{scrollTo(0,930);window.delayA=true;});await page.waitForFunction(()=>scrollY===930);
 await page.goBack();await page.getByText('Page A',{exact:true}).waitFor();await page.waitForFunction(()=>scrollY===1250);
 await page.goForward();await page.getByText('Page B',{exact:true}).waitFor();await page.waitForFunction(()=>scrollY===930);await page.goBack();await page.getByText('Page A',{exact:true}).waitFor();await page.waitForFunction(()=>scrollY===1250);
 await page.getByRole('button',{name:'Open layer',exact:true}).click();await page.getByRole('dialog').waitFor();await page.goBack();await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>scrollY),1250,'Same-URL Gallery layer leaves route scroll alone');
 await page.goForward();await page.getByRole('dialog').waitFor({state:'detached'});
 // Leave same-URL layer history and replace into a real route without scrolling.
 await page.evaluate(()=>window.navigate('/secret/b',true,false));await page.getByText('Page B',{exact:true}).waitFor();await page.waitForFunction(()=>scrollY===1250);
 await page.evaluate(()=>scrollTo(0,650));await page.waitForFunction(()=>scrollY===650);
 await page.evaluate(()=>window.navigate('/secret'));await page.getByText('Page A',{exact:true}).waitFor();await page.waitForFunction(()=>scrollY===0);
 // Long restoration must yield to user input instead of snapping after later content growth.
 await page.waitForFunction(()=>document.documentElement.scrollHeight>=4000);await page.evaluate(()=>scrollTo(0,1700));await page.waitForFunction(()=>scrollY===1700);await page.evaluate(()=>window.navigate('/secret/b'));await page.getByText('Page B',{exact:true}).waitFor();
 await page.goBack();await page.getByText('Page A',{exact:true}).waitFor();await page.mouse.move(200,120);await page.mouse.down();await page.mouse.up();await page.waitForFunction(()=>document.documentElement.scrollHeight>=4000);assert.equal(await page.evaluate(()=>scrollY),0,'A user gesture cancels pending restoration before asynchronous growth');
 await page.evaluate(()=>{scrollTo(0,400);window.navigate('/secret');});await page.waitForFunction(()=>scrollY===0);
 assert.deepEqual(errors,[]);console.log('PASS: lazy destination commit, delayed local content, Back/Forward, same-URL Gallery history and scroll:false at a mobile viewport. No app build.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
