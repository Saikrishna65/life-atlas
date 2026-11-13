/** Stock previews, not footage of the named demo trips. License/provenance in docs/HERO-FILMS.md. */
export const heroFilms = [
  {
    src: "https://videos.pexels.com/video-files/40253383/17191538_3840_2160_30fps.mp4",
    poster: "/images/world/valley.webp",
    fallback: "/films/hero/highlands.mp4",
  },
  {
    src: "https://videos.pexels.com/video-files/40202545/17175739_3840_2160_25fps.mp4",
    poster: "/images/world/ocean.webp",
    fallback: "/films/hero/coast.mp4",
  },
  {
    src: "https://videos.pexels.com/video-files/1550080/1550080-uhd_3840_2160_30fps.mp4",
    poster: "/images/door-sequence/frame_286.webp",
    fallback: "/films/hero/gardens.mp4",
  },
] as const;
export interface HeroTrip {
  id: string;
  slug: string;
  title: string;
  image: string;
  sample: boolean;
}
export interface HeroGalleryPhoto {
  id: string;
  src: string;
  tripId: string;
  tripSlug: string;
  tripTitle: string;
  sample: boolean;
}
