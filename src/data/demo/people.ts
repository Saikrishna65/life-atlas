/** Explicitly curated public samples. No private app/vault data is read here.
 * Future publishing can supply this same shape; automatic trip selection is prohibited.
 */
export interface PeoplePhoto {
  id: string;
  src: string;
  original?:string;
  alt: string;
  title?: string;
  context?: string;
  sample: boolean;
}
export const peoplePhotos: PeoplePhoto[] = [
  {"id": "lakeside-friends", "src": "/images/people/stock-friends.webp", "alt": "Friends sitting side by side overlooking water", "title": "Better together", "context": "Friends by the water", "sample": true},
  {"id": "blue-door-portrait", "src": "/images/people/stock-creator.webp", "alt": "Woman in a blue hoodie standing beside a blue wall", "title": "A familiar smile", "context": "A candid portrait", "sample": true},
  {"id": "shared-table", "src": "/images/people/stock-students.webp", "alt": "People smiling together around a table with laptops", "title": "Time together", "context": "A shared afternoon", "sample": true},
  {"id": "studio-portrait", "src": "/images/people/stock-portrait.webp", "alt": "Portrait of a woman in contrasting blue and warm light", "title": "A face to remember", "context": "Portrait study", "sample": true},
  {"id": "coffee-with-friends", "src": "/images/people/stock-coffee.webp", "alt": "Hands holding three cups of coffee together", "title": "One more cup", "context": "Around the table", "sample": true},
  {"id": "warm-portrait", "src": "/images/people/stock-pro.webp", "alt": "Woman seated beside an orange wall with a laptop", "title": "Good company", "context": "A quiet moment", "sample": true},
  {"id": "shared-work", "src": "/images/people/stock-devs.webp", "alt": "Two people working side by side at computers", "title": "Side by side", "context": "Everyday company", "sample": true},
  {"id": "cafe-moment", "src": "/images/people/stock-shop.webp", "alt": "Woman smiling at the counter of a cafe", "title": "Little conversations", "context": "A cafe encounter", "sample": true},
];
