import {getGlobeTripPlaces} from "@/lib/queries/public-content";
import {readSections} from "@/lib/studio/server";
import type {PeoplePhoto} from "@/lib/public-trips/types";
import type {ScrapbookFrame} from "@/lib/public-trips/scrapbook";
import type { Metadata } from "next";
import TripFilmHero from "@/components/home/TripFilmHero";
import { getLatestHeroTrips, getHeroGalleryPhotos } from "@/lib/queries/hero-trips";
import { NativeAppRedirect } from "@/components/native/NativeAppRedirect";
import LivingWorld from "@/components/world/LivingWorld";
import { getScrapbookMedia } from "@/lib/queries/scrapbook";
import { getTripArchive } from "@/lib/queries/trip-archive";
export const metadata: Metadata = {
  title: "Life Atlas — The Living World",
  description:
    "A cinematic journey through places, moments, and possibility. Reality meets imagination in the Living World.",
};
export const revalidate = 300;

export default async function Home() {
  const sections=await readSections();
  const heroSlugs=sections.hero.content.mode==='curated'?sections.hero.content.items.map(item=>item.tripSlug!):undefined;
  const archiveSlugs=sections.archive.content.mode==='curated'?sections.archive.content.items.map(item=>item.tripSlug!):undefined;
  const [trips,galleryPhotos,automaticRibbon,archiveTrips,places]=await Promise.all([getLatestHeroTrips(heroSlugs),getHeroGalleryPhotos(),getScrapbookMedia(),getTripArchive(archiveSlugs),getGlobeTripPlaces()]);
  const people:PeoplePhoto[]|undefined=sections.people.content.mode==='curated'?sections.people.content.items.map(item=>({id:item.id,src:item.poster||item.src!,original:item.src,alt:item.alt||item.title||'A person along the way',title:item.title,sample:false})):[];
  const curatedRibbon=sections.ribbon.content.mode==='curated';
  const scrapbookMedia:ScrapbookFrame[]=curatedRibbon?sections.ribbon.content.items.map(item=>({id:item.id,tripId:item.tripSlug||'',tripTitle:item.title,src:item.src!,preview:item.poster||item.src!,title:item.title,kind:item.kind==='video'?'film':'photo',sample:false})):automaticRibbon;
  return (
    <>
      <NativeAppRedirect />
      <div className="bg-background text-foreground min-h-screen">
        <TripFilmHero trips={trips} galleryPhotos={galleryPhotos} />
        <LivingWorld places={places} scrapbookMedia={scrapbookMedia} trips={archiveTrips} peoplePhotos={people} curatedRibbon={curatedRibbon} curatedArchive={sections.archive.content.mode==='curated'} />
      </div>
    </>
  );
}
