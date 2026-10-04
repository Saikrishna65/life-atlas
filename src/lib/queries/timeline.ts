import prisma from '../prisma';

export async function getTimelineEvents() {
  const events = await prisma.timelineEvent.findMany({
    orderBy: { date: 'desc' },
  });

  const tripIds = events.filter(e => e.type === 'TRIP' && e.referenceId).map(e => e.referenceId as string);
  
  const trips = await prisma.trip.findMany({
    where: { id: { in: tripIds } },
    select: { 
      id: true, 
      slug: true, 
      coverImage: true,
      tripPlaces: {
        select: { place: { select: { latitude: true, longitude: true } } },
        take: 1
      }
    }
  });
  
  const tripMap = new Map(trips.map(t => [t.id, t]));

  // Group by year
  const grouped = events.reduce((acc, event) => {
    const year = new Date(event.date).getFullYear();
    if (!acc[year]) acc[year] = [];
    
    let link: string | null = null;
    let linkText: string | null = null;
    let image: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    
    if (event.type === 'TRIP' && event.referenceId) {
      const trip = tripMap.get(event.referenceId);
      if (trip) {
        link = `/trips/${trip.slug}`;
        linkText = "View Trip";
        image = trip.coverImage;
        if (trip.tripPlaces?.[0]?.place) {
          latitude = trip.tripPlaces[0].place.latitude;
          longitude = trip.tripPlaces[0].place.longitude;
        }
      }
    }
    
    acc[year].push({ ...event, link, linkText, image, latitude, longitude });
    return acc;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, {} as Record<number, any[]>);

  return Object.entries(grouped)
    .map(([year, events]) => ({
      year: parseInt(year),
      events,
    }))
    .sort((a, b) => b.year - a.year);
}
