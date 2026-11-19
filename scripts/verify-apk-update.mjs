import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Public certificate of the published 1.4.4 stable Vault and Next builds. Never a key.
export const publishedCertificate = '2f19571f9d6a4a3b4c7250397b7618f04e047beeeaa0023713e2a6c0a745af7d';

export function verifyUpdate(certs, badging, expectedPackage, freshInstallCertificate) {
  if(freshInstallCertificate && !/^[a-f0-9]{64}$/.test(freshInstallCertificate))throw new Error('Invalid preserved certificate.');
  const signers = [...certs.matchAll(/^Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})$/gm)];
  if (signers.length !== 1 || signers[0][1] !== (freshInstallCertificate || publishedCertificate)) {
    throw new Error('Signing certificate does not match the published app. APK must not be offered as an update.');
  }
  const identity = badging.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
  if (!identity || identity[1] !== expectedPackage || Number(identity[2]) <= 24) {
    throw new Error('Wrong package or non-increasing version code.');
  }
  return {packageId: identity[1], versionCode: Number(identity[2]), versionName: identity[3], certificateSha256: signers[0][1], compatibleWithPublishedVersion: signers[0][1] === publishedCertificate ? '1.6.0' : null, installMode: freshInstallCertificate ? 'fresh-install' : 'update'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = process.argv[2] || 'apk-download';
  const tools = path.join(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '', 'build-tools', '34.0.0');
  const reports = [ ['atlas-offline-online.apk', 'com.lifeatlas.app'], ['atlas-next.apk', 'com.lifeatlas.app.next'] ].map(([file, packageId]) => {
    const apk = path.join(directory, file);
    const certs = execFileSync(path.join(tools, 'apksigner'), ['verify', '--print-certs', apk], {encoding: 'utf8'});
    const badging = execFileSync(path.join(tools, 'aapt'), ['dump', 'badging', apk], {encoding: 'utf8'});
    const fresh = process.argv.includes('--fresh-install');
    if(fresh && !process.env.ATLAS_SIGNING_CERT_SHA256)throw new Error('Fresh installs must use the preserved signing identity.');
    return {file, ...verifyUpdate(certs, badging, packageId, fresh ? process.env.ATLAS_SIGNING_CERT_SHA256 : undefined)};
  });
  writeFileSync(path.join(directory, 'signing-compatibility.json'), JSON.stringify({buildSha: process.env.GITHUB_SHA || null, reports, warning: 'Earlier builds or locally signed APKs may have another certificate. Never uninstall an app containing unsaved data to bypass an install conflict.'}, null, 2));
  console.log('Both APKs verified against the published signing certificate and package identities.');
}
