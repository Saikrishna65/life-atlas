import prisma from '../prisma';
import {Prisma} from '@prisma/client';
import {chooseTripCover,readTripCover,routeWithTripCover,tripCoverCandidates,tripCoverImage} from '../public-trips/cover';
const include={photos:{select:{id:true,url:true}}} as const;
export async function readPublishedTripCover(slug:string,source=prisma){
 const trip=await source.trip.findUnique({where:{slug},include});
 return trip?{hero:readTripCover(trip.routeData),media:tripCoverCandidates(trip.routeData,trip.photos),publicUrl:`/trips/${trip.slug}`}:null;
}
/** Only two public fields change. No child records, route points, totals or upload jobs are rewritten. */
export async function updatePublishedTripCover(slug:string,id:unknown,source=prisma){
 return source.$transaction(async db=>{
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`website-trip:${slug}`},0))`; 
  const trip=await db.trip.findUnique({where:{slug},include});if(!trip)return null;
  const candidates=tripCoverCandidates(trip.routeData,trip.photos),hero=chooseTripCover(candidates,id);
  await db.trip.update({where:{id:trip.id},data:{coverImage:tripCoverImage(hero,trip.coverImage,candidates),routeData:routeWithTripCover(trip.routeData,hero) as Prisma.InputJsonValue}});
  return {hero,publicUrl:`/trips/${trip.slug}`};
 });
}
