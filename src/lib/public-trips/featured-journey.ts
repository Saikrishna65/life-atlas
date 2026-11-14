import type { RoutePoint } from "./route";

export interface JourneyChapter {
  id: string;
  place: string;
  day: string;
  title: string;
  description: string;
  image: string;
  film?: string;
  illustrativeMedia: boolean;
  latitude?: number;
  longitude?: number;
}
export interface FeaturedJourney {
  slug: string;
  title: string;
  region: string;
  intro: string;
  image: string;
  sample: boolean;
  duration: string;
  distance: number | null;
  altitude: number | null;
  paths: RoutePoint[][];
  chapters: JourneyChapter[];
}
