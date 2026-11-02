import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {authorizeAndroidSigning} from '../../src/lib/cloud-vault/signing-authorization';
const sha='a'.repeat(40),body={runId:12345678,sha},pair=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...pair.publicKey.export({format:'jwk'}),kid:'test-workflow-key'};
const keys=(async()=>Response.json({keys:[jwk]})) as typeof fetch;
function request(changes:Record<string,unknown>={},wrongKey=false){const now=Math.floor(Date.now()/1000),ref='refs/heads/build/atlas-offline-online-ideas-20261102';const header=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url');const claims=Buffer.from(JSON.stringify({iss:'https://token.actions.githubusercontent.com',aud:'atlas-android-signing',iat:now,nbf:now-1,exp:now+300,repository_id:'1388049350',repository_owner_id:'151373216',actor_id:'151373216',repository:'Saikrishna65/life-atlas',event_name:'push',ref,workflow_ref:'Saikrishna65/life-atlas/.github/workflows/offline-online-apk.yml@'+ref,sha,run_id:String(body.runId),...changes})).toString('base64url');const signature=sign('RSA-SHA256',Buffer.from(header+'.'+claims),wrongKey?generateKeyPairSync('rsa',{modulusLength:2048}).privateKey:pair.privateKey).toString('base64url');return new Request('https://atlas.example/api/admin/test-data-reset',{method:'POST',headers:{Authorization:'Bearer '+header+'.'+claims+'.'+signature}});}
test('signing identity accepts only GitHub-signed recent owner builds and rejects other actors or workflows',async()=>{
 assert.equal(await authorizeAndroidSigning(request(),body,keys),true);
 assert.equal(await authorizeAndroidSigning(request({event_name:'workflow_dispatch',ref:'refs/heads/main',workflow_ref:'Saikrishna65/life-atlas/.github/workflows/offline-online-apk.yml@refs/heads/main'}),body,keys),true);
 for(const change of [{ref:'refs/heads/main'},{sha:'b'.repeat(40)},{actor_id:'99'},{repository_id:'99'},{event_name:'pull_request'},{exp:1},{aud:'another-service'},{iss:'https://evil.example'},{run_id:'99999999'},{workflow_ref:'another-workflow'}])assert.equal(await authorizeAndroidSigning(request(change),body,keys),false);
 assert.equal(await authorizeAndroidSigning(request({},true),body,keys),false);assert.equal(await authorizeAndroidSigning(new Request('https://atlas.example'),body,keys),false);
});
