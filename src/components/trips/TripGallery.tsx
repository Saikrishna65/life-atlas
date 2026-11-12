import type { Photo } from "@prisma/client";
import TripPhotoCollection from "./TripPhotoCollection";
export default function TripGallery({
  photos,
}: {
  photos: (Photo & { place?: { name: string } | null })[];
}) {
  return (
    <TripPhotoCollection
      photos={photos.map((photo) => ({
        ...photo,
        location: photo.place?.name,
      }))}
    />
  );
}
