import {sensitiveApiDenial} from '@/lib/security/api-authorization';
import {NextResponse} from 'next/server';
import {executeCloudAction} from '@/lib/control-room/cloud-actions';
import {randomUUID} from 'node:crypto';
import prisma from '@/lib/prisma';
import {controlCloudFiles,inspectCloud,rewriteCloudReferences,cloudReferences} from '@/lib/control-room/cloud-server';
import {allowControlMutation,cloudBucket,cloudKey,newTrashKey,originalTrashKey,safeFilename,TRASH_PREFIX,stableCloudUrl,ControlInputError} from '@/lib/control-room/cloud-policy';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){
 const denial=await sensitiveApiDenial(request);if(denial)return denial;
return NextResponse.json(await inspectCloud(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
 const denial=await sensitiveApiDenial(request);if(denial)return denial;
if(!allowControlMutation(request))return NextResponse.json({error:'Open Control Room in Life Atlas to manage storage.'},{status:403});try{const body=await request.json();const bucket=cloudBucket(body.bucket),files=controlCloudFiles(bucket);
 if(body.action==='upload-url'){const name=safeFilename(String(body.name||'file')),size=Number(body.size),type=String(body.type||'');if(!Number.isSafeInteger(size)||size<=0||size>512*1024*1024)throw new ControlInputError('Uploads must be between 1 byte and 512 MB.');const backup=name.endsWith('.atlasbackup');if(!backup&&!/^(image|audio|video)\//.test(type))throw new ControlInputError('Upload media files here. Use encrypted backups for private records and documents.');if(bucket==='images'&&backup)throw new ControlInputError('Encrypted backups use the music storage connection.');const id=randomUUID(),key=backup?`control-room/backups/${id}.atlasbackup`:`control-room/uploads/${id}/${name}`;const signed=await files.signedUploadUrl(key,{expiresIn:600,contentType:backup?'application/octet-stream':type,maxSize:size});return NextResponse.json({key,bucket,signed});}
 const key=cloudKey(body.key);
 if(body.action==='finalize-upload'){if(!key.startsWith('control-room/uploads/')&&!key.startsWith('control-room/backups/'))throw new ControlInputError('Invalid upload path.');const info=await files.head(key);if(bucket==='music'&&info.type.startsWith('audio/')){const id=`trk_control_${key.split('/')[2]}`;await prisma.musicTrack.upsert({where:{id},update:{size:info.size},create:{id,title:safeFilename(String(body.name||info.name)).replace(/\.[^.]+$/,''),artist:'Unknown Artist',fileName:key,audioUrl:`/api/music/stream/${id}`,format:info.type,size:info.size,source:'IMPORTED'}});}return NextResponse.json({success:true,url:stableCloudUrl(bucket,key)});}
 return NextResponse.json(await executeCloudAction(body,{files,referencesAvailable:cloudReferences,rewrite:(old,next)=>rewriteCloudReferences(bucket,old,next),id:()=>`${Date.now()}-${randomUUID()}`}));
 }catch(error){return NextResponse.json({error:error instanceof ControlInputError?error.message:'The storage operation could not complete. Refresh and retry; check the connection status.'},{status:error instanceof ControlInputError?error.status:400});}}
