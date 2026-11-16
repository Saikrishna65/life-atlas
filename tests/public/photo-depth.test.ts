import {test} from 'node:test';
import assert from 'node:assert/strict';
import {depthPose,selectDepthPhotos,depthSamples} from '../../src/lib/public-trips/photo-depth';

test('public photos take priority, films are excluded and sources are unique',()=>{
 const photo={...depthSamples[0],id:'public',sample:false};
 assert.deepEqual(selectDepthPhotos([photo,photo,{...photo,kind:'film'}]),[photo]);
 assert.ok(selectDepthPhotos([]).length>=6);
});
test('the passage begins with three photos and ends on one settled image',()=>{
 assert.equal(Array.from({length:27},(_,i)=>depthPose(i,0,1440,900,false)).filter(p=>p.opacity>0).length,3);
 const ending=Array.from({length:27},(_,i)=>depthPose(i,1,1440,900,false));
 assert.equal(ending.filter(p=>p.opacity>0).length,1);
 assert.ok([ending[13].x,ending[13].y,ending[13].z,ending[13].rx,ending[13].ry].every(n=>Math.abs(n)<.0001));
});
test('all camera poses stay finite and opacity bounded across desktop and mobile',()=>{
 for(const mobile of [false,true]) for(let step=0;step<=100;step++) for(let i=0;i<27;i++){
  const pose=depthPose(i,step/100,mobile?390:1440,mobile?844:900,mobile);
  assert.ok(Object.values(pose).every(Number.isFinite));
  assert.ok(pose.opacity>=0&&pose.opacity<=1);
 }
});
