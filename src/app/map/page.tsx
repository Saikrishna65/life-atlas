import { getMapData } from "@/lib/queries/map";
import MapWrapper from "@/components/map/MapWrapper";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Map | Life Atlas",
  description: "An interactive atlas of places and journeys.",
};

export default async function MapPage() {
  const places = await getMapData();

  return (
    <div className="fixed inset-0 z-10 bg-background">
      <MapWrapper places={places} />
    </div>
  );
}
