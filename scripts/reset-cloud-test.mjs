import fs from 'node:fs/promises';
const origin=process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN||'https://life-atlas-eight-five.vercel.app';
const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('The reset requires this workflow’s GitHub token.');
const response=await fetch(new URL('/api/admin/test-data-reset',origin),{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action:'clear',resetId:'atlas-cloud-clean-20261102-v2',runId:process.env.GITHUB_RUN_ID,sha:process.env.GITHUB_SHA}),signal:AbortSignal.timeout(120000)});
const receipt=await response.json();if(!response.ok||!receipt.completed)throw new Error(receipt.error||'The test database reset could not finish.');await fs.mkdir('apk-download',{recursive:true});await fs.writeFile('apk-download/clean-start.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
