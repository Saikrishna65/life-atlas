export interface HeroTrip {
  id: string;
  slug: string;
  title: string;
  image: string;
  sample: boolean;
  video?: string;
}
export interface HeroGalleryPhoto {
  id: string;
  src: string;
  tripId: string;
  tripSlug: string;
  tripTitle: string;
  sample: boolean;
}

export interface PeoplePhoto {
  id: string;
  src: string;
  original?:string;
  alt: string;
  title?: string;
  context?: string;
  sample: boolean;
}
