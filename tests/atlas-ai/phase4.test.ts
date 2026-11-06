import assert from 'node:assert/strict';
import {test} from 'node:test';
import {VoiceSession} from '@/lib/atlas-ai/voice-session';
import {verifyStagedWrapper} from '@/lib/atlas-ai/key-wrapper';
test('canceled and superseded recognition callbacks cannot replace current input',()=>{const s=new VoiceSession(),old=s.begin();s.stop();assert.equal(s.accept(old),false);const current=s.begin();assert.equal(s.accept(old),false);assert.equal(s.accept(current),true);assert.equal(s.accept(undefined),false);});
test('wrapper recovery must verify existing ciphertext and cannot activate',async()=>{const key=new Uint8Array([1,2,3]);const wrapper={wrap:async(k:Uint8Array)=>k.slice(),unwrap:async(k:Uint8Array)=>k.slice()};const result=await verifyStagedWrapper(key,wrapper,async()=>true);assert.equal(result.activationAllowed,false);assert.deepEqual(key,new Uint8Array([1,2,3]));await assert.rejects(()=>verifyStagedWrapper(key,wrapper,async()=>false),/recovery/);await assert.rejects(()=>verifyStagedWrapper(key,{...wrapper,unwrap:async()=>{throw new Error('Biometric canceled');}},async()=>true),/canceled/);});
