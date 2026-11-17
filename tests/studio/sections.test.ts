import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateSection,automaticSections,publicAsset,orderedSelection} from '../../src/lib/studio/sections';
const photo={id:'photo-1',kind:'photo',src:'https://media.example/portrait.webp',title:'Friends'};
test('People accepts only explicitly chosen photos, with a fixed eight-photo composition',()=>{
 assert.equal(validateSection('people',{mode:'curated',items:[photo]}).items.length,1);
 assert.throws(()=>validateSection('people',{mode:'curated',items:[{...photo,kind:'video'}]}));
 assert.throws(()=>validateSection('people',{mode:'curated',items:Array.from({length:9},(_,index)=>({...photo,id:`p${index}`}))}));
 assert.throws(()=>validateSection('people',{mode:'curated',items:[photo,photo]}));
 assert.throws(()=>validateSection('people',{mode:'curated',items:[photo,{...photo,id:'same-source'}]}));
});
test('empty curated collections stay empty; resetting to defaults discards stale selection without deleting media',()=>{
 assert.deepEqual(validateSection('people',{mode:'curated',items:[]}),{mode:'curated',items:[]});
 assert.deepEqual(validateSection('ribbon',{mode:'curated',items:[]}),{mode:'curated',items:[]});
 assert.deepEqual(validateSection('people',{mode:'automatic',items:[photo]}),{mode:'automatic',items:[]});
 assert.equal(automaticSections().people.revision,0);
});
test('ribbon supports mixed media while hero/archive require ordered published-trip identifiers',()=>{
 assert.equal(validateSection('ribbon',{mode:'curated',items:[photo,{...photo,id:'video',kind:'video',src:'https://media.example/film.mp4'}]}).items.length,2);
 assert.throws(()=>validateSection('hero',{mode:'curated',items:[]}));assert.throws(()=>validateSection('hero',{mode:'curated',items:[photo]}));
 assert.equal(validateSection('hero',{mode:'curated',items:[{id:'trip-a',kind:'trip',title:'A journey',tripSlug:'my-journey'}]}).items[0].tripSlug,'my-journey');
 assert.deepEqual(orderedSelection([{slug:'a'},{slug:'b'}],['b','missing','a'],item=>item.slug),[{slug:'b'},{slug:'a'}]);
});
test('private endpoints, secret-bearing URLs, traversal, inline originals and malformed URLs cannot enter public settings',()=>{
 for(const url of ['/images/people/stock-friends.webp','/api/public/studio-photo/photo-a?width=480','https://cdn.example/people/a.webp'])assert.equal(publicAsset(url),true,url);
 for(const url of ['data:image/jpeg;base64,a','blob:x','javascript:alert(1)','/secret/vault','/api/control-room/file?key=x','/images/../secret','/images/%E0%A4','https://u:secret@cdn.example/a.jpg','https://cdn.example/a.jpg?X-Amz-Signature=x','https://x.r2.cloudflarestorage.com/secret/a','https://cdn.example/encrypted/photos/a'])assert.equal(publicAsset(url),false,url);
});
