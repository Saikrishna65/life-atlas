import prisma from '../prisma';

export async function getTimelineEvents() {
  const events = await prisma.timelineEvent.findMany({
    orderBy: { date: 'desc' },
  });

  const tripIds = events.filter(e => e.type === 'TRIP' && e.referenceId).map(e => e.referenceId as string);
  
  const trips = await prisma.trip.findMany({
    where: { id: { in: tripIds } },
    select: { id: true, slug: true, coverImage: true }
  });
  
  const tripMap = new Map(trips.map(t => [t.id, t]));

  // Group by year
  const grouped = events.reduce((acc, event) => {
    const year = new Date(event.date).getFullYear();
    if (!acc[year]) acc[year] = [];
    
    let link: string | null = null;
    let linkText: string | null = null;
    let image: string | null = null;
    
    if (event.type === 'TRIP' && event.referenceId) {
      const trip = tripMap.get(event.referenceId);
      if (trip) {
        link = `/trips/${trip.slug}`;
        linkText = "View Trip";
        image = trip.coverImage;
      }
    }
    
    acc[year].push({ ...event, link, linkText, image });
    return acc;
  }, {} as Record<number, any[]>);

  return Object.entries(grouped)
    .map(([year, events]) => ({
      year: parseInt(year),
      events,
    }))
    .sort((a, b) => b.year - a.year);
}
