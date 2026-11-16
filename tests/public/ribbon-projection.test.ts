import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectRibbonFrame as project} from '../../src/lib/public-trips/ribbon-projection';
test('ribbon grows gradually across neighbouring frames while retaining larger corners',()=>{
 for(const width of [390,1440,1920]) {
  const stride=width/(width<700?4.2:8);
  const edge=width/2/stride;
  const center=project(0,width).scale;
  assert.ok(project(edge,width).scale>center*1.2);
  for(let i=0;i<edge;i+=.05) {
   assert.ok(project(i+.05,width).scale>=project(i,width).scale);
   assert.ok(Math.abs(project(i+.01,width).scale-project(i,width).scale)<.01);
   assert.ok(project(i+1,width).scale/project(i,width).scale<1.18,'Adjacent frames avoid sudden height changes');
   assert.equal(project(-i,width).scale,project(i,width).scale);
  }
 }
});
