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

export async function getGlobeTripPlaces(source=prisma):Promise<PublicPlace[]>{
 try{
  const {globeTripPins}=await import('../public-trips/globe-pins');
  // The explicit main pin is a scoped Place row. Avoid loading entire GPS tracks
  // or all visited places just to render the landing-page globe.
  const trips=await source.trip.findMany({orderBy:{startDate:'desc'},select:{id:true,slug:true,title:true,destination:true,coverImage:true,tripPlaces:{where:{place:{slug:{endsWith:'-trip-location'}}},select:{place:{select:{id:true,slug:true,name:true,latitude:true,longitude:true,country:true,region:true,description:true,coverImage:true}}}}}});
  return globeTripPins(trips.map(trip=>({...trip,routeData:null})));
 }catch{return [];}
}
