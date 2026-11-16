/** Explicitly curated public samples. No private app/vault data is read here.
 * Future publishing can supply this same shape; automatic trip selection is prohibited.
 */
export interface PeoplePhoto {
  id: string;
  src: string;
  alt: string;
  title?: string;
  context?: string;
  sample: boolean;
}
export const peoplePhotos: PeoplePhoto[] = [
  { id:'lake-friends', src:'/images/people/people-1.webp', alt:'Adult friends together beside an alpine lake', title:'The best part of the view', context:'A shared afternoon', sample:true },
  { id:'mountain-portrait', src:'/images/people/people-2.webp', alt:'Candid portrait of a woman in hiking fleece', title:'A familiar smile', context:'Between the miles', sample:true },
  { id:'chai-stop', src:'/images/people/people-3.webp', alt:'Travel companions sharing tea at a mountain roadside stall', title:'One more cup', context:'The unplanned stop', sample:true },
  { id:'green-jacket', src:'/images/people/people-4.webp', alt:'Smiling man in a green jacket in warm sunlight', title:'Good company', context:'A moment along the way', sample:true },
  { id:'ridge-evening', src:'/images/people/people-5.webp', alt:'Friends sitting together on a mountain ridge at sunset', title:'Nowhere else to be', context:'The evening pause', sample:true },
  { id:'camera-companion', src:'/images/people/people-6.webp', alt:'Woman with a camera smiling in a leafy village', title:'Behind the camera', context:'The person behind the photograph', sample:true },
  { id:'seaside-laughter', src:'/images/people/people-7.webp', alt:'Two friends walking and laughing beside the sea', title:'The long way back', context:'A conversation worth keeping', sample:true },
  { id:'camp-table', src:'/images/people/people-8.webp', alt:'Travel companions around a campsite table under warm lights', title:'Stay a little longer', context:'After the sun went down', sample:true },
];
