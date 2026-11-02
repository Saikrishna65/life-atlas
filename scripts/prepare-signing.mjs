import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const origin=process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN||'https://life-atlas-eight-five.vercel.app';
const identityUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,identityToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if(!identityUrl||!identityToken)throw Error('The signing step requires this build’s GitHub identity.');
async function token(){const url=new URL(identityUrl);url.searchParams.set('audience','atlas-android-signing');const response=await fetch(url,{headers:{Authorization:`Bearer ${identityToken}`}});if(!response.ok)throw Error('Could not obtain a build identity.');return (await response.json()).value;}
async function request(action,extra={}){return fetch(origin+'/api/admin/android-signing',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await token()},body:JSON.stringify({action,runId:process.env.GITHUB_RUN_ID,sha:process.env.GITHUB_SHA,...extra}),signal:AbortSignal.timeout(60000)});}
const directory=path.join(os.homedir(),'.android'),destination=path.join(directory,'debug.keystore'),temporary=path.join(os.tmpdir(),'atlas-new-signing.keystore');await fs.mkdir(directory,{recursive:true});
let response=await request('load');
if(response.status===404&&(await response.clone().json().catch(()=>null))?.error==='SIGNING_KEY_NOT_INITIALIZED'){
 await fs.rm(temporary,{force:true});const generated=spawnSync('keytool',['-genkeypair','-keystore',temporary,'-storepass','android','-alias','androiddebugkey','-keypass','android','-storetype','JKS','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Atlas Stable Builds, O=Atlas, C=IN'],{encoding:'utf8'});if(generated.status!==0)throw Error('Could not create the signing identity.');
 const initialized=await request('initialize',{keystore:(await fs.readFile(temporary)).toString('base64')});if(!initialized.ok)throw Error('Could not preserve the signing identity.');response=await request('load');await fs.rm(temporary,{force:true});
}
if(!response.ok)throw Error('Could not load the signing identity. Build stopped to avoid an incompatible APK.');
const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<1000||bytes.length>16000)throw Error('Invalid signing identity response.');await fs.writeFile(destination,bytes,{mode:0o600});await fs.chmod(destination,0o600);
const checked=spawnSync('keytool',['-list','-keystore',destination,'-storepass','android','-alias','androiddebugkey'],{encoding:'utf8'});if(checked.status!==0)throw Error('The preserved signing identity could not be verified.');
const again=await request('load');if(!again.ok||!bytes.equals(Buffer.from(await again.arrayBuffer())))throw Error('Signing identity changed during preparation.');
console.log('Stable Android signing identity ready. Key material stays private and is excluded from APK artifacts.');
