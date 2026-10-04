import prisma from '../prisma';

export interface ExploreItem {
  id: string;
  title: string;
  category: string;
  date: Date | null;
  location: string | null;
  image: string | null;
  url: string;
  description: string | null;
}

export async function getExploreItems(params: {
  category?: string;
  year?: string;
  country?: string;
  region?: string;
  city?: string;
}) {
  const items: ExploreItem[] = [];

  // Parse filters
  const filterYear = params.year ? parseInt(params.year) : null;
  const matchYear = (date: Date | null) => !filterYear || (date && date.getFullYear() === filterYear);
  const filterCountry = params.country?.toLowerCase();
  const filterCity = params.city?.toLowerCase();
  
  const checkLocation = (country: string | null, city: string | null) => {
    if (filterCountry && country?.toLowerCase() !== filterCountry) return false;
    if (filterCity && city?.toLowerCase() !== filterCity) return false;
    return true;
  };

  const includeAll = !params.category || params.category === 'All';

  // 1. Trips
  if (includeAll || params.category === 'Travel') {
    const trips = await prisma.trip.findMany();
    for (const trip of trips) {
      if (filterCountry && !trip.destination.toLowerCase().includes(filterCountry)) continue;
      if (!matchYear(trip.startDate)) continue;

      items.push({
        id: trip.id,
        title: trip.title,
        category: 'Travel',
        date: trip.startDate,
        location: trip.destination,
        image: trip.coverImage,
        url: `/trips/${trip.slug}`,
        description: trip.description,
      });
    }
  }



  // 3. Experiences (Food, Cinema, Events)
  if (includeAll || ['Food', 'Cinema', 'Events'].includes(params.category as string)) {
    const experiences = await prisma.experience.findMany({
      include: { place: true, foodExperience: true, movie: true }
    });
    for (const exp of experiences) {
      if (!matchYear(exp.date)) continue;
      if (!checkLocation(exp.place?.country || null, exp.place?.city || null)) continue;
      
      let cat = 'Events';
      if (exp.type === 'FOOD') cat = 'Food';
      if (exp.type === 'CINEMA') cat = 'Cinema';

      if (!includeAll && params.category !== cat) continue;

      let title = exp.title;
      if (cat === 'Food' && exp.foodExperience) title = exp.foodExperience.restaurant;

      items.push({
        id: exp.id,
        title: title,
        category: cat,
        date: exp.date,
        location: exp.place ? `${exp.place.name}, ${exp.place.country}` : null,
        image: null,
        url: cat === 'Food' ? '/food' : cat === 'Cinema' ? '/cinema' : '/experiences',
        description: exp.description,
      });
    }
  }

  // 4. Photos
  if (includeAll || params.category === 'Photography') {
    const photos = await prisma.photo.findMany({ include: { place: true } });
    for (const photo of photos) {
      if (!matchYear(photo.date)) continue;
      if (!checkLocation(photo.place?.country || null, photo.place?.city || null)) continue;

      items.push({
        id: photo.id,
        title: photo.caption || 'Photograph',
        category: 'Photography',
        date: photo.date,
        location: photo.place ? `${photo.place.name}, ${photo.place.country}` : null,
        image: photo.url,
        url: '/photography',
        description: null,
      });
    }
  }

  // 5. Places
  if (includeAll || params.category === 'Places') {
    const places = await prisma.place.findMany();
    for (const place of places) {
      if (!checkLocation(place.country, place.city)) continue;

      items.push({
        id: place.id,
        title: place.name,
        category: 'Places',
        date: place.createdAt, 
        location: `${place.city ? place.city + ', ' : ''}${place.country}`,
        image: place.coverImage,
        url: `/places/${place.slug}`,
        description: place.description,
      });
    }
  }

  // 6. TimelineEvents (Memories)
  if (includeAll || params.category === 'Memories') {
    const events = await prisma.timelineEvent.findMany();
    for (const event of events) {
      if (!matchYear(event.date)) continue;
      if (filterCountry || filterCity) continue; 
      
      if (event.type === 'TRIP' || event.type === 'EXPERIENCE') continue;

      items.push({
        id: event.id,
        title: event.title,
        category: 'Memories',
        date: event.date,
        location: null,
        image: null,
        url: '/timeline',
        description: event.description,
      });
    }
  }

  // Sort unified list (newest first)
  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.getTime() - a.date.getTime();
  });

  return items;
}
