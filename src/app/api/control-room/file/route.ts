import {NextResponse} from 'next/server';
import {controlCloudFiles} from '@/lib/control-room/cloud-server';
import {cloudBucket,cloudKey,TRASH_PREFIX} from '@/lib/control-room/cloud-policy';
export const runtime='nodejs';
export async function GET(request:Request){try{const params=new URL(request.url).searchParams,bucket=cloudBucket(params.get('bucket')),key=cloudKey(params.get('key'));if(key.startsWith(TRASH_PREFIX))return new Response('File is in Trash',{status:410});const files=controlCloudFiles(bucket);await files.head(key);const url=await files.url(key,{expiresIn:300});return NextResponse.redirect(url,{status:302,headers:{'Cache-Control':'no-store'}});}catch{return new Response('File unavailable',{status:404});}}
