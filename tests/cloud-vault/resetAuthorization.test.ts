import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeTestReset,TEST_RESET_ID} from '../../src/lib/cloud-vault/reset-authorization';
const sha='a'.repeat(40),body={runId:12345678,sha,resetId:TEST_RESET_ID};
const request=(token=true)=>new Request('https://atlas.example/api/admin/test-data-reset',{method:'POST',headers:token?{Authorization:'Bearer '+'x'.repeat(40)}:{}});
function github(overrides:any={}){return (async(url:any)=>String(url).includes('/actions/runs/')?Response.json({repository:{id:1388049350},head_sha:sha,head_branch:'build/atlas-offline-online-control-20261102',path:'.github/workflows/offline-online-apk.yml',event:'push',status:'in_progress',actor:{login:'Saikrishna65'},created_at:new Date().toISOString(),...overrides}):Response.json({id:1388049350,permissions:{push:true}})) as typeof fetch;}
test('test cleanup requires an active owner workflow with a real write-capable GitHub identity',async()=>{
 assert.equal(await authorizeTestReset(request(),body,github()),true);
 for(const changes of [{head_branch:'main'},{head_sha:'b'.repeat(40)},{status:'completed'},{event:'pull_request'},{actor:{login:'someone-else'}},{created_at:'2020-01-01T00:00:00Z'}])assert.equal(await authorizeTestReset(request(),body,github(changes)),false);
 assert.equal(await authorizeTestReset(request(false),body,github()),false);assert.equal(await authorizeTestReset(request(),{...body,resetId:'another-reset'},github()),false);
 const readonly=(async(url:any)=>String(url).includes('/actions/runs/')?(github()(url)):Response.json({id:1388049350,permissions:{push:false}})) as typeof fetch;assert.equal(await authorizeTestReset(request(),body,readonly),false);
});
