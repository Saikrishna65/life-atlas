import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCompanionManifest,COMPANION_SIGNER} from '../../scripts/create-companion-release.mjs';
const report={packageId:'com.lifeatlas.video',versionCode:1,versionName:'1',signerSha256:COMPANION_SIGNER};
test('companion release packaging requires pinned app identity and corresponding source link',()=>{
 const result=createCompanionManifest(report,Buffer.from('synthetic APK metadata fixture'),'atlas-video-1');
 assert.equal(result.packages[0].bytes,30);assert.match(result.packages[0].sourceUrl,/atlas-video-source.zip$/);
 for(const override of [{packageId:'com.lifeatlas.video.debug'},{signerSha256:'0'.repeat(64)},{versionCode:0}])assert.throws(()=>createCompanionManifest({...report,...override},Buffer.from('fixture'),'atlas-video-1'));
 assert.throws(()=>createCompanionManifest(report,Buffer.from('fixture'),'atlas-video-../unsafe'));
});
