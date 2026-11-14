export interface TripArchiveEntry {
  id: string;
  slug: string;
  title: string;
  image: string;
  places: string[];
  country: string;
  duration: string;
  days: number | null;
  date: string | null;
  photoCount: number | null;
  sample: boolean;
}
