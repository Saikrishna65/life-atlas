/** Prepare local release files only. Does not build, publish, push or upload anything. */
import {readFileSync,writeFileSync,copyFileSync,mkdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export const COMPANION_SIGNER='f396d14bbd2076769e0edb46a3a8c4a4d4d45b57ae90a0ddd70e226e65d2d36f';
export function createCompanionManifest(report,apk,tag,notes=''){
 if(!/^atlas-video-[A-Za-z0-9._-]+$/.test(tag)||tag.includes('..'))throw Error('Invalid release tag');
 if(report.packageId!=='com.lifeatlas.video'||report.signerSha256!==COMPANION_SIGNER||!Number.isSafeInteger(report.versionCode)||report.versionCode<1||report.versionCode>2147483647||typeof report.versionName!=='string'||!report.versionName.length||report.versionName.length>80)throw Error('Untrusted APK identity');
 if(!apk?.length||apk.length>300*1048576)throw Error('Invalid APK size');
 const base=`https://github.com/Saikrishna65/life-atlas/releases/download/${tag}/`;
 return {schemaVersion:1,notes:notes.slice(0,4000),packages:[{...report,bytes:apk.length,sha256:createHash('sha256').update(apk).digest('hex'),url:base+'atlas-video.apk',sourceUrl:base+'atlas-video-source.zip',license:'GPL-3.0-or-later'}]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [apk,source,tag,out='companion-release']=process.argv.slice(2);
 if(!apk||!source||!tag)throw Error('Usage: node scripts/create-companion-release.mjs signed.apk corresponding-source.zip atlas-video-VERSION [output-directory]');
 const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
 const aapt=process.env.AAPT||(sdk&&path.join(sdk,'build-tools','34.0.0',process.platform==='win32'?'aapt.exe':'aapt'));
 const apksigner=process.env.APKSIGNER||(sdk&&path.join(sdk,'build-tools','34.0.0','lib','apksigner.jar'));
 if(!aapt||!apksigner)throw Error('Set AAPT and APKSIGNER to Android SDK tools');
 // Verification happens before any files are advertised. No private key is read by this script.
 const java=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
 const signer=apksigner.endsWith('.jar')?execFileSync(java,['-jar',apksigner,'verify','--print-certs',apk],{encoding:'utf8'}):execFileSync(apksigner,['verify','--print-certs',apk],{encoding:'utf8'});
 const fingerprints=[...signer.matchAll(/Signer #\d+ certificate SHA-256 digest: ([a-f0-9]+)/gi)].map(m=>m[1].toLowerCase());
 if(fingerprints.length!==1||fingerprints[0]!==COMPANION_SIGNER)throw Error('APK must use the pinned Atlas signing certificate');
 const badging=execFileSync(aapt,['dump','badging',apk],{encoding:'utf8'});
 const packageId=badging.match(/package: name='([^']+)'/)?.[1],versionCode=Number(badging.match(/versionCode='(\d+)'/)?.[1]),versionName=badging.match(/versionName='([^']+)'/)?.[1];
 if(statSync(source).size<32||!readFileSync(source).subarray(0,2).equals(Buffer.from('PK')))throw Error('Supply the corresponding complete source ZIP');
 const manifest=createCompanionManifest({packageId,versionCode,versionName,signerSha256:COMPANION_SIGNER},readFileSync(apk),tag);
 mkdirSync(out,{recursive:true});copyFileSync(apk,path.join(out,'atlas-video.apk'));copyFileSync(source,path.join(out,'atlas-video-source.zip'));writeFileSync(path.join(out,'atlas-apps.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(`Prepared ${out}. Review and publish these three files in release ${tag}; nothing has been uploaded.`);
}
