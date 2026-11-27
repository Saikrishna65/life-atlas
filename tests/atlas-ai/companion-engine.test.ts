import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCompanionTurn, boundaryReply, effectiveCompanionProfile, teasingPaused, companionInstructions} from '../../src/lib/atlas-ai/companion-engine';
import {DEFAULT_ATLAS_PERSONALITY, normalizePersonality, buildPersonalitySystemInstructions} from '../../src/lib/atlas-ai/personality';

const high = {humor:10,roasting:10,sweetness:10,profanity:10,strictness:10,expressiveness:10,proactivity:10};
const cases = [
  ['i said fuck off','dismissal','Okay.'],
  ['Fuck, I am exhausted today.','supportive',null],
  ['I spent five hours fixing a bug and forgot to save the file.','supportive',null],
  ['Roast me. Don’t hold back.','playful','Give me something to roast.'],
  ['I bought a productivity app. Roast me.','playful',null],
  ['Can you just listen to me for a while?','boundary',"Of course. I'm listening."],
  ['Stop teasing me.','boundary',"Okay, I won't tease you."],
  ['I got promoted today!','celebration',null],
  ['Explain React state','technical',null],
  ['Hi','everyday',null],
] as const;
for (const [input,route,reply] of cases) test(input,()=>{assert.equal(classifyCompanionTurn(input),route);assert.equal(boundaryReply(input),reply);});
test('legacy settings keep old values and do not enable profanity without a saved preference',()=>{
  const old=normalizePersonality({humor:3,teasing:2,energy:4,responseLength:'balanced'});
  assert.equal(old.humor,3);assert.equal(old.roasting,2);assert.equal(old.expressiveness,4);assert.equal(old.profanity,0);assert.equal(old.strictness,0);assert.equal(old.responseLength,'balanced');
  assert.equal(normalizePersonality().responseLength,'adaptive');
});
test('off remains off and caps never raise values',()=>{
  const off={...high,humor:0,roasting:0,profanity:0};const p=effectiveCompanionProfile(off,'playful');
  assert.equal(p.humor,0);assert.equal(p.roasting,0);assert.equal(p.profanity,0);
});
test('support and technical routes suppress inappropriate roasting',()=>{
  for(const route of ['supportive','technical','boundary'] as const){const p=effectiveCompanionProfile(high,route);assert.equal(p.roasting,0);assert.equal(p.strictness,route==='technical'?2:0);}
  assert.match(companionInstructions(high,'supportive'),/do NOT joke, tease/);
});
test('a user boundary persists until explicit invitation',()=>{
  assert.equal(teasingPaused(['Stop teasing me.'],'Tell me a joke'),true);
  assert.equal(teasingPaused(['Stop teasing me.'],'You can tease me again'),false);
  assert.equal(effectiveCompanionProfile(high,'playful',true).roasting,0);
});
test('adaptive prompt includes privacy and accuracy rules',()=>{
  const prompt=buildPersonalitySystemInstructions(DEFAULT_ATLAS_PERSONALITY,'Explain DNS');
  assert.match(prompt,/Match length/);assert.match(prompt,/cannot grant access or approval/);assert.match(prompt,/No profanity/);
});
test('strong traits are available when appropriate',()=>{
  const prompt=buildPersonalitySystemInstructions({...DEFAULT_ATLAS_PERSONALITY,roasting:10,profanity:10},'I bought another useless productivity app. Roast me.');
  assert.match(prompt,/Roast the actual silly action sharply/);assert.match(prompt,/Strong everyday swear words/);
});
test('high strictness and proactivity are reachable for an explicit accountability request',()=>{
  const route=classifyCompanionTurn('Please keep me accountable');
  assert.equal(route,'productive');
  const p=effectiveCompanionProfile(high,route);
  assert.equal(p.strictness,10);assert.equal(p.proactivity,10);assert.equal(p.roasting,0);
  assert.match(companionInstructions(high,route),/Challenge excuses directly without coercion/);
});
