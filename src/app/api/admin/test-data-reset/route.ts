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
  // Clear only this app's known data tables. Schema, indexes and migrations remain installed.
  stage='app records';
  await prisma.$transaction(async db=>{
   await db.timelineEvent.deleteMany();await db.photo.deleteMany();await db.foodExperience.deleteMany();await db.movie.deleteMany();await db.experience.deleteMany();await db.tripPlace.deleteMany();await db.tripDay.deleteMany();await db.memory.deleteMany();await db.trip.deleteMany();await db.place.deleteMany();await db.musicPlaylist.deleteMany();await db.musicTrack.deleteMany();await db.user.deleteMany();
   await db.user.create({data:{email:'author@lifeatlas.com',name:'Atlas Author'}});
  },{timeout:30000});
  const removed:Record<string,number>={images:0,music:0};
  for(const bucket of ['images','music'] as const){stage='cloud files/'+bucket;const files=controlCloudFiles(bucket),keys:string[]=[];let cursor:string|undefined;do{const page=await files.list({limit:1000,cursor});keys.push(...page.items.filter(item=>!item.key.startsWith('atlas-system/')).map(item=>item.key));cursor=page.cursor;}while(cursor);for(let n=0;n<keys.length;n+=50){await files.delete(keys.slice(n,n+50));removed[bucket]+=Math.min(50,keys.length-n);}
   let remainingCursor:string|undefined;do{const remaining=await files.list({limit:1000,cursor:remainingCursor});if(remaining.items.some(item=>!item.key.startsWith('atlas-system/')))throw new Error('Some cloud files were not cleared.');remainingCursor=remaining.cursor;}while(remainingCursor);
  }
  stage='record verification';
  const counts=await Promise.all([prisma.trip.count(),prisma.place.count(),prisma.memory.count(),prisma.photo.count(),prisma.experience.count(),prisma.timelineEvent.count(),prisma.musicTrack.count(),prisma.musicPlaylist.count()]);
  if(counts.some(n=>n!==0))throw new Error('Reset validation failed.');
  const receipt={completed:true,resetId:TEST_RESET_ID,clearedAt:new Date().toISOString(),appRecordsAtReset:0,removedFiles:removed,retained:'App schema, indexes and one author configuration record'};
  stage='reset receipt write';
  await music.upload(receiptKey,JSON.stringify(receipt),{contentType:'application/json',cacheControl:'no-store'});
  return NextResponse.json(receipt);
 }catch{return NextResponse.json({error:`Test data reset did not finish at ${stage}. The authorized workflow may retry.`},{status:503});}
}
