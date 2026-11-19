import type {TripRecord,TripMemoryRecord,ItineraryDayRecord} from './types';
import type {PublishedMedia} from '../r2/types';
export interface WebsiteOptions {
  title?:string; description?:string; memoryIds:string[];
  includeItinerary?:boolean; includeRoute?:boolean; appendExistingMedia?:boolean; publicMedia?:PublishedMedia[];
}
export function websiteSlug(trip:Pick<TripRecord,'id'|'title'|'publishedSlug'>) {
  return trip.publishedSlug || `${trip.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'journey'}-${trip.id.replace(/[^a-zA-Z0-9_-]/g,'').slice(-36)}`;
}
/** Only explicitly selected public fields cross the local-vault boundary. No finance, tickets, notes or contacts. */
export function websitePayload(trip:TripRecord,memories:TripMemoryRecord[],days:ItineraryDayRecord[],options:WebsiteOptions) {
  const selected=memories.filter(memory=>options.memoryIds.includes(memory.id));
  const publicMedia=options.publicMedia??[];
  const title=(options.title??trip.title).trim();
  if(!title)throw Error('Give this journey a title.');
  const date=trip.startDate || selected.map(m=>m.date).filter(Boolean).sort()[0];

  const places=new Map<string,{id?:string;name:string;latitude?:number;longitude?:number;locationVisibility?:string}>();
  if(trip.destination.trim())places.set(trip.destination.toLowerCase(),{name:trip.destination.trim()});
  for(const memory of selected){const name=(memory.placeName||memory.location)?.trim();if(name)places.set(name.toLowerCase(),{name});}
  if(options.includeRoute)for(const waypoint of trip.waypoints??[]){
    if(waypoint.title?.trim())places.set(waypoint.title.toLowerCase(),{name:waypoint.title.trim(),latitude:waypoint.latitude,longitude:waypoint.longitude});
  }
  for(const group of trip.websitePlaces||[])places.set(group.name.trim().toLowerCase(),{id:group.id,name:group.name.trim(),locationVisibility:group.mapPrecision,...(group.mapPrecision!=='hidden'?group.mapLocation:{})});
  if(trip.websiteLocation)places.set('__atlas_trip_location__',{id:'trip-location',name:trip.destination.trim()||title,...trip.websiteLocation});
  const media=publicMedia.map(item=>({id:item.id,url:item.url,poster:item.thumbnailUrl,manifestUrl:item.manifestUrl,kind:item.mimeType.startsWith('video/')?'video' as const:'photo' as const,
    place:item.tags.find(tag=>tag.startsWith('place:'))?.slice(6).trim()||'Unassigned',category:'Trip journal'}));
  const photoCover=selected.flatMap(memory=>memory.images?.length?memory.images:memory.imageDataUrl?[memory.imageDataUrl]:[])[0] || media.find(item=>item.kind==='photo')?.url;
  return {tripId:trip.id,title,destination:trip.destination.trim(),startDate:date||undefined,endDate:trip.endDate||undefined,
    description:options.description?.trim()||undefined,coverImage:photoCover,existingSlug:websiteSlug(trip),
    ...(trip.websiteHeroMediaId!==undefined?{heroMediaId:trip.websiteHeroMediaId}:{}),
    preserveExistingRoute:true,globeLocation:trip.websiteLocation,
    appendExistingMedia:options.appendExistingMedia===true,
    preserveExistingMedia:selected.length===0&&media.length===0,
    preserveExistingItinerary:!options.includeItinerary,
    ...(options.includeRoute&&trip.liveExpedition?{routeData:trip.liveExpedition,totalDistanceKm:trip.liveExpedition.totalDistanceKm,elevationGainMeters:trip.liveExpedition.elevationGainMeters,maxElevationMeters:trip.liveExpedition.maxElevationMeters}:{}),
    publicMedia:media,places:[...places.values()],
    memories:selected.map(memory=>({title,caption:undefined,date:memory.date,placeName:memory.placeName||memory.location,images:memory.images?.length?memory.images:memory.imageDataUrl?[memory.imageDataUrl]:[]})),
    itineraryDays:options.includeItinerary?days.filter(day=>day.title?.trim()||day.description?.trim()||day.activities?.length).map(day=>({dayIndex:day.dayIndex,date:day.date,title:day.title||`Day ${day.dayIndex}`,description:day.description||day.activities?.map(activity=>`${activity.startTime||''} ${activity.title}`.trim()).join(' · ')})):[],
  };
}
