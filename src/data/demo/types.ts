/** Public, fictional demonstration records. Never import private stores here. */
export type Category = "Mountains" | "Culture" | "Coast" | "Nature" | "City";
export type Difficulty = "Easy" | "Moderate" | "Challenging";
export interface Destination {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  coordinateNote: string;
  category: Category;
  season: string;
  difficulty: Difficulty;
  duration: number;
  description: string;
  highlights: string[];
  budget: { amount: number; currency: "INR"; example: true };
  tags: string[];
  image: string;
  imageNote: string;
  timelineIds: string[];
  galleryIds: string[];
  expeditionIds: string[];
}
export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  destinationId: string;
}
export interface Expedition {
  id: string;
  slug: string;
  name: string;
  destinationIds: string[];
  route: string[];
  duration: number;
  difficulty: Difficulty;
  category: Category;
  overview: string;
  activities: string[];
  itinerary: ItineraryDay[];
  packing: string[];
  cost: {
    accommodation: number;
    transport: number;
    food: number;
    activities: number;
    total: number;
    currency: "INR";
    example: true;
  };
  galleryIds: string[];
  weather: string;
  moments: string[];
  transport: string;
  memoryIds: string[];
  image: string;
}
export interface TimelineEvent {
  id: string;
  expeditionId: string;
  destinationId: string;
  date: string;
  title: string;
  description: string;
}
export interface GalleryImage {
  id: string;
  destinationId: string;
  src: string;
  thumbnail: string;
  alt: string;
  caption: string;
  orientation: "portrait" | "landscape";
  sourceId: string;
  illustrative: true;
}
export interface Memory {
  id: string;
  title: string;
  destinationId: string;
  date: string;
  category: "Stillness" | "Discovery" | "People";
  description: string;
  tags: string[];
  photoIds: string[];
  expeditionIds: string[];
  featured: boolean;
}
export interface Artist {
  id: string;
  name: string;
  genre: string;
  origin: string;
}
export interface Album {
  id: string;
  artistId: string;
  title: string;
  year: number;
  color: string;
  artwork: number;
}
export interface Track {
  id: string;
  albumId: string;
  artistId: string;
  title: string;
  duration: number;
  genre: string;
  mood: string;
}
export interface Playlist {
  id: string;
  title: string;
  description: string;
  mood: string;
  artwork: number;
  color: string;
  trackIds: string[];
  duration: number;
  genres: string[];
  theme: string;
}
export type DemoTopic =
  | "Travel"
  | "Music"
  | "Reminders"
  | "Finance"
  | "Conversation"
  | "Planning"
  | "Organization"
  | "Technology";
export interface Conversation {
  id: string;
  topic: DemoTopic;
  title: string;
  messages: { role: "user" | "atlas"; text: string }[];
}
export interface Workflow {
  id: string;
  topic: DemoTopic;
  title: string;
  conversationId: string;
  steps: string[];
  result: string;
}
export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amountPaise: number;
  direction: "in" | "out";
}
export interface Reminder {
  id: string;
  title: string;
  date: string;
  time: string;
  category: string;
  completed: boolean;
  expeditionId?: string;
}
export interface Activity {
  id: string;
  date: string;
  module: string;
  title: string;
  recordId: string;
}
export interface Milestone {
  id: string;
  destinationId: string;
  title: string;
  date: string;
}
