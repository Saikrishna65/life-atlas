import {Prisma} from '@prisma/client';
import {NextResponse} from 'next/server';
import prisma from '@/lib/prisma';
import {controlCloudFiles} from '@/lib/control-room/cloud-server';
import {authorizeTestReset,TEST_RESET_ID} from '@/lib/cloud-vault/reset-authorization';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 let stage="workflow identity";
 try{
  const body=await request.json();if(!await authorizeTestReset(request,body))return NextResponse.json({error:'An authorized Atlas test-reset workflow is required.'},{status:403});
  stage='reset receipt';
  const receiptKey=`atlas-system/resets/${TEST_RESET_ID}.json`,music=controlCloudFiles('music');
  if(await music.exists(receiptKey)){const receipt=JSON.parse(await(await music.download(receiptKey)).text());if(receipt.completed)return NextResponse.json({...receipt,alreadyCompleted:true});}
  if(body.action==='check')return NextResponse.json({authorized:true,resetId:TEST_RESET_ID});
  if(body.action!=='clear')return NextResponse.json({error:'Choose the authorized test reset action.'},{status:400});
  // Use the deployed catalog: old releases did not install every historical Prisma model.
  // Keep extension-owned tables, migration bookkeeping and the publishing identity.
  stage='app table inventory';
  const tables=await prisma.$queryRaw<{name:string}[]>`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relispartition AND c.relname NOT IN ('User','_prisma_migrations') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') ORDER BY c.relname`;
  const qualified=(name:string)=>Prisma.raw('"public"."'+name.replace(/"/g,'""')+'"');
  stage='app table reset';
  if(tables.length)await prisma.$transaction(async db=>{await db.$executeRaw(Prisma.sql`TRUNCATE TABLE ${Prisma.join(tables.map(t=>qualified(t.name)))} RESTART IDENTITY CASCADE`);},{timeout:30000,maxWait:10000});
  const removed:Record<string,number>={images:0,music:0};
  for(const bucket of ['images','music'] as const){stage='cloud files/'+bucket;const files=controlCloudFiles(bucket),keys:string[]=[];let cursor:string|undefined;do{const page=await files.list({limit:1000,cursor});keys.push(...page.items.filter(item=>!item.key.startsWith('atlas-system/')).map(item=>item.key));cursor=page.cursor;}while(cursor);for(let n=0;n<keys.length;n+=50){await files.delete(keys.slice(n,n+50));removed[bucket]+=Math.min(50,keys.length-n);}
   let remainingCursor:string|undefined;do{const remaining=await files.list({limit:1000,cursor:remainingCursor});if(remaining.items.some(item=>!item.key.startsWith('atlas-system/')))throw new Error('Some cloud files were not cleared.');remainingCursor=remaining.cursor;}while(remainingCursor);
  }
  stage='record verification';
  const counts=tables.length?await prisma.$queryRaw<{name:string;records:string}[]>(Prisma.join(tables.map(t=>Prisma.sql`SELECT ${t.name}::text AS name, COUNT(*)::text AS records FROM ${qualified(t.name)}`),' UNION ALL ')):[];
  if(counts.some(row=>Number(row.records)!==0))throw new Error('Reset validation failed.');
  const receipt={completed:true,resetId:TEST_RESET_ID,clearedAt:new Date().toISOString(),appRecordsAtReset:0,tablesCleared:tables.map(t=>t.name),removedFiles:removed,retained:'App schema, indexes, migration bookkeeping and publishing identity configuration'};
  stage='reset receipt write';
  await music.upload(receiptKey,JSON.stringify(receipt),{contentType:'application/json',cacheControl:'no-store'});
  return NextResponse.json(receipt);
 }catch(error){const code=error&&typeof error==='object'&&'code'in error?String(error.code):'RESET_FAILED';return NextResponse.json({error:`Test data reset did not finish at ${stage} (${code}). The authorized workflow may retry.`},{status:503});}
}
