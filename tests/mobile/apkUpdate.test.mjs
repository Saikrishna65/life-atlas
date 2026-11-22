import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {publishedCertificate, verifyUpdate} from '../../scripts/verify-apk-update.mjs';

const certificate = `Signer #1 certificate SHA-256 digest: ${publishedCertificate}`;
const metadata = (id = 'com.lifeatlas.app', version = 41) => `package: name='${id}' versionCode='${version}' versionName='2.2.5'`;
test('published signer can update matching Vault and Next package identities', () => {
  for (const id of ['com.lifeatlas.app', 'com.lifeatlas.app.next']) assert.equal(verifyUpdate(certificate, metadata(id), id).versionCode, 41);
});
test('local debug signer and additional signers fail closed', () => {
  assert.throws(() => verifyUpdate(certificate.replace(publishedCertificate, 'a'.repeat(64)), metadata(), 'com.lifeatlas.app'), /certificate/);
  assert.throws(() => verifyUpdate(certificate + '\n' + certificate.replace('#1', '#2'), metadata(), 'com.lifeatlas.app'), /certificate/);
});
test('package mismatch and downgrades cannot be distributed as compatible updates', () => {
  assert.throws(() => verifyUpdate(certificate, metadata('com.lifeatlas.app.next'), 'com.lifeatlas.app'), /package/);
  for (const version of [8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]) assert.throws(() => verifyUpdate(certificate, metadata('com.lifeatlas.app', version), 'com.lifeatlas.app'), /version/);
});
test('fresh install checks the preserved key without claiming compatibility with old releases', () => {
  const preserved = 'b'.repeat(64);
  const certs = certificate.replace(publishedCertificate, preserved);
  const result = verifyUpdate(certs, metadata(), 'com.lifeatlas.app', preserved);
  assert.equal(result.installMode, 'fresh-install');
  assert.equal(result.compatibleWithPublishedVersion, null);
  assert.throws(() => verifyUpdate(certs, metadata(), 'com.lifeatlas.app'), /certificate/);
  assert.throws(() => verifyUpdate(certs, metadata(), 'com.lifeatlas.app', 'a'.repeat(64)), /certificate/);
  assert.throws(() => verifyUpdate(certs, metadata(), 'com.lifeatlas.app', 'invalid'), /Invalid/);
});
test('missing preserved key stops an update without initializing a new identity', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'atlas-signing-test-'));
  const mock = `globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://identity.invalid/')) return Response.json({value:'test-only'});
    if (JSON.parse(options.body).action !== 'load') throw Error('Unexpected signing write');
    return Response.json({error:'SIGNING_KEY_NOT_INITIALIZED'}, {status:404});
  };`;
  try {
    const result = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(mock), 'scripts/prepare-signing.mjs', '--require-existing'], {
      encoding: 'utf8', env: {...process.env, HOME: home, ACTIONS_ID_TOKEN_REQUEST_URL: 'https://identity.invalid/token', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'test-only'},
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No replacement key was created/);
    assert.equal(existsSync(path.join(home, '.android', 'debug.keystore')), false);
  } finally { rmSync(home, {recursive:true, force:true}); }
});
