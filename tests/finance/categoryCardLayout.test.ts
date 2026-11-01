import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categoryCardLayouts} from '../../src/lib/finance/categoryCardLayout';
test('the category composition has wide, tall and regular tiles',()=>{const slots=categoryCardLayouts(11);assert.equal(slots.length,11);for(const kind of ['wide','tall','regular'])assert.ok(slots.includes(kind as typeof slots[number]));});
test('two-column compositions finish complete rows without holes',()=>{
 for(let count=1;count<=40;count++){
  const slots=categoryCardLayouts(count),occupied=new Set<number>();let cursor=0;
  for(const kind of slots){const columns=kind==='wide'?2:1,rows=kind==='tall'?2:1;let position=cursor;
   for(;;position++){if(position%2+columns>2)continue;let fits=true;for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)if(occupied.has(position+row*2+col))fits=false;if(fits)break;}
   for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)occupied.add(position+row*2+col);cursor=position+columns;
  }
  const last=Math.max(...occupied);for(let i=0;i<=last;i++)assert.ok(occupied.has(i),`Gap at ${i} for ${count} cards`);assert.equal((last+1)%2,0);
 }
});
