import { test } from 'node:test';
import assert from 'node:assert/strict';
import {defaultBackup, validateBackupSettings, importProgress} from '../../src/lib/gallery/library';
test('private backup is opt in and preserves conservative network defaults',()=>{
 assert.equal(defaultBackup.enabled,false);assert.equal(defaultBackup.wifiOnly,true);assert.equal(defaultBackup.videoPreviews,false);assert.deepEqual(defaultBackup.albums,[]);
});
test('backup setup requires an explicit media choice and selected albums',()=>{
 assert.throws(()=>validateBackupSettings({...defaultBackup,photos:false,videos:false}),/Choose photos/);
 assert.throws(()=>validateBackupSettings({...defaultBackup,enabled:true}),/Select at least/);
 assert.equal(validateBackupSettings({...defaultBackup,enabled:true,albums:['primary:camera']}).enabled,true);
});
test('import does not invent completion percentages or imply cloud publication',()=>{
 assert.equal(importProgress({id:'a',name:'Takeout.zip',status:'selected',files:0}),'selected');
 assert.equal(importProgress({id:'a',name:'Takeout.zip',status:'running',files:5,currentFile:'Beach.jpg'}),'Beach.jpg · 5 processed');
 assert.equal(importProgress({id:'a',name:'Takeout.zip',status:'complete',files:12}),'12 media entries processed');
});
