/** Explicit interests are preferences, never inferred from searches or playback. */
export const VIDEO_TOPICS = [
  { id: "travel", title: "Travel", query: "cinematic travel films" },
  { id: "science", title: "Science", query: "science explained documentary" },
  { id: "technology", title: "Technology", query: "technology engineering explained" },
  { id: "music", title: "Music", query: "live music sessions" },
  { id: "nature", title: "Nature", query: "wildlife nature documentary" },
  { id: "design", title: "Design", query: "architecture design documentary" },
  { id: "cooking", title: "Cooking", query: "cooking recipes techniques" },
  { id: "gaming", title: "Gaming", query: "gaming gameplay" },
] as const;
export function readTopic(value: unknown) {
  return VIDEO_TOPICS.find((topic) => topic.id === value) ?? null;
}
export const TOPIC_STORAGE_KEY = "atlas-video-topic";
