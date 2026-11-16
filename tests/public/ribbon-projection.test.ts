import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectRibbonFrame as project} from '../../src/lib/public-trips/ribbon-projection';
test('ribbon matches the approved pre-enlargement geometry on desktop and mobile',()=>{
 for(const [width,position,x] of [[1460,3.65,839.5],[380,1.9,218.5]]) {
  assert.deepEqual(project(0,width),{x:0,angle:-0,scale:.88});
  const edge=project(position,width);
  assert.ok(Math.abs(edge.x-x)<.0001);
  assert.ok(Math.abs(edge.angle+32)<.0001);
  assert.ok(Math.abs(edge.scale-1.52)<.0001);
  assert.equal(project(-position,width).scale,edge.scale);
 }
});
