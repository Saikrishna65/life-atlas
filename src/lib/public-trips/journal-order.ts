/** Spread films among photographs deterministically, preserving order within each kind. */
export function mixJournalMedia<T extends { kind: "photo" | "video" }>(items: readonly T[]): T[] {
  const photos = items.filter(item => item.kind === "photo");
  const films = items.filter(item => item.kind === "video");
  if (!photos.length || !films.length) return [...items];
  let photo = 0;
  let film = 0;
  return items.map((_, index) => Math.round((index + 1) * films.length / items.length) > Math.round(index * films.length / items.length) ? films[film++] : photos[photo++]);
}
