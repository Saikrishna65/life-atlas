import {test} from 'node:test';import assert from 'node:assert/strict';
import {audioFormats,audioMime,audioFileAccept} from '../../src/lib/music/formats';
import {equalAudioBytes} from '../../src/lib/music/originals';
test('document providers with generic MIME types can import specialist audio extensions',()=>{
 assert.ok(Object.keys(audioFormats).length>=60);
 for(const name of ['song.FLAC','song.m4a','song.opus','song.aiff','song.wma','song.dsf','song.ape','song.mka','song.mod'])assert.ok(audioMime({name,type:'application/octet-stream'}),name);
 assert.ok(audioFileAccept.includes('.flac'));assert.equal(audioMime({name:'list.m3u',type:'text/plain'}),undefined);
 assert.equal(audioMime({name:'voice',type:'audio/amr'}),'audio/amr');
});
test('original comparison crosses chunk boundaries, ignoring neither tail bytes nor equal tags',async()=>{
 const a=new Uint8Array(1048576+43);a[a.length-1]=33;
 assert.equal(await equalAudioBytes(new Blob([a]),new Blob([a])),true);
 const b=a.slice();b[b.length-1]=34;
 assert.equal(await equalAudioBytes(new Blob([a]),new Blob([b])),false);
 assert.equal(await equalAudioBytes(new Blob([a]),new Blob([a.slice(0,-1)])),false);
});
