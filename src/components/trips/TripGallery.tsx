import type { Photo } from "@prisma/client";
import TripPhotoCollection from "./TripPhotoCollection";
export default function TripGallery({
  photos,
  collection,
}: {
  collection?: { slug: string; title: string };
  photos: (Photo & { place?: { name: string } | null })[];
}) {
  return (
    <TripPhotoCollection
      collection={collection}
      photos={photos.map((photo) => ({
        ...photo,
        location: photo.place?.name,
      }))}
    />
  );
}
