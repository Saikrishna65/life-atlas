import prisma from '../prisma';
import {StudioInputError,automaticSections,sectionKey,validateSection,type SectionKey,type SectionRecord,type SectionContent,type SceneItem} from './sections';
import {publishedTripMedia} from '../public-trips/detail';
import {publicAsset} from './sections';
let setup:Promise<void>|undefined;
/** Only explicit Studio/publishing mutations initialize this additive schema; public reads never run DDL. */
export function ensureWebsiteSchema(){return setup??=prisma.$transaction(async db=>{
 await db.$queryRaw`SELECT 1::int AS acquired FROM pg_advisory_xact_lock(hashtextextended('atlas-website-studio-schema',0))`;
 await db.$executeRaw`CREATE TABLE IF NOT EXISTS "WebsiteSection" ("key" TEXT NOT NULL PRIMARY KEY,"revision" INTEGER NOT NULL DEFAULT 0,"data" JSONB NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
 await db.$executeRaw`ALTER TABLE "Trip" ALTER COLUMN "startDate" DROP NOT NULL`;
 await db.$executeRaw`ALTER TABLE "TripDay" ALTER COLUMN "date" DROP NOT NULL`;
}).then(()=>{}).catch(error=>{setup=undefined;throw error;});}
export async function readSections(){const sections=automaticSections();try{const table=await prisma.$queryRaw<{name:string|null}[]>`SELECT to_regclass('"WebsiteSection"')::text AS name`;if(!table[0]?.name)return sections;const rows=await prisma.$queryRaw<{key:SectionKey;revision:number;data:SectionContent}[]>`SELECT "key","revision","data" FROM "WebsiteSection"`;for(const row of rows){try{const key=sectionKey(row.key);sections[key]={key,revision:row.revision,content:validateSection(key,row.data)};}catch{/* Keep a safe fallback for an unsupported older record. */}}}catch{/* Older deployments and offline preview retain existing public samples. */}return sections;}
export class SectionConflict extends Error{}
export async function saveSection(key:SectionKey,content:SectionContent,revision:number):Promise<SectionRecord>{
 await ensureWebsiteSchema();
 return prisma.$transaction(async db=>{
  await db.$queryRaw`SELECT 1::int AS acquired FROM pg_advisory_xact_lock(hashtextextended(${`website-section:${key}`},0))`;
  const rows=await db.$queryRaw<{revision:number}[]>`SELECT "revision" FROM "WebsiteSection" WHERE "key"=${key}`;
  if((rows[0]?.revision??0)!==revision)throw new SectionConflict('This section changed elsewhere. Refresh its published version before replacing it. Your draft is still saved.');
  if((key==='hero'||key==='archive')&&content.mode==='curated'){const count=await db.trip.count({where:{slug:{in:content.items.map(item=>item.tripSlug!)}}});if(count!==content.items.length)throw new StudioInputError('A selected journey is no longer published. Refresh the website library.');}
  const next=revision+1;
  await db.$executeRaw`INSERT INTO "WebsiteSection" ("key","revision","data") VALUES (${key},${next},${JSON.stringify(content)}::jsonb) ON CONFLICT ("key") DO UPDATE SET "revision"=EXCLUDED."revision","data"=EXCLUDED."data","updatedAt"=CURRENT_TIMESTAMP`;
  return {key,revision:next,content};
 });
}
export async function studioLibrary(){
 // Read publication metadata, not the much larger raw GPS recordings or inline originals.
 const trips=await prisma.$queryRaw<{id:string;slug:string;title:string;coverImage:string|null;startDate:Date|null;publication:unknown}[]>`SELECT "id","slug","title","coverImage","startDate","routeData"->'publication' AS "publication" FROM "Trip" ORDER BY "createdAt" DESC,"id" ASC LIMIT 200`;
 const photos=await prisma.$queryRaw<{id:string;url:string;inline:boolean;title:string|null;slug:string|null}[]>`SELECT p."id", CASE WHEN p."url" LIKE 'data:image/%' THEN '/api/public/studio-photo/'||p."id" ELSE p."url" END AS "url", p."url" LIKE 'data:image/%' AS "inline",t."title",t."slug" FROM "Photo" p LEFT JOIN "Trip" t ON t."id"=p."tripId" ORDER BY p."createdAt" DESC,p."id" ASC LIMIT 1000`;
 const media:SceneItem[]=[...photos.filter(photo=>publicAsset(photo.url)).map(photo=>({id:`photo-${photo.id}`,kind:'photo' as const,src:photo.url,poster:photo.inline?`${photo.url}?width=480`:undefined,title:photo.title||'Published photograph',alt:photo.title?`A photograph from ${photo.title}`:'A public photograph',tripSlug:photo.slug||undefined})),
 ...trips.flatMap(trip=>publishedTripMedia({publication:trip.publication}).map(item=>({id:`published-${item.id}`,kind:item.kind,src:item.url,poster:item.poster,title:trip.title,alt:`A moment from ${trip.title}`,tripSlug:trip.slug})))];
 return {trips:trips.map(trip=>({id:trip.id,kind:'trip' as const,tripSlug:trip.slug,title:trip.title,src:trip.coverImage||undefined,date:trip.startDate?.toISOString()||null})),media:[...new Map(media.map(item=>[item.src,item])).values()]};
}
