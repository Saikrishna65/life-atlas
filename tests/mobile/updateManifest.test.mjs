import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createUpdateManifest} from '../../scripts/create-update-manifest.mjs';
const bytes=Buffer.from('synthetic apk fixture');
const report={packageId:'com.lifeatlas.app.next',versionCode:35,versionName:'2.1.0'};
test('catalog advertises actual bytes and correct retained package',()=>{
 const value=createUpdateManifest([report],{'atlas.apk':bytes},'atlas-install-update-123','New release');
 assert.equal(value.packages[0].sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(value.packages[0].bytes,bytes.length);
 assert.match(value.packages[0].url,/atlas-install-update-123\/atlas.apk$/);
 assert.equal(value.packages[0].packageId,report.packageId);
});
test('unknown identities, duplicate packages, absent APKs and invalid tags fail closed',()=>{
 for(const reports of [[{...report,packageId:'evil'}],[report,report],[{...report,versionCode:1}]])assert.throws(()=>createUpdateManifest(reports,{'atlas.apk':bytes},'atlas-install-update-123',''));
 assert.throws(()=>createUpdateManifest([report],{},'atlas-install-update-123',''));
 assert.throws(()=>createUpdateManifest([report],{'atlas.apk':bytes},'../../evil',''));
});
