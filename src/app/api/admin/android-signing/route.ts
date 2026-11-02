import {authorizeAndroidSigning} from '@/lib/cloud-vault/signing-authorization';
export const runtime='nodejs';
export const maxDuration=60;
/** Private build configuration lives outside public app tables and file buckets. */
export async function POST(request:Request){
 try{
  const text=await request.text();if(text.length>30000)return Response.json({error:'Request too large.'},{status:413});
  const body=JSON.parse(text);if(!await authorizeAndroidSigning(request,body))return Response.json({error:'A trusted build identity is required.'},{status:403});
  const {default:prisma}=await import('@/lib/prisma');
  if(body.action==='initialize'){
   if(typeof body.keystore!=='string'||body.keystore.length>22000||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.keystore))return Response.json({error:'Invalid signing file.'},{status:400});
   const bytes=Buffer.from(body.keystore,'base64');if(bytes.length<1000||bytes.length>16000)return Response.json({error:'Invalid signing file size.'},{status:400});
   await prisma.$transaction(async db=>{await db.$queryRaw`SELECT 1::int AS acquired FROM pg_advisory_xact_lock(hashtextextended('atlas-android-signing-v1',0))`;
    await db.$executeRaw`CREATE SCHEMA IF NOT EXISTS atlas_private`;
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS atlas_private.android_signing (id integer PRIMARY KEY CHECK (id=1), keystore bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await db.$executeRaw`INSERT INTO atlas_private.android_signing (id,keystore) VALUES (1,${bytes}) ON CONFLICT (id) DO NOTHING`;
   },{timeout:30000,maxWait:10000});
   return Response.json({ready:true},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action!=='load')return Response.json({error:'Unknown signing operation.'},{status:400});
  const tables=await prisma.$queryRaw<{name:string|null}[]>`SELECT to_regclass('atlas_private.android_signing')::text AS name`;
  if(!tables[0]?.name)return Response.json({error:'SIGNING_KEY_NOT_INITIALIZED'},{status:404});
  const rows=await prisma.$queryRaw<{keystore:Uint8Array}[]>`SELECT keystore FROM atlas_private.android_signing WHERE id=1`;
  if(!rows[0]?.keystore)return Response.json({error:'Signing identity unavailable.'},{status:503});
  return new Response(new Uint8Array(rows[0].keystore),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Signing identity unavailable. No application data was changed.'},{status:503});}
}
