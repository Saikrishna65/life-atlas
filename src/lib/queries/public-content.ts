import prisma from '../prisma';
export interface PublicPlace {
  id:string; slug:string; name:string; country:string; region:string; description:string;
  image:string; latitude:number|null; longitude:number|null;
  tripPlaces:{trip:{title:string;slug:string}}[];
}
/** The web database contains explicitly published records, never local vaults. */
export async function getPublicPlaces(source=prisma):Promise<PublicPlace[]> {
  try {
    const places=await source.place.findMany({where:{OR:[{tripPlaces:{some:{}}},{photos:{some:{}}}]},orderBy:{name:'asc'},select:{id:true,slug:true,name:true,country:true,region:true,description:true,coverImage:true,latitude:true,longitude:true,tripPlaces:{select:{trip:{select:{title:true,slug:true}}}}}});
    return places.map(place=>({...place,region:place.region||'',description:place.description||'',image:place.coverImage||''}));
  }catch{return [];}
}
