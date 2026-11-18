import PublicPage from "@/components/world/PublicPage";
import Link from "next/link";
import {getFoodExperiences} from "@/lib/queries/experiences";
export const revalidate=300;
export const metadata={title:"My food journal",description:"Experiences from my published journeys."};
export default async function Page(){const entries=await getFoodExperiences();return <PublicPage title="My food journal." kicker="A few moments worth remembering."><div className="atlas-directory-list">{entries.map(item=><article className="atlas-directory-entry" key={item.id}><h2>{item.title}</h2>{item.description&&<p>{item.description}</p>}{item.trip&&<Link href={`/trips/${item.trip.slug}`}>{item.trip.title}</Link>}</article>)}</div>{!entries.length&&<p className="public-coordinate-note">Nothing published here yet.</p>}</PublicPage>}
