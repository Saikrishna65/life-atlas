import PublicPage from "@/components/world/PublicPage";
import Link from "next/link";
import {getTripArchive} from "@/lib/queries/trip-archive";
export const revalidate=300;
export const metadata={title:"The days become the story",description:"The timeline of my published journeys."};
export default async function Page(){const trips=await getTripArchive();return <PublicPage title="The days become the story." kicker="The journeys I have chosen to share."><div className="atlas-directory-list">{trips.filter(t=>t.date).map(t=><Link className="atlas-directory-entry" key={t.id} href={`/trips/${t.slug}`}><time dateTime={t.date!}>{new Date(t.date!).toLocaleDateString('en',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})}</time><h2>{t.title}</h2><p>{t.places.join(' / ')}</p></Link>)}</div>{!trips.some(t=>t.date)&&<p className="public-coordinate-note">My dated journeys will appear here when I publish them.</p>}</PublicPage>}
