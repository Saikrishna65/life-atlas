import {sensitiveApiDenial} from '@/lib/security/api-authorization';
import {NextResponse} from 'next/server';
import {EventType} from '@prisma/client';
import prisma from '@/lib/prisma';
import {allowAtlasMutation} from '@/lib/mobileRequest';
import {revalidatePath} from 'next/cache';
export const runtime='nodejs';
export async function POST(request: Request) {
 const denial=await sensitiveApiDenial(request);if(denial)return denial;

 if(!allowAtlasMutation(request,'x-atlas-studio'))return NextResponse.json({error:'Open Creator Studio in Atlas to publish entries.'},{status:403});
 try {
  const body=await request.json();
  if(typeof body.id!=='string'||! /^[a-zA-Z0-9_-]{16,80}$/.test(body.id)||!body.fields||typeof body.fields!=='object')return NextResponse.json({error:'Invalid Studio entry.'},{status:400});
  const f=body.fields as Record<string,unknown>;
  const text=(key:string)=>typeof f[key]==='string'?String(f[key]).trim():'';
  const required=(key:string)=>{const value=text(key);if(!value)throw new Error(`Enter ${key}.`);return value;};
  const date=(key:string,mandatory=false)=>{const value=mandatory?required(key):text(key);if(!value)return null;const parsed=new Date(value);if(!Number.isFinite(parsed.getTime()))throw new Error(`Enter a valid ${key}.`);return parsed;};
  const optional=(key:string)=>text(key)||null;
  const id=`mobile_${body.id}`;
  const user=await prisma.user.upsert({where:{email:'author@lifeatlas.com'},update:{},create:{email:'author@lifeatlas.com',name:'Atlas Author'}});
  const userId=user.id;
  const slug=(value:string)=>`${value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'entry'}-${body.id}`;
  // Stable IDs make replay after lost connections safe: existing records are never duplicated.
  switch(body.section) {
   case 'Trips': {const title=required('title');await prisma.trip.upsert({where:{id},update:{},create:{id,userId,title,slug:slug(title),destination:required('destination'),startDate:date('startDate',true)!,endDate:date('endDate'),duration:optional('duration'),description:optional('description'),coverImage:optional('coverImage')}});break;}
   case 'Places': {const name=required('name');const latitude=text('latitude')?Number(text('latitude')):null;const longitude=text('longitude')?Number(text('longitude')):null;if(latitude!==null&&(!Number.isFinite(latitude)||Math.abs(latitude)>90)||longitude!==null&&(!Number.isFinite(longitude)||Math.abs(longitude)>180))throw new Error('Enter valid coordinates.');await prisma.place.upsert({where:{id},update:{},create:{id,userId,name,slug:slug(name),country:required('country'),region:optional('region'),city:optional('city'),latitude,longitude,description:optional('description'),coverImage:optional('coverImage')}});break;}
   case 'Photos': await prisma.photo.upsert({where:{id},update:{},create:{id,userId,url:required('url'),caption:optional('caption'),date:date('date'),isFeatured:text('isFeatured')==='true',tripId:optional('tripId'),placeId:optional('placeId')}});break;
   case 'Memories': await prisma.memory.upsert({where:{id},update:{},create:{id,userId,title:required('title'),description:optional('description'),date:date('date')}});break;
   case 'Timeline': {const type=text('type')||'TRIP';if(!Object.values(EventType).includes(type as EventType))throw new Error('Choose a valid event type.');await prisma.timelineEvent.upsert({where:{id},update:{},create:{id,userId,title:required('title'),description:optional('description'),date:date('date',true)!,type:type as EventType,referenceId:optional('referenceId')}});break;}
   default:return NextResponse.json({error:'Choose a Studio section.'},{status:400});
  }
  for(const path of ['/','/trips','/places','/photography','/timeline','/map'])revalidatePath(path);
  return NextResponse.json({success:true,id});
 }catch(error){console.error('Mobile Studio publication failed',error instanceof Error?error.name:'Error');return NextResponse.json({error:'The entry is saved on your device. Publishing could not finish; check the server connection and fields, then retry.'},{status:400});}
}
