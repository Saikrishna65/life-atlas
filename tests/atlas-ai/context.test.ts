import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assembleLocalContext} from '@/lib/atlas-ai/context';
import {MODEL_CATALOGUE,requireCataloguedModel,validateModelEntry,requiredInstallBytes,modelDownloadUrl} from '@/lib/atlas-ai/model-catalogue';
import type {AtlasData} from '@/lib/atlas-ai/storage';
const at='2026-11-06T00:00:00Z';
const data:AtlasData={version:1,personality:{tone:'Calm',behavior:'Explain clearly'},memories:[{id:'selected',text:'Synthetic preference',createdAt:at,updatedAt:at},{id:'secret',text:'Unselected fact',createdAt:at,updatedAt:at}],conversations:[{id:'s',title:'Test',createdAt:at,updatedAt:at,messages:[{id:'1',role:'user',text:'Earlier question',at},{id:'2',role:'assistant',text:'Earlier answer',at},{id:'3',role:'notice',text:'PRIVATE ACTION RESULT',at},{id:'4',role:'user',text:'Latest question',at},{id:'5',role:'assistant',text:'Response to replace',at}]}]};
test('regeneration includes selected memory and latest question without prior answer or action receipts',()=>{
 const c=assembleLocalContext(data,'s',new Set(['selected']),true);
 assert.ok(c.prompt.includes('Latest question'));assert.ok(c.prompt.includes('Synthetic preference'));
 for(const excluded of ['Response to replace','PRIVATE ACTION RESULT','Unselected fact'])assert.ok(!c.prompt.includes(excluded));
 assert.deepEqual(c.memoryIds,['selected']);
});
test('context budget preserves newest message and fails explicitly for oversized selected memories',()=>{
 const d=structuredClone(data);d.conversations[0].messages[0].text='old'.repeat(1000);
 const c=assembleLocalContext(d,'s',new Set(),true,1000);
 assert.ok(c.prompt.length<=1000);assert.ok(c.omittedMessages>0);assert.ok(c.prompt.includes('Latest question'));
 d.memories[0].text='memory'.repeat(1000);assert.throws(()=>assembleLocalContext(d,'s',new Set(['selected']),true,1000),/memories/);
});
test('catalogue remains closed until evidence is verified; structural checks do not approve synthetic entries',()=>{
 assert.equal(MODEL_CATALOGUE.length,0);assert.throws(()=>requireCataloguedModel('unreviewed'),/disabled/);
 const synthetic={id:'synthetic-only',name:'Test',repository:'test/model',revision:'a'.repeat(40),filename:'test.gguf',sha256:'b'.repeat(64),bytes:1000,license:'test-only',licenseUrl:'https://example.invalid/license',contextTokens:1024};
 assert.ok(modelDownloadUrl(synthetic).includes('/'+synthetic.revision+'/'));assert.ok(requiredInstallBytes(synthetic)>2000);
 for(const change of [{revision:'main'},{sha256:'0'.repeat(64)},{filename:'../model.gguf'},{bytes:Infinity},{contextTokens:99999}])assert.throws(()=>validateModelEntry({...synthetic,...change}));
});
