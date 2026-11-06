import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canShowAtlasLauncher} from '@/lib/atlas-ai/visibility';
test('orb display is limited to private vault content and excludes security and keyboard states',()=>{
 for(const path of ['/secret','/secret/music','/secret/finance','/secret/vault/trip/plan'])assert.equal(canShowAtlasLauncher(path),true);
 for(const path of ['/','/secretly','/secret/atlas','/secret/unlock','/secret/auth','/secret/security'])assert.equal(canShowAtlasLauncher(path),false);
 assert.equal(canShowAtlasLauncher('/secret/music',true),false);assert.equal(canShowAtlasLauncher('/secret/finance',false,true),false);
});
