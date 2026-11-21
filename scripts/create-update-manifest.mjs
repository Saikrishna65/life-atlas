import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function createUpdateManifest(reports, files, tag, notes) {
  if(!/^atlas-install-update-\d+$/.test(tag))throw Error('Unexpected release tag');
  const seen=new Set();
  return {schemaVersion:1,notes:notes.slice(0,4000),packages:reports.map(report=>{
    if(!['com.lifeatlas.app','com.lifeatlas.app.next'].includes(report.packageId)||seen.has(report.packageId)||!Number.isSafeInteger(report.versionCode)||report.versionCode<35)throw Error('Invalid update identity');
    seen.add(report.packageId);
    const file=report.packageId==='com.lifeatlas.app.next'?'atlas.apk':'atlas-offline-online.apk';
    const bytes=files[file];if(!bytes?.length||bytes.length>300*1024*1024)throw Error('Invalid APK size');
    return {packageId:report.packageId,versionCode:report.versionCode,versionName:report.versionName,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),url:`https://github.com/Saikrishna65/life-atlas/releases/download/${tag}/${file}`};
  })};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const dir=process.argv[2]||'apk-download',tag=process.argv[3];
  const report=JSON.parse(readFileSync(path.join(dir,'signing-compatibility.json'),'utf8'));
  if(report.reports.some(item=>item.installMode!=='update'))throw Error('Do not advertise fresh installs as in-app updates');
  const manifest=createUpdateManifest(report.reports,Object.fromEntries(['atlas.apk','atlas-offline-online.apk'].map(file=>[file,readFileSync(path.join(dir,file))])),tag,readFileSync('mobile/RELEASE-NOTES.txt','utf8'));
  writeFileSync(path.join(dir,'atlas-update.json'),JSON.stringify(manifest,null,2));
}
