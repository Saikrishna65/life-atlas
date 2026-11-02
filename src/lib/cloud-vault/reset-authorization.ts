export const TEST_RESET_ID='atlas-cloud-clean-20261102-v2';
export async function authorizeTestReset(request:Request,body:{runId?:unknown;sha?:unknown;resetId?:unknown},http:typeof fetch=fetch){
 const authorization=request.headers.get('authorization');
 if(!authorization?.startsWith('Bearer ')||authorization.length<30||body.resetId!==TEST_RESET_ID||!/^\d{6,20}$/.test(String(body.runId))||typeof body.sha!=='string'||!/^[a-f0-9]{40}$/.test(body.sha))return false;
 const headers={'Authorization':authorization,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 const [repoResponse,runResponse]=await Promise.all([http('https://api.github.com/repos/Saikrishna65/life-atlas',{headers}),http(`https://api.github.com/repos/Saikrishna65/life-atlas/actions/runs/${body.runId}`,{headers})]);
 if(!repoResponse.ok||!runResponse.ok)return false;const repo=await repoResponse.json(),run=await runResponse.json();
 return repo.id===1388049350&&repo.permissions?.push===true&&run.repository?.id===1388049350&&run.head_sha===body.sha&&run.head_branch?.startsWith('build/atlas-offline-online-control-')&&run.path==='.github/workflows/offline-online-apk.yml'&&run.event==='push'&&run.status==='in_progress'&&run.actor?.login==='Saikrishna65'&&Date.now()-new Date(run.created_at).getTime()<4*60*60*1000;
}
