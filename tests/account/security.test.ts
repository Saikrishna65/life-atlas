import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seal,unseal,verifiedOwner,accountId,readSession,mutationAllowed,SESSION_COOKIE} from '../../src/lib/account/security';

test('account escrow is authenticated and bound to its subject and purpose',()=>{
 const key=randomBytes(32), code='private-test-material';
 const encrypted=seal({code},'recovery:owner-a',key);
 assert.equal(encrypted.includes(code),false);
 assert.deepEqual(unseal(encrypted,'recovery:owner-a',key),{code});
 assert.throws(()=>unseal(encrypted,'recovery:owner-b',key));
 assert.throws(()=>unseal(encrypted,'session',key));
 assert.throws(()=>unseal(encrypted,'recovery:owner-a',randomBytes(32)));
 const data=Buffer.from(encrypted,'base64url');data[data.length-1]^=1;
 assert.throws(()=>unseal(data.toString('base64url'),'recovery:owner-a',key));
});
test('only the configured verified Google identity is admitted',()=>{
 assert.equal(verifiedOwner({sub:'123',email:'Owner@example.com',email_verified:true},'owner@example.com'),true);
 for(const profile of [{sub:'123',email:'other@example.com',email_verified:true},{sub:'123',email:'owner@example.com',email_verified:false},{sub:'123',email:'owner@example.com',email_verified:'true'},{email:'owner@example.com',email_verified:true}])assert.equal(verifiedOwner(profile,'owner@example.com'),false);
 assert.notEqual(accountId('123'),accountId('456'));
});
test('sessions expire, reject tampering and require same-origin mutations',()=>{
 const variables=['ATLAS_ACCOUNT_ORIGIN','ATLAS_ACCOUNT_MASTER_KEY','ATLAS_GOOGLE_CLIENT_ID','ATLAS_GOOGLE_CLIENT_SECRET','ATLAS_ACCOUNT_EMAIL'];
 const old=Object.fromEntries(variables.map(k=>[k,process.env[k]]));
 const key=randomBytes(32);
 Object.assign(process.env,{ATLAS_ACCOUNT_ORIGIN:'https://atlas.example',ATLAS_ACCOUNT_MASTER_KEY:key.toString('hex'),ATLAS_GOOGLE_CLIENT_ID:'test',ATLAS_GOOGLE_CLIENT_SECRET:'test',ATLAS_ACCOUNT_EMAIL:'owner@example.com'});
 try{
  const request=(session:unknown)=>new Request('https://atlas.example/api/account/status',{headers:{cookie:`${SESSION_COOKIE}=${seal(session,'session',key)}`}});
  assert.equal(readSession(request({sub:'123',email:'owner@example.com',expires:Date.now()+10000}))?.sub,'123');
  assert.equal(readSession(request({sub:'123',email:'owner@example.com',expires:Date.now()-1})),null);
  assert.equal(readSession(request({sub:'123',email:'other@example.com',expires:Date.now()+10000})),null);
  assert.equal(readSession(new Request('https://atlas.example')),null);
  assert.equal(mutationAllowed(new Request('https://atlas.example',{headers:{Origin:'https://evil.example','X-Atlas-Account':'1'}})),false);
  assert.equal(mutationAllowed(new Request('https://atlas.example',{headers:{Origin:'https://atlas.example','X-Atlas-Account':'1'}})),true);
 }finally{for(const name of variables){if(old[name]===undefined)delete process.env[name];else process.env[name]=old[name];}}
});
