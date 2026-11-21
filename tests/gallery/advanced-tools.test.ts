import {test} from 'node:test';import assert from 'node:assert/strict';
import {editGeometry} from '../../src/lib/gallery/edit-geometry';import {originalRecipe} from '../../src/lib/gallery/media-tools';import {containRect} from '../../src/lib/gallery/viewer-motion';import {gallerySearchIntent} from '../../src/lib/gallery/search-intent';import {backupBadge} from '../../src/components/gallery/GalleryBackupBadge';import type {GalleryAsset} from '../../src/lib/gallery/types';
test('rotated crops and all allowed pan positions stay inside the original',()=>{
 for(const [width,height] of [[4000,3000],[3000,4000],[6000,1000]])for(const angle of [-100,-90,-10,0,10,90,100,180,270])for(const aspect of [0,1,3/4,16/9])for(const zoom of [1,2,3])for(const x of [0,.5,1])for(const y of [0,.5,1]){
  const g=editGeometry(width,height,{...originalRecipe,angle,aspect,zoom,x,y}),cos=Math.cos(g.angle),sin=Math.sin(g.angle);
  assert.ok(g.cropWidth>0&&g.cropHeight>0);
  for(const sx of [-1,1])for(const sy of [-1,1]){const px=g.centerX+cos*sx*g.cropWidth/2+sin*sy*g.cropHeight/2,py=g.centerY-sin*sx*g.cropWidth/2+cos*sy*g.cropHeight/2;assert.ok(px>=-.0001&&px<=width+.0001&&py>=-.0001&&py<=height+.0001,JSON.stringify({width,height,angle,aspect,zoom,x,y,px,py}));}
 }
});
test('gallery return animation starts at the actual contained media rectangle',()=>{assert.deepEqual(containRect({left:0,top:100,width:400,height:800},1600,800),{left:0,top:400,width:400,height:200});});
test('combined search uses confirmed identities, saved places and dates without guessing a person',()=>{
 const trips=[{id:'trip',title:'Himalayan journal',websitePlaces:[{id:'temple',name:'Tungnath'}]}] as Parameters<typeof gallerySearchIntent>[1];
 const query=gallerySearchIntent('photos with Rahul at Tungnath in November 2026',trips,new Date(2026,10,21),[{id:'rahul',name:'Rahul'}]);assert.equal(query.personId,'rahul');assert.equal(query.placeId,'temple');assert.equal(query.from,'2026-11-01');assert.equal(query.text,'');
 assert.equal(gallerySearchIntent('Rahul',trips,new Date(),[{id:'a',name:'Rahul'},{id:'b',name:'Rahul'}]).personId,undefined);
});
test('backup badges do not mistake a public copy or an unloaded phone file for a verified private backup',()=>{
 const a={id:'image:external:1',device:{copies:{public:{state:'verified'}}}} as unknown as GalleryAsset;assert.equal(backupBadge(a).state,'public');assert.equal(backupBadge({...a,device:{...a.device!,copies:{private:{state:'verified',checkedAt:1}}}}).state,'backed-up');
 assert.equal(backupBadge({id:'cloud',slot:'private'} as GalleryAsset).label,'Cloud copy');assert.equal(backupBadge({...a,device:{...a.device!,copies:{}}}).state,'unchecked');
});
