import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {GET} from '../src/app/cloud-recovery/route';
import {cloudVaultAction,type VaultDependencies} from '../src/lib/cloud-vault/server';
import {vaultIdentity,newRecoveryCode,sha256} from '../src/lib/cloud-vault/codec';
import {allowAtlasMutation} from '../src/lib/mobileRequest';
const objects=new Map<string,Blob>();
const files={exists:async(key:string)=>objects.has(key),download:async(key:string)=>({text:()=>objects.get(key)!.text()}),upload:async(key:string,value:any)=>{objects.set(key,value instanceof Blob?value:new Blob([value]));},list:async({prefix}:any)=>({items:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key,size:objects.get(key)!.size}))})};
const deps={files,serialize:async(_id:string,fn:()=>Promise<unknown>)=>fn()} as unknown as VaultDependencies;
const code=newRecoveryCode(),identity=await vaultIdentity(code);const body=(action:string,extra:any={})=>({action,vaultId:identity.id,...extra});
await cloudVaultAction(body('create'),identity.token,deps);
const fileId=await sha256('test fixture'),ref={id:fileId,bytes:28};objects.set(`private-vault/${identity.id}/trips/objects/${fileId}`,new Blob([new Uint8Array(28)]));
const copy={revision:crypto.randomUUID(),sourceHash:await sha256('saved trips'),savedAt:new Date().toISOString(),records:1,bytes:100,chunks:[],manifest:[ref]};
await cloudVaultAction(body('commit',{section:'trips',baseRevision:null,copy}),identity.token,deps);
const server=createServer(async(req,res)=>{try{if(req.url==='/cloud-recovery'){const page=GET();for(const[key,value]of page.headers)res.setHeader(key,value);res.end(await page.text());return;}if(req.url==='/api/cloud-vault'&&req.method==='POST'){let input='';for await(const chunk of req)input+=chunk;const request=new Request(`http://${req.headers.host}${req.url}`,{method:'POST',headers:req.headers as Record<string,string>,body:input});assert.ok(allowAtlasMutation(request,'x-atlas-cloud'));const result=await cloudVaultAction(JSON.parse(input),request.headers.get('x-atlas-vault-token')!,deps);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;}res.writeHead(404).end();}catch(error:any){res.writeHead(error.status||503,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as any,origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});await page.goto(origin+'/cloud-recovery');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.getByLabel('Your Atlas recovery code').fill(code);await page.getByRole('button',{name:'Check cloud snapshot'}).click();await page.getByText('Cloud snapshot checked. Nothing has been changed.',{exact:true}).waitFor();
 const preserve=page.getByRole('button',{name:'Preserve cloud copy & allow local upload'});assert.equal(await preserve.isDisabled(),true);await page.getByRole('checkbox').check();assert.equal(await preserve.isDisabled(),false);await preserve.click();await page.getByText('Your previous cloud snapshot is preserved. Return to Atlas and tap Upload all. Your local records have not been changed.',{exact:true}).waitFor();
 assert.equal(Object.keys((await cloudVaultAction(body('status'),identity.token,deps) as any).account.sections).length,0);
 assert.equal((await cloudVaultAction(body('list-saved-copies'),identity.token,deps) as any).copies[0].sections.trips.revision,copy.revision);
 page.on('dialog',(dialog:any)=>dialog.accept());await page.getByRole('button',{name:'Make this snapshot active'}).click();await page.getByText(/The chosen cloud snapshot is active/).waitFor();assert.equal((await cloudVaultAction(body('status'),identity.token,deps) as any).account.sections.trips.revision,copy.revision);
 assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(await page.evaluate(async()=>await indexedDB.databases()),[]);assert.deepEqual(errors,[]);
 console.log('Recovery page passed at 320/390/768px: confirmation required, cloud copy preserved and reactivated; no local storage or database writes.');
}finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
