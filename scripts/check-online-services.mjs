import fs from 'node:fs/promises';
const origin=process.env.NEXT_PUBLIC_MOBILE_API_ORIGIN||'https://life-atlas-eight-five.vercel.app';
async function check(path,options={}) {
 try {const response=await fetch(new URL(path,origin),{...options,signal:AbortSignal.timeout(25000)});const data=await response.json().catch(()=>null);return {status:response.status,data};}
 catch{return {status:0,data:null};}
}
const [music,control,studio]=await Promise.all([
 check('/api/music'),check('/api/control-room'),check('/api/mobile/studio',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://localhost','X-Capacitor-Platform':'android','X-Atlas-Studio':'1'},body:'{}'})
]);
const report={checkedAt:new Date().toISOString(),origin,
 music:{status:music.status,available:music.status===200&&music.data?.success===true},
 controlRoom:{status:control.status,database:control.data?.database?.status||'unavailable',buckets:(control.data?.buckets||[]).map(b=>({name:b.name,status:b.status}))},
 studio:{status:studio.status,available:studio.status===400&&studio.data?.error==='Invalid Studio entry.'},
 notes:'Read-only probes and invalid-payload validation only. Live YouTube extraction, AI credentials and phone-specific permissions still require testing. Finance ledger cloud synchronization remains unconfigured; encrypted cloud backups are available through Control Room when storage is connected.'};
await fs.mkdir('apk-download',{recursive:true});await fs.writeFile('apk-download/service-health.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
