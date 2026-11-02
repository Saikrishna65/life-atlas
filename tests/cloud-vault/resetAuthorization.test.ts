import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {authorizeTestReset,TEST_RESET_ID} from '../../src/lib/cloud-vault/reset-authorization';
const sha='a'.repeat(40),body={runId:12345678,sha,resetId:TEST_RESET_ID},pair=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...pair.publicKey.export({format:'jwk'}),kid:'test-workflow-key'};
const keys=(async()=>Response.json({keys:[jwk]})) as typeof fetch;
function request(changes:Record<string,unknown>={},wrongKey=false){const now=Math.floor(Date.now()/1000),ref='refs/heads/build/atlas-offline-online-control-20261102';const header=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url');const claims=Buffer.from(JSON.stringify({iss:'https://token.actions.githubusercontent.com',aud:'atlas-test-reset',iat:now,nbf:now-1,exp:now+300,repository_id:'1388049350',repository_owner_id:'151373216',actor_id:'151373216',repository:'Saikrishna65/life-atlas',event_name:'push',ref,workflow_ref:'Saikrishna65/life-atlas/.github/workflows/offline-online-apk.yml@'+ref,sha,run_id:String(body.runId),...changes})).toString('base64url');const signature=sign('RSA-SHA256',Buffer.from(header+'.'+claims),wrongKey?generateKeyPairSync('rsa',{modulusLength:2048}).privateKey:pair.privateKey).toString('base64url');return new Request('https://atlas.example/api/admin/test-data-reset',{method:'POST',headers:{Authorization:'Bearer '+header+'.'+claims+'.'+signature}});}
test('cleanup accepts only GitHub-signed, recent owner workflow identities for this reset',async()=>{
 assert.equal(await authorizeTestReset(request(),body,keys),true);
 for(const change of [{ref:'refs/heads/main'},{sha:'b'.repeat(40)},{actor_id:'99'},{repository_id:'99'},{event_name:'pull_request'},{exp:1},{aud:'another-service'},{iss:'https://evil.example'},{run_id:'99999999'},{workflow_ref:'another-workflow'}])assert.equal(await authorizeTestReset(request(change),body,keys),false);
 assert.equal(await authorizeTestReset(request({},true),body,keys),false);assert.equal(await authorizeTestReset(request(),{...body,resetId:'another-reset'},keys),false);assert.equal(await authorizeTestReset(new Request('https://atlas.example'),body,keys),false);
});
