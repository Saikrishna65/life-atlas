import {build} from 'esbuild';import {createRequire} from 'node:module';import {createServer} from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
// Real UI and status selectors, synthetic bridge only: no credentials, network uploads or private records.
const mock=`
export function nativeR2Available(){return true}
export function bytes(n=0){return n+' B'}
export function storageError(){return 'Safe synthetic failure'}
export async function systemAction(action){return action()}
export const R2={setSensitiveScreen:async()=>{},getConfigurationSummary:async()=>({supported:true,hardwareBacked:false,recoveryVerified:false,keyId:'',public:{configured:false,bucket:'life-atlas-public'},private:{configured:false,bucket:'life-atlas-private'}}),getTransferProgress:async()=>({transfers:window.fixture.jobs}),recoverTripUploads:async()=>{window.fixture.recoveries++;window.fixture.jobs[0].canRecover=false;window.fixture.jobs[0].workerState='ENQUEUED';return {recovered:1}}};`;
const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Storage from './src/components/cloud-storage/CloudStorage';createRoot(document.getElementById('root')).render(<Storage/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'synthetic-bridge',setup(b){b.onResolve({filter:/^@\/lib\/r2\/native$/},()=>({path:'native',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js'}));}}]});
const base={slot:'public',key:'galleries/file',mimeType:'video/mp4',direction:'upload',createdAt:0,totalBytes:110,uploadedBytes:110};
const fixture={recoveries:0,jobs:[{...base,id:'lost',name:'lost.mp4',status:'uploading',workerState:'MISSING',canRecover:true},{...base,id:'running',name:'verifying.mp4',status:'verifying',workerState:'RUNNING',verifiedBytes:40,verificationTotalBytes:110},{...base,id:'retry',name:'retry.mp4',status:'queued',workerState:'ENQUEUED',retryScheduled:true,attempts:2,nextAttemptAt:Date.now()+60000}]};
const css=await readFile('src/components/cloud-storage/cloud-storage.css','utf8');
const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}*{box-sizing:border-box}${css}</style><div id="root"></div><script>window.fixture=${JSON.stringify(fixture)}</script><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:/^Transfers/}).click();
 const rows=page.locator('.r2-transfers article');await rows.nth(2).waitFor();assert.match(await rows.first().innerText(),/verifying.mp4/);assert.equal(await rows.first().locator('progress').getAttribute('value'),'40');
 assert.match(await page.locator('.r2-transfers').innerText(),/No active Android job/);assert.match(await page.locator('.r2-transfers').innerText(),/automatic retry/);
 await page.getByRole('button',{name:'Resume approved uploads',exact:true}).click();await page.getByText('1 stopped uploads restored using their saved files.').waitFor();
 assert.equal(await page.evaluate(()=>fixture.recoveries),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await mkdir('work/qa-queue-1412',{recursive:true});await page.screenshot({path:'work/qa-queue-1412/transfers-mobile.png',fullPage:true});console.log('PASS mobile queue: running file first, separate checksum progress, missing-job guidance, Android retry status, recovery action and count, no browser errors (synthetic bridge).');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
