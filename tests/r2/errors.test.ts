import test from "node:test";
import assert from "node:assert/strict";
import {storageError} from "../../src/lib/r2/errors";

test("known native transport failures show actionable safe diagnostics", () => {
  for(const code of ["R2_SIGNING_FAILED", "R2_REQUEST_REJECTED", "R2_REQUEST_FAILED", "TLS_CONNECTION_FAILED", "CLOCK_SKEW", "STORAGE_OPERATION_FAILED"]){
    assert.match(storageError({code, message:"secret must never render"}), new RegExp(code));
    assert.doesNotMatch(storageError({code, message:"secret must never render"}), /secret must never/);
  }
  assert.match(storageError({message:"AUTHENTICATION_FAILED"}), /rejected the credentials/);
  assert.match(storageError("PERMISSION_DENIED"), /read\/write/);
});

test("unrecognized bridge messages and object prototype names never leak or render", () => {
  const fallback=storageError(null);
  for(const error of [{code:"secret-access-key", message:"https://signed.invalid/?token=private"}, {message:"SDK failure: private-key"}, "private-key", {code:"toString"}, {code:"constructor"}]){
    assert.equal(storageError(error), fallback);
  }
});

test('catalog conflicts explain saved-selection recovery without recommending a reset',()=>{
 const message=storageError({code:'CATALOG_CONFLICT'});assert.match(message,/selected photos and completed uploads are saved/);assert.match(message,/do not reselect or delete/);assert.doesNotMatch(message,/Refresh and publish/);
});
