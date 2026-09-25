# LIFE ATLAS
## Antigravity Master Specification + Implementation Prompt Pack

**Document purpose:**  
This file is the single source of truth for building the Life Atlas project from an empty directory using Antigravity.

**Project type:** Personal digital life archive / cinematic travel journal / interactive atlas

**Primary focus:** Travel (approximately 70–80% of the experience)

**Secondary focus:** Food, cafés, cinema, photography, events, festivals, activities, memories, and personal writing

**Core idea:**

> A place for the moments I want to remember.

---

# 1. PROJECT VISION

Life Atlas is a personal digital archive.

It is not a tourism website.
It is not a booking website.
It is not a social network.
It is not a generic personal portfolio.
It is not a travel-agency template.
It is not an admin dashboard disguised as a website.
It should not look like an AI-generated landing page.

The website should feel like:

- a cinematic travel documentary
- a personal museum
- an editorial travel magazine
- a visual diary
- an interactive map of memories
- a long-term archive of meaningful experiences

The central experience is discovering a person's life through places.

The website should allow a visitor to move naturally through this chain:

    PERSON
       ↓
    PLACE
       ↓
    JOURNEY
       ↓
    MEMORY
       ↓
    PHOTOGRAPH
       ↓
    STORY

Everything should feel connected.

A trip can contain places.
A place can belong to multiple trips.
A photograph can belong to a place and a trip.
A journal entry can refer to a trip.
A timeline event can reference a memory.
An experience can be discovered from the map.
A search result should lead into the same connected content graph.

---

# 2. PRODUCT PRINCIPLES

## 2.1 Personal over generic

The website should feel like one person's world.

Avoid generic statements such as:

- "Discover the world"
- "Adventure awaits"
- "Explore amazing destinations"
- "Your journey starts here"

Prefer personal language such as:

- "Places that stayed with me."
- "A road I still remember."
- "The journey started before we reached the mountains."
- "Some places deserve more than a pin on a map."

The exact copy can evolve later, but the voice should remain personal.

---

## 2.2 Travel is the primary narrative

Approximately 70–80% of the visual emphasis and content model should be travel-oriented.

Travel includes:

- trips
- destinations
- places
- routes
- maps
- landscapes
- photography
- travel journals
- accommodations
- food during trips
- spontaneous stops
- memorable moments

The remaining 20–30% can document:

- food
- cafés
- movies
- events
- festivals
- photography outside travel
- activities
- random but meaningful memories

---

## 2.3 Curated archive, not an activity dump

Not every coffee, meal, movie, or outing needs an entry.

The content model should encourage meaningful documentation.

The editorial question is:

> Will I want to remember this years from now?

---

## 2.4 Data-driven architecture

Content must come from structured data.

Do not duplicate content in multiple pages.

For example, a trip record should automatically feed:

- the homepage
- trips page
- timeline
- map
- place pages
- related journal entries
- related photographs
- related experiences
- search

Adding a trip should primarily involve creating data, not rewriting UI.

---

# 3. DESIGN DIRECTION

The visual language must be:

- cinematic
- editorial
- atmospheric
- restrained
- minimal
- premium
- photographic
- emotional
- personal
- modern but not futuristic for the sake of being futuristic

Reference mood:

**editorial travel publication + private photo archive + interactive museum**

Avoid:

- SaaS UI
- dashboard aesthetics
- excessive glassmorphism
- excessive rounded cards
- giant gradient text
- random neon gradients
- floating blobs
- excessive shadows
- stock-photo travel template styling
- card-heavy layouts everywhere
- generic AI website patterns

---

# 4. TECHNOLOGY STACK

Use a modern stable stack compatible with the current Node.js LTS and current stable package ecosystem.

Core:

- Next.js
- App Router
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL

Animation / interaction:

- GSAP
- GSAP ScrollTrigger
- Lenis

UI / utilities:

- Lucide React
- date-fns
- Zod where validation is needed

Maps:

- Mapbox or another production-ready map provider
- Build a provider abstraction so the map implementation can be changed later

Optional:

- Framer Motion only when it is genuinely better suited than GSAP
- Three.js only if the globe/3D experience truly requires it

Do not add Three.js simply because it is popular.

Do not add a library for trivial functionality.

---

# 5. HIGH-LEVEL INFORMATION ARCHITECTURE

Public routes:

    /
    /explore
    /trips
    /trips/[slug]
    /places
    /places/[slug]
    /map
    /timeline
    /photography
    /experiences
    /food
    /cinema
    /journal
    /journal/[slug]
    /search
    /about

Potential future admin routes:

    /admin
    /admin/trips
    /admin/places
    /admin/photos
    /admin/journal
    /admin/experiences

Do not build the admin system in the initial implementation unless specifically requested.

---

# 6. GLOBAL NAVIGATION

Desktop navigation should stay minimal.

Recommended:

    LIFE ATLAS

    Explore
    Trips
    Map
    Timeline
    Journal
    About

Include a search trigger.

A fullscreen navigation can contain secondary content.

Do not put every content category into the main navbar.

---

# 7. FULLSCREEN NAVIGATION

When the menu opens:

Use a full-screen overlay.

Large editorial typography:

    EXPLORE
    TRIPS
    PLACES
    MAP
    TIMELINE
    PHOTOGRAPHY
    EXPERIENCES
    JOURNAL
    ABOUT

Secondary categories:

    Food
    Cinema
    Cafés
    Events
    Festivals
    Activities

Animation:

1. Overlay fades in.
2. Main content appears with staggered vertical reveals.
3. Background elements move subtly.
4. Hovering a link creates a visual response.
5. Closing reverses the sequence.

Use GSAP.

Navigation must remain keyboard accessible.

---

# 8. TYPOGRAPHY

Preferred typography hierarchy:

## Display

Use a high-quality editorial serif such as:

- Canela
- or a legally licensed equivalent

Use for:

- hero headings
- major page titles
- trip titles
- emotional statements

## Sans

Use:

- General Sans
- Satoshi
- or another similar licensed sans-serif

Use for:

- navigation
- metadata
- UI
- controls
- labels

## Body

Use:

- Inter
- or equivalent highly readable sans-serif

Use for:

- journal content
- descriptions
- supporting text

If custom font files are not available, use high-quality fallbacks.

Do not download proprietary font files without permission.

Create a font abstraction so typography can be changed later without rewriting components.

---

# 9. COLOR SYSTEM

The website should use a restrained palette.

Foundation:

- warm off-white
- near-black
- deep charcoal
- soft muted gray

Text:

- strong dark text
- muted secondary text
- light text on dark sections

Accent:

- muted earth-derived accent colors

Individual stories may have subtle local accents, but the global identity must remain consistent.

Examples:

Mountain trip:

- stone
- muted green
- fog
- cool blue

Desert trip:

- sand
- clay
- warm brown

Important:

Do not turn every page into a different color theme.

The website should still clearly belong to the same visual system.

---

# 10. SPACING AND LAYOUT

Use a consistent spacing scale.

Create reusable layout primitives:

- PageContainer
- Section
- SectionHeader
- FullBleedSection
- SplitLayout
- EditorialGrid

Use wide desktop margins.

Photography may extend outside the main content container.

Avoid constant centered-card layouts.

Use asymmetric compositions intentionally.

---

# 11. HOMEPAGE

Route:

    /

The homepage is the emotional entry point.

It should feel like opening a documentary rather than opening a portfolio.

Recommended order:

1. Opening hero
2. World / Earth transition
3. Featured journeys
4. Life statistics
5. Timeline preview
6. Photography story
7. Life beyond travel
8. Final CTA
9. Footer

---

# 12. HOMEPAGE HERO

The first screen should be cinematic.

Full viewport height.

Suggested copy:

    A place for the moments I want to remember.

Supporting text:

    Travels, places, people, food, films and everything in between.

Additional subtle elements:

- year / current archive period
- scroll indicator
- current location label if relevant
- small navigation

The hero should not look like a marketing landing page.

Use:

- large display typography
- strong negative space
- atmospheric background
- subtle grain
- slow motion
- editorial positioning

---

# 13. HERO BACKGROUND

Support:

- full-screen image
- optional video
- optional image sequence

Architecture should allow the visual source to change later without changing hero structure.

Use Next.js Image where possible.

For video:

- lazy-load when appropriate
- respect reduced motion
- avoid autoplay with sound
- keep file size under control

---

# 14. HERO ANIMATION

On initial load:

- very subtle background reveal
- title enters with an editorial motion
- supporting text appears after the title
- navigation settles into position

On scroll:

- hero title shifts subtly
- background scale changes slightly
- hero fades into the next chapter
- no sudden or gimmicky zoom

Use GSAP and ScrollTrigger.

Respect:

    prefers-reduced-motion: reduce

When reduced motion is enabled:

- remove major parallax
- reduce transitions
- avoid aggressive scale effects
- avoid large WebGL movement

---

# 15. EARTH / GLOBE TRANSITION

This is a signature element.

After the opening hero, scrolling should transition toward a representation of Earth.

Concept:

    HERO
      ↓
    ATMOSPHERE
      ↓
    EARTH / WORLD
      ↓
    LOCATION POINTS
      ↓
    JOURNEYS

The globe should feel:

- quiet
- cinematic
- geographic
- atmospheric

It must NOT feel like:

- a business dashboard
- a network monitoring interface
- an analytics visualization

Potential implementation:

- Mapbox globe
- Three.js globe
- another lightweight globe solution

Choose the simplest technology that can deliver the intended visual result.

Architecture requirement:

The homepage should use a component such as:

    EarthJourneySection

rather than tying the page directly to a low-level map library.

The component can internally use Mapbox or WebGL.

---

# 16. GLOBE INTERACTIONS

Show important visited locations.

Each location can have:

- small glowing marker
- year
- destination label

On hover:

    CHOPTA
    Uttarakhand, India
    2026

On click:

Open:

    /places/chopta

or the related journey depending on the content model.

Do not show hundreds of labels simultaneously.

Use visual restraint.

When markers become dense, cluster them.

---

# 17. FEATURED JOURNEYS

Section title:

    SELECTED JOURNEYS

Display 3–6 featured trips.

Use editorial layouts.

Avoid identical card grids.

Possible arrangement:

    Large feature
    Two smaller features
    Full-bleed feature
    Horizontal editorial strip

Trip item should show:

- index
- title
- destination
- date
- duration
- cover image
- short description

Example:

    01

    THE HIMALAYAN JOURNEY

    Uttarakhand, India
    5 days · 2026

    A road through mountains,
    mist and quiet places.

    Explore journey →

---

# 18. LIFE STATISTICS

Show a restrained animated statistics section.

Examples:

    TRIPS
    12

    PLACES
    47

    CITIES
    32

    PHOTOGRAPHS
    1,284

    MEMORIES
    86

Important:

These values must be derived from real database counts.

Seed data can produce development numbers, but production should be data-driven.

Use animated numbers sparingly.

---

# 19. TIMELINE PREVIEW

Homepage should contain a compressed timeline.

Example:

    2026

    SEPTEMBER
    Himalayan Journey

    AUGUST
    Delhi exploration

    JULY
    Jaipur

    JUNE
    Hyderabad

Clicking an item should lead to the relevant entity.

CTA:

    Explore the timeline →

---

# 20. PHOTOGRAPHY STORY

Do not use a generic photo grid.

Create an editorial photo composition.

Use combinations of:

- portrait photos
- landscape photos
- large full-width photos
- overlapping images
- negative space
- captions
- location labels

On hover:

- subtle scale
- metadata reveal
- cursor response

Clicking opens a fullscreen viewer.

---

# 21. FULLSCREEN PHOTO VIEWER

Requirements:

- open image
- previous
- next
- close
- keyboard navigation
- swipe on mobile
- image caption
- location
- date
- related trip

Keyboard:

    Escape = close
    ArrowLeft = previous
    ArrowRight = next

Focus should stay inside the modal while it is open.

---

# 22. LIFE BEYOND TRAVEL

Section headline:

    And everything else worth remembering.

Show:

- food
- cafés
- cinema
- events
- festivals
- activities
- random memories

This section communicates the broader purpose of Life Atlas.

Travel remains the main identity.

---

# 23. FINAL HOMEPAGE CTA

End the homepage with a powerful minimal section.

Suggested:

    Keep moving.
    Keep remembering.

CTA:

    Explore the atlas →

Do not use a typical large marketing CTA block.

---

# 24. EXPLORE PAGE

Route:

    /explore

Purpose:

Central discovery hub.

Categories:

    All
    Travel
    Food
    Cinema
    Events
    Photography
    Journal
    Memories

Additional filters:

- year
- country
- region
- city
- category

Filters should be reflected in URL search parameters.

Example:

    /explore?category=travel&year=2026

This makes filtering shareable and bookmarkable.

---

# 25. TRIPS PAGE

Route:

    /trips

Purpose:

Show all journeys.

Trip cards should include:

- cover
- title
- country
- region/city
- date
- duration
- short description

Sort options:

- latest
- oldest
- longest
- most photos

Default:

    latest

Use server-rendered data where practical.

---

# 26. TRIP DETAIL PAGE

Route:

    /trips/[slug]

This is one of the most important pages on the website.

Recommended structure:

1. Hero
2. Introduction
3. Overview
4. Day-by-day journey
5. Route map
6. Photo story
7. Food
8. Accommodation
9. Budget
10. Personal tips
11. Journal
12. Gallery
13. Next journey

---

# 27. TRIP HERO

Full-bleed cover image.

Overlay:

    UTTARAKHAND

    The Himalayan Journey

    2026
    5 days

Include subtle location/date information.

The title should dominate.

---

# 28. TRIP INTRODUCTION

A short personal paragraph.

Do not use generic destination-guide writing.

Write from the perspective of the person who experienced the trip.

Possible structure:

    Why the trip happened
    What made it memorable
    Emotional context
    One memorable detail

---

# 29. TRIP OVERVIEW

Show:

    START
    Delhi

    DESTINATION
    Uttarakhand

    DURATION
    5 days

    PLACES
    8

    PHOTOGRAPHS
    120

Optional:

    DISTANCE
    xxx km

Only show fields that have real data.

---

# 30. DAY-BY-DAY JOURNEY

Trip days should be first-class records.

Example:

    DAY 01
    Delhi → Haridwar

    DAY 02
    Haridwar → Rudraprayag

    DAY 03
    Rudraprayag → Ukhimath → Chopta

Each day can include:

- date
- title
- description
- places
- photographs
- route points
- food
- memorable moments

---

# 31. TRIP ROUTE MAP

Display:

- origin
- destination
- stops
- viewpoints
- food stops
- memorable locations

Map lines should reflect the journey when coordinates are available.

Do not pretend there was a route if the data does not contain one.

Map can default to a static overview and become interactive on demand on mobile for performance.

---

# 32. TRIP PHOTOGRAPHY

Use a visual narrative rather than a basic grid.

A trip may contain:

- hero image
- wide landscape image
- portrait image
- vertical phone photograph
- close-up detail
- route photograph
- final image

Allow photos to appear in a specific editorial order.

Use a `displayOrder` or equivalent field.

---

# 33. TRIP FOOD

Food records should be linked to the trip when relevant.

Fields:

- name
- location
- date
- photo
- personal note

This is not a restaurant review platform.

---

# 34. TRIP ACCOMMODATION

Optional section.

Fields:

- name
- location
- dates
- image
- note

Do not expose private booking information.

---

# 35. TRIP BUDGET

Optional.

Categories:

    Transport
    Stay
    Food
    Activities
    Other
    Total

Data can be stored as individual expense records in a later phase.

Do not invent amounts in real content.

Seed data may use clearly fictional values.

---

# 36. TRIP TIPS

Personal notes only.

Examples:

- route observations
- weather observations
- what to carry
- timing lessons
- personal mistakes
- useful stops

Do not frame these as universal expert advice unless sourced and verified.

---

# 37. TRIP JOURNAL

A trip can link to one or more journal entries.

Show:

- title
- excerpt
- date
- cover

Clicking opens:

    /journal/[slug]

---

# 38. TRIP GALLERY

Provide full-trip browsing.

Requirements:

- fast loading
- responsive images
- captions
- keyboard controls on desktop
- touch controls on mobile

---

# 39. NEXT JOURNEY

End each trip page with another journey.

Selection can be:

- related destination
- nearby date
- same region
- otherwise latest different trip

Do not use a scoring/ranking system.

---

# 40. PLACES PAGE

Route:

    /places

Show visited places.

Possible hierarchy:

    Country
      Region
        City / locality
          Place

Each place:

- name
- region
- country
- image
- number of trips
- visit date(s)

---

# 41. PLACE DETAIL PAGE

Route:

    /places/[slug]

Sections:

1. Hero
2. Location information
3. Map
4. Personal description
5. Related trips
6. Photos
7. Experiences
8. Journal entries
9. Timeline entries

The place page should feel like a chapter of the archive.

---

# 42. MAP PAGE

Route:

    /map

This is a major feature.

The entire visited world should be browsable.

Filters:

    All
    Trips
    Places
    Food
    Events
    Photography

Interaction:

- pan
- zoom
- marker hover
- marker click
- cluster handling
- mobile controls

Marker popup:

    CHOPTA

    Uttarakhand, India

    Visited:
    2026

    The Himalayan Journey

    View →

---

# 43. MAP PROVIDER ABSTRACTION

Create:

    components/map/AtlasMap.tsx
    components/map/MapMarker.tsx
    components/map/MapPopup.tsx

Do not make every page know about Mapbox-specific APIs.

The public UI should communicate in domain terms:

    place
    trip
    experience

The map adapter should handle provider-specific logic.

---

# 44. TIMELINE PAGE

Route:

    /timeline

Show the archive chronologically.

Group by year.

Example:

    2026
    ────────────────────

    September
    Himalayan Journey

    August
    Delhi exploration

    July
    Jaipur

    2025
    ────────────────────

    December
    Vertica

Timeline events may reference:

- trip
- place
- experience
- memory
- journal entry
- project
- movie
- food

---

# 45. PHOTOGRAPHY PAGE

Route:

    /photography

Photography is a first-class section.

Filters:

    All
    Travel
    Nature
    Architecture
    Food
    People
    Street
    Night

Show metadata:

- caption
- date
- place
- trip

Avoid captions that feel like stock photography metadata.

Keep them personal.

---

# 46. EXPERIENCES PAGE

Route:

    /experiences

Categories:

    Food
    Cinema
    Cafés
    Events
    Festivals
    Activities
    People
    Random

Each experience:

- title
- category
- date
- location
- image
- short description
- related trip/place

---

# 47. FOOD PAGE

Route:

    /food

Personal food archive.

Record:

- name
- location
- date
- image
- notes
- related trip
- related place

The important part is the memory, not restaurant rankings.

---

# 48. CINEMA PAGE

Route:

    /cinema

Record movies watched.

Fields:

- movie title
- watched date
- cinema/platform
- location
- personal note
- image

Optional personal rating can exist, but it should not turn the whole page into a film-review platform.

---

# 49. JOURNAL PAGE

Route:

    /journal

Editorial listing.

Each entry:

- title
- date
- cover image
- excerpt
- related trip/place
- reading time if calculated

Keep typography highly readable.

---

# 50. JOURNAL DETAIL PAGE

Route:

    /journal/[slug]

Use a distraction-free article layout.

Structure:

    title
    date
    context
    cover
    body
    related media
    related place/trip
    next article

Typography should support long reading sessions.

Use a narrower reading column than the rest of the site.

---

# 51. SEARCH

Global search should cover:

- trips
- places
- photographs
- experiences
- food
- cinema
- journal
- memories

Keyboard shortcut:

    Cmd/Ctrl + K

Alternative:

    /

Search overlay:

    Search the atlas...

Results grouped:

    TRIPS
    PLACES
    JOURNAL
    PHOTOGRAPHS
    EXPERIENCES

Use debounced input.

Do not query the server on every keystroke without debounce.

---

# 52. ABOUT PAGE

Route:

    /about

It should not read like a corporate CV.

Explain:

- why the archive exists
- why travel matters
- why memories are being preserved
- role of photography
- relationship between places and stories
- technology behind the project

Example philosophy:

> Life moves too quickly to remember everything.
> Life Atlas exists to keep the moments that deserve to stay.

This copy is a direction, not mandatory final text.

---

# 53. FOOTER

Minimal footer:

    LIFE ATLAS

    A personal archive of places,
    journeys and moments worth remembering.

    Explore
    Trips
    Map
    Journal
    About

    © 2026

Optional:

    Built with curiosity.

Avoid a large corporate footer.

---

# 54. DATA MODEL

Use Prisma + PostgreSQL.

Core entities:

## User

Fields:

    id
    name
    email
    createdAt
    updatedAt

---

## Trip

Fields:

    id
    title
    slug
    description
    coverImage
    startDate
    endDate
    country
    region
    status
    featured
    createdAt
    updatedAt

---

## Place

Fields:

    id
    name
    slug
    country
    region
    city
    latitude
    longitude
    description
    coverImage
    createdAt
    updatedAt

---

## TripPlace

Many-to-many relationship.

Fields:

    tripId
    placeId
    displayOrder

Unique constraint:

    tripId + placeId

---

## TripDay

Fields:

    id
    tripId
    dayNumber
    date
    title
    description

Optional relations to route points / places.

---

## Memory

Fields:

    id
    title
    slug
    description
    date
    category
    locationText
    image
    content
    createdAt
    updatedAt

---

## Photo

Fields:

    id
    url
    alt
    caption
    date
    latitude
    longitude
    tripId
    placeId
    category
    displayOrder
    width
    height

Store image dimensions to avoid layout shift.

---

## JournalEntry

Fields:

    id
    title
    slug
    excerpt
    content
    coverImage
    publishedAt
    tripId
    placeId
    createdAt
    updatedAt

---

## Experience

Fields:

    id
    title
    slug
    description
    category
    date
    locationText
    image
    content
    tripId
    placeId
    createdAt
    updatedAt

---

## FoodExperience

Fields:

    id
    name
    description
    locationText
    date
    image
    notes
    tripId
    placeId
    createdAt
    updatedAt

---

## Movie

Fields:

    id
    title
    watchedAt
    locationText
    platform
    notes
    image
    createdAt
    updatedAt

---

## TimelineEvent

Fields:

    id
    title
    description
    date
    type
    image
    tripId
    placeId
    memoryId
    journalEntryId
    createdAt

---

# 55. OPTIONAL FUTURE ENTITIES

Do not implement unless needed.

Potential future tables:

    Expense
    Accommodation
    RoutePoint
    Tag
    MediaCollection
    TripParticipant
    Country
    City
    Event

The architecture should not block these additions.

---

# 56. ENUMS

ExperienceCategory:

    TRAVEL
    FOOD
    CINEMA
    CAFE
    EVENT
    FESTIVAL
    PHOTOGRAPHY
    ACTIVITY
    MEMORY
    OTHER

TripStatus:

    PLANNED
    ONGOING
    COMPLETED

TimelineType:

    TRIP
    PLACE
    EXPERIENCE
    MEMORY
    JOURNAL
    CINEMA
    FOOD
    PROJECT
    OTHER

---

# 57. RELATIONAL DESIGN

A typical trip:

    The Himalayan Journey

connects to:

    Uttarakhand
    Rudraprayag
    Ukhimath
    Chopta
    Haridwar

and to:

    TripDays
    Photos
    FoodExperiences
    JournalEntries
    Memories
    TimelineEvents

A place such as Chopta may connect to multiple trips over time.

A photo can belong to both:

    trip
    place

The UI should use these relationships to create navigation.

---

# 58. QUERY LAYER

Do not scatter Prisma queries across React components.

Create reusable query functions, for example:

    lib/queries/trips.ts
    lib/queries/places.ts
    lib/queries/photos.ts
    lib/queries/journal.ts
    lib/queries/experiences.ts
    lib/queries/timeline.ts
    lib/queries/search.ts

Examples:

    getTrips()
    getFeaturedTrips()
    getTripBySlug()
    getPlaces()
    getPlaceBySlug()
    getPhotos()
    getTimeline()
    getJournalEntries()
    getJournalEntryBySlug()
    getExperiences()
    searchAtlas()

---

# 59. TYPES

Avoid leaking Prisma types blindly into the entire UI.

Create domain-oriented view types where useful.

For example:

    TripCardData
    TripDetailData
    PlaceCardData
    PhotoItem
    TimelineItem
    SearchResult

Keep UI types stable even if the database schema evolves.

---

# 60. SERVER VS CLIENT

Prefer Server Components for:

- database reads
- static page content
- SEO content
- trip detail data
- place detail data
- journal content

Use Client Components only for:

- maps
- galleries
- animations requiring browser APIs
- menu interactions
- search input
- interactive filters
- custom cursor
- scrolling effects

Do not turn the entire application into one client component.

---

# 61. SMOOTH SCROLL

Create a single smooth-scroll provider.

Suggested:

    components/layout/SmoothScroll.tsx

Initialize Lenis once.

Synchronize GSAP with Lenis only where necessary.

Do not initialize Lenis separately on every page.

Make cleanup reliable.

---

# 62. ANIMATION SYSTEM

Create:

    animations/
        hero.ts
        reveals.ts
        pageTransitions.ts
        menu.ts
        gallery.ts
        scroll.ts

Build reusable animation utilities.

Do not write one-off GSAP logic everywhere.

---

# 63. GSAP GUIDELINES

Use:

    gsap.context()

Clean up:

    ScrollTrigger
    timelines
    event listeners

Use refs correctly.

Avoid direct DOM querying where React refs can be used.

Use ScrollTrigger for:

- section reveals
- parallax
- hero transitions
- editorial image movement
- timeline effects
- globe transition

Do not animate every element.

---

# 64. ANIMATION TIMING

Micro interaction:

    0.2–0.4s

Standard:

    0.5–0.8s

Cinematic:

    1–2s

Never make basic navigation painfully slow.

Animation should support storytelling, not become the story.

---

# 65. CUSTOM CURSOR

Desktop only.

States:

    default
    hover
    link
    image
    drag

Example over an image:

    VIEW

Example over draggable gallery:

    DRAG

Disable on:

- touch devices
- small screens

Do not let the custom cursor interfere with accessibility.

---

# 66. IMAGE ARCHITECTURE

Use Next.js Image wherever practical.

Store:

    url
    alt
    caption
    date
    width
    height
    trip
    place
    category
    displayOrder

Never distort photos.

Use correct aspect-ratio containers.

Lazy-load non-critical images.

Preload only truly important hero assets.

---

# 67. IMAGE CONTENT GUIDELINES

Do not use random stock imagery as permanent content.

Development can use placeholders.

The structure should make replacing placeholder images with real photos simple.

Possible seed folders:

    public/images/seed/trips/
    public/images/seed/places/
    public/images/seed/experiences/

The content should clearly be treated as demo data.

---

# 68. PERFORMANCE

Targets:

- fast initial render
- optimized images
- minimal client-side JavaScript
- no layout shift
- sensible animation cost
- map loaded intelligently
- globe effects reduced on low-powered devices

Do not ship large visual effects before measuring their impact.

---

# 69. RESPONSIVE DESIGN

Design for:

- mobile
- tablet
- laptop
- large desktop

Tailwind breakpoints:

    sm
    md
    lg
    xl
    2xl

Do not create dozens of custom breakpoints.

---

# 70. MOBILE UX

Mobile is not desktop squeezed into a narrow screen.

On mobile:

- navigation becomes fullscreen
- map controls simplify
- galleries become swipe-based
- editorial grids become intentional vertical compositions
- typography scales down
- heavy WebGL effects may simplify
- custom cursor disappears

The first screen should still feel cinematic.

---

# 71. ACCESSIBILITY

Implement:

- semantic HTML
- headings in logical order
- keyboard navigation
- visible focus states
- aria-labels
- accessible buttons
- accessible dialogs
- alt text
- reduced-motion support
- sufficient color contrast

Gallery modal:

- focus trap
- Escape to close
- labelled dialog

Menu:

- Escape to close
- logical focus order
- active focus
- keyboard operation

---

# 72. URL AND ROUTING RULES

Use readable slugs.

Examples:

    /trips/the-himalayan-journey
    /places/chopta
    /journal/the-road-into-the-mountains

Do not expose database IDs in the URL unless there is a strong reason.

---

# 73. SEO

Every content page needs dynamic metadata.

Trip:

    title
    description
    OpenGraph image
    canonical

Place:

    title
    description
    OpenGraph image
    canonical

Journal:

    title
    description
    OpenGraph image
    canonical

Add:

    sitemap
    robots
    canonical URLs

Create metadata with Next.js metadata APIs.

---

# 74. SOCIAL SHARING

OpenGraph examples:

    THE HIMALAYAN JOURNEY

    Uttarakhand · 2026

    [cover image]

Do not create generic website metadata for every route.

Make content-specific sharing cards.

---

# 75. ERROR STATES

Create:

    app/error.tsx
    app/not-found.tsx
    app/loading.tsx

Not found copy may be:

    This journey could not be found.

Journal:

    This story could not be found.

Do not expose raw server/database errors.

---

# 76. LOADING STATES

Do not use generic:

    Loading...

Prefer:

- subtle skeleton
- low-opacity placeholders
- image reveal
- progressive loading

For major routes, loading should visually match the site's language.

---

# 77. EMPTY STATES

Journal:

    Nothing written here yet.

    Some memories are still waiting for words.

Photography:

    No photographs here yet.

    This story is still waiting to be captured.

Trips:

    No journeys have been archived yet.

Keep copy calm and personal.

---

# 78. SEARCH IMPLEMENTATION

Phase 1:

PostgreSQL based search.

Search relevant fields:

- title
- description
- content
- location
- category

Use appropriate indexes and queries.

Add debounce.

Return:

    type
    title
    slug
    excerpt
    image
    location
    date

Future replacement should be possible with:

- PostgreSQL full-text
- Meilisearch
- Algolia

Do not make the UI dependent on one search vendor.

---

# 79. ADMIN FUTURE PLAN

Future admin capability:

    Create trip
    Edit trip
    Add places
    Upload photos
    Create journal
    Add experiences
    Manage timeline

Initial project does NOT need admin.

However, do not design the data model in a way that makes admin impossible later.

---

# 80. ENVIRONMENT VARIABLES

Create:

    .env.example

Example:

    DATABASE_URL=
    NEXT_PUBLIC_MAPBOX_TOKEN=

Only values that are safe to expose publicly may use:

    NEXT_PUBLIC_

Never put database credentials in public environment variables.

---

# 81. DEVELOPMENT CONTENT

Seed realistic demo data.

Do not use lorem ipsum.

Suggested demo trips:

    The Himalayan Journey
    A Weekend in Jaipur
    Monsoon in the Hills
    A Quiet Weekend in Delhi

Suggested places:

    Chopta
    Ukhimath
    Rudraprayag
    Haridwar
    Jaipur
    Delhi
    etc.

Clearly treat these as development data until replaced by real content.

---

# 82. SEED DATA VOLUME

Development seed:

    4 trips
    10 places
    15 trip days
    25–30 photographs
    10 experiences
    5 food experiences
    5 cinema records
    5 journal entries
    20 timeline events

Relationships must be valid.

Statistics on the site should derive from this seed.

---

# 83. PROJECT STRUCTURE

Recommended:

    life-atlas/
    │
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── globals.css
    │   ├── error.tsx
    │   ├── not-found.tsx
    │   ├── loading.tsx
    │   │
    │   ├── explore/
    │   │   └── page.tsx
    │   │
    │   ├── trips/
    │   │   ├── page.tsx
    │   │   └── [slug]/
    │   │       └── page.tsx
    │   │
    │   ├── places/
    │   │   ├── page.tsx
    │   │   └── [slug]/
    │   │       └── page.tsx
    │   │
    │   ├── map/
    │   │   └── page.tsx
    │   │
    │   ├── timeline/
    │   │   └── page.tsx
    │   │
    │   ├── photography/
    │   │   └── page.tsx
    │   │
    │   ├── experiences/
    │   │   └── page.tsx
    │   │
    │   ├── food/
    │   │   └── page.tsx
    │   │
    │   ├── cinema/
    │   │   └── page.tsx
    │   │
    │   ├── journal/
    │   │   ├── page.tsx
    │   │   └── [slug]/
    │   │       └── page.tsx
    │   │
    │   ├── search/
    │   │   └── page.tsx
    │   │
    │   └── about/
    │       └── page.tsx
    │
    ├── components/
    │   ├── layout/
    │   ├── navigation/
    │   ├── hero/
    │   ├── trips/
    │   ├── places/
    │   ├── map/
    │   ├── photography/
    │   ├── experiences/
    │   ├── food/
    │   ├── cinema/
    │   ├── journal/
    │   ├── timeline/
    │   ├── search/
    │   └── ui/
    │
    ├── lib/
    │   ├── prisma.ts
    │   ├── utils.ts
    │   ├── dates.ts
    │   ├── constants.ts
    │   └── queries/
    │       ├── trips.ts
    │       ├── places.ts
    │       ├── photos.ts
    │       ├── journal.ts
    │       ├── experiences.ts
    │       ├── timeline.ts
    │       └── search.ts
    │
    ├── hooks/
    │   ├── useLenis.ts
    │   ├── useMediaQuery.ts
    │   └── useScrollProgress.ts
    │
    ├── animations/
    │   ├── hero.ts
    │   ├── reveals.ts
    │   ├── pageTransitions.ts
    │   ├── menu.ts
    │   └── gallery.ts
    │
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts
    │
    ├── public/
    │   ├── images/
    │   ├── icons/
    │   └── fonts/
    │
    ├── types/
    │   └── index.ts
    │
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    └── ...

The exact structure can be adapted to standard Next.js conventions, but the separation of concerns must remain.

---

# 84. COMPONENT PRINCIPLES

Reusable primitives:

    Container
    Section
    SectionHeading
    Eyebrow
    Button
    TextLink
    Divider
    ResponsiveImage
    Tag
    Reveal
    AnimatedNumber

Content components:

    TripCard
    TripGrid
    FeaturedTrip
    TripHero
    TripStats
    TripDay
    TripRouteMap
    PlaceCard
    ExperienceCard
    FoodCard
    JournalCard
    PhotoStory
    PhotoViewer
    Timeline
    TimelineItem
    MapPreview
    AtlasMap
    MapMarker
    MapPopup
    SearchOverlay
    FullscreenMenu
    PageTransition
    Stats

---

# 85. HOMEPAGE COMPONENT TREE

Expected shape:

    <HomePage>
        <Hero />
        <EarthJourneySection />
        <FeaturedJourneys />
        <LifeStats />
        <TimelinePreview />
        <PhotoStory />
        <LifeBeyondTravel />
        <FinalCTA />
    </HomePage>

Do not put all logic into page.tsx.

---

# 86. TRIP PAGE COMPONENT TREE

    <TripPage>
        <TripHero />
        <TripIntroduction />
        <TripStats />
        <JourneyTimeline />
        <TripRouteMap />
        <TripPhotoStory />
        <TripFood />
        <TripAccommodation />
        <TripBudget />
        <TripTips />
        <TripJournal />
        <TripGallery />
        <NextJourney />
    </TripPage>

---

# 87. NO DUPLICATED DATA

Bad:

    hardcoded trip title on home
    hardcoded trip title on trip page
    hardcoded place title on map

Good:

    database → query layer → domain data → UI

---

# 88. TYPE SAFETY

Use TypeScript strict mode.

Avoid `any`.

When third-party libraries have awkward typing:

- isolate the typing workaround
- document it
- do not spread `any` across the project

---

# 89. CODE COMMENTS

Comments should explain why.

Avoid:

    // Render heading

Prefer:

    // Keep the hero animation client-side because ScrollTrigger
    // requires browser APIs.

---

# 90. GIT HYGIENE

Create a sensible `.gitignore`.

Never commit:

- `.env.local`
- database secrets
- private API keys
- generated secret files
- local editor caches unless intentionally shared
- large temporary build files

---

# 91. FIRST-RUN COMMANDS

Once the project is generated:

    npm install

Then:

    npx prisma generate

Then:

    npx prisma migrate dev

Then:

    npm run dev

Also verify:

    npm run lint

And when available:

    npm run build

---

# 92. DEVELOPMENT VERIFICATION

After each phase:

1. Start the dev server.
2. Open the browser.
3. Test the relevant routes.
4. Check browser console.
5. Check terminal logs.
6. Check TypeScript.
7. Check mobile layout.
8. Check reduced motion.
9. Check image loading.
10. Only then continue.

Do not assume generated code is correct merely because the files exist.

---

# 93. BUILD PHASES

Do NOT ask Antigravity to build the whole application in one generation.

Use controlled phases.

---

# PHASE 01 — FOUNDATION + VISUAL IDENTITY

Implement:

- Next.js setup
- TypeScript
- Tailwind
- global CSS
- design tokens
- typography
- root layout
- navigation
- fullscreen menu
- footer
- Lenis
- GSAP foundation
- page transition foundation
- homepage hero
- reduced motion

Do NOT implement the database yet.

Do NOT implement all content pages yet.

Acceptance criteria:

- site boots cleanly
- no TypeScript errors
- no hydration errors
- navigation works
- menu works
- smooth scrolling works
- homepage feels cinematic
- mobile works

---

# PHASE 02 — DATABASE + DOMAIN MODEL

Implement:

- PostgreSQL connection
- Prisma schema
- migrations
- seed
- query layer
- TypeScript domain types

Acceptance:

- database generates successfully
- migrations work
- seed works
- relationships are valid
- query functions work

---

# PHASE 03 — HOMEPAGE CONTENT SYSTEM

Replace static placeholders with database content.

Implement:

- featured trips
- stats
- timeline preview
- photo story
- life beyond travel

Acceptance:

- homepage content is data driven
- statistics come from database
- links work
- images are responsive

---

# PHASE 04 — TRIPS

Implement:

    /trips
    /trips/[slug]

Include:

- trip list
- trip hero
- overview
- day-by-day timeline
- route map
- photography
- food
- accommodation
- budget
- tips
- journal
- gallery
- next journey

Acceptance:

- all seed trips render
- invalid slug returns not-found
- related content works
- gallery works
- route works

---

# PHASE 05 — PLACES + GLOBAL MAP

Implement:

    /places
    /places/[slug]
    /map

Acceptance:

- place pages render
- visited places appear
- filters work
- map markers work
- clicking marker opens the relevant content
- mobile map remains usable

---

# PHASE 06 — TIMELINE + EXPERIENCES

Implement:

    /timeline
    /experiences
    /food
    /cinema

Acceptance:

- chronological order works
- category filters work
- related trip/place links work

---

# PHASE 07 — PHOTOGRAPHY + JOURNAL

Implement:

    /photography
    /journal
    /journal/[slug]

Acceptance:

- visual archive works
- filters work
- gallery works
- journal typography is readable
- related content works

---

# PHASE 08 — EXPLORE + SEARCH

Implement:

    /explore
    /search

Acceptance:

- filters use URL params
- search is debounced
- results are grouped
- keyboard shortcut works
- results link to the correct entity

---

# PHASE 09 — POLISH

Implement:

- responsive refinement
- loading states
- empty states
- error states
- metadata
- sitemap
- robots
- OpenGraph
- accessibility pass
- performance pass
- reduced-motion refinement

---

# 94. PAGE ACCEPTANCE CHECKLIST

For every page verify:

## Content

- real data source
- no duplicated hardcoded data
- valid relationships

## Visual

- desktop
- tablet
- mobile
- typography
- spacing
- images

## Interaction

- links
- hover states
- keyboard
- touch

## Technical

- no console errors
- no hydration warnings
- no TypeScript errors
- no unnecessary client components

---

# 95. RESPONSIVE QA

At minimum test:

- 375px
- 390px
- 430px
- 768px
- 1024px
- 1280px
- 1440px
- 1920px

Check:

- hero text
- nav
- menu
- image crops
- grids
- map
- gallery
- journal width
- buttons
- long titles

---

# 96. ANIMATION QA

Test:

- first load
- scrolling
- route transitions
- menu open
- menu close
- gallery open
- gallery close
- map interactions

Check:

- no animation leaks
- no duplicate ScrollTriggers
- no jumpy scroll
- no broken layouts
- no animation blocking navigation

---

# 97. ACCESSIBILITY QA

Verify:

- keyboard through navbar
- keyboard through menu
- focus visible
- Escape closes overlays
- gallery is keyboard usable
- alt text exists
- headings make semantic sense
- buttons are real buttons
- links are real links
- reduced motion works

---

# 98. PERFORMANCE QA

Check:

- image payloads
- font payloads
- JS bundle
- map initialization cost
- globe initialization cost
- mobile GPU load

Do not preload every image.

Do not mount every expensive interactive component globally.

---

# 99. CONTENT EDITING PHILOSOPHY

Real personal content should replace seed content incrementally.

Never require a redesign simply because a trip gains:

- more photos
- more journal entries
- more places
- a new day
- a new experience

The data model should absorb growth.

---

# 100. LONG-TERM EXTENSIBILITY

Future possibilities:

- private admin
- authentication
- cloud image uploads
- image optimization pipeline
- GPS/EXIF import
- trip import
- GPX route import
- richer map layers
- country map
- travel statistics
- offline archive
- PWA
- shareable trip pages
- printable trip pages
- annual recap
- yearly archive
- memory search
- AI-assisted tagging as an internal tool only

None of these should complicate the first implementation unnecessarily.

---

# 101. IMPORTANT CONTENT SAFETY / PRIVACY PRINCIPLE

Because this is a personal archive:

Do not expose sensitive private information.

Do not include:

- home addresses
- private phone numbers
- booking confirmation numbers
- passport details
- private travel companion details unless intentionally documented
- private credentials
- private API keys

Location information should be as precise as the owner intentionally wants to make public.

---

# 102. ANTIGRAVITY WORKFLOW RULES

When Antigravity receives a phase prompt:

1. Read this entire specification.
2. Inspect the existing repository.
3. Identify what already exists.
4. Reuse existing components.
5. Make the smallest clean change required.
6. Run checks.
7. Inspect the browser where relevant.
8. Fix errors.
9. Summarize exactly what changed.
10. Stop at the requested phase.

Do not silently implement future phases.

---

# 103. ANTIGRAVITY "DO NOT" LIST

Do not:

- generate every page at once
- duplicate components
- hardcode content into JSX
- create a generic dashboard
- use lorem ipsum as final copy
- use random stock photos as permanent content
- introduce unnecessary libraries
- add Three.js without justification
- make the entire site client-side
- use `any` everywhere
- ignore mobile
- ignore reduced motion
- ignore accessibility
- hide TypeScript errors
- suppress lint rules unnecessarily
- fake database statistics
- expose secrets
- create an admin panel before requested

---

# 104. MASTER IMPLEMENTATION PROMPT

Use the following prompt when starting Antigravity from an empty directory.

---

BEGIN PROMPT

You are building **Life Atlas**.

Read the complete `LIFE_ATLAS_ANTIGRAVITY_SPEC.md` before making changes.

Life Atlas is a personal digital life archive with travel as its primary focus.

This is not a travel agency, travel blog template, booking site, social network, SaaS dashboard, or generic portfolio.

The visual identity must be cinematic, editorial, minimal, photographic, atmospheric and personal.

Core philosophy:

> A place for the moments I want to remember.

Use the current stable versions of the chosen stack that are mutually compatible.

Core stack:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- GSAP
- ScrollTrigger
- Lenis
- Lucide React
- date-fns
- Zod where useful

Before writing code:

1. Inspect the current repository.
2. Confirm whether it is empty.
3. Check Node/package-manager availability.
4. Plan the project structure according to the specification.

Important rules:

- Keep the application data-driven.
- Keep database access out of presentation components.
- Use Server Components unless browser interaction requires Client Components.
- Do not generate all future pages in the first phase.
- Do not create fake personal stories.
- Demo data may be used for development but should be clearly structured as seed content.
- Do not create a generic AI-style design.
- Do not overuse animations.
- Respect reduced motion.
- Do not expose secrets.

Start with Phase 01 only.

Phase 01 means:

- project setup
- design tokens
- typography system
- global CSS
- root layout
- navigation
- fullscreen menu
- footer
- Lenis
- GSAP animation foundation
- page transition foundation
- homepage hero
- Earth section placeholder
- responsive behavior
- accessibility basics

Do not implement Prisma in Phase 01.

Do not implement every route in Phase 01.

After implementation:

Run:

    npm install
    npm run lint
    npm run dev

Fix all errors you introduced.

Verify:

- desktop
- mobile
- navigation
- menu
- scrolling
- hero
- reduced motion

Then stop.

END PROMPT

---

# 105. PHASE PROMPT — PHASE 01

Paste after the master prompt if Antigravity needs a more explicit task:

    Build only Phase 01 from the specification.

    Goal:
    Establish the visual and interaction foundation.

    Deliver:

    1. Next.js App Router setup
    2. TypeScript strict mode
    3. Tailwind setup
    4. global CSS and design tokens
    5. typography abstraction
    6. root layout
    7. desktop navigation
    8. mobile navigation
    9. fullscreen menu
    10. footer
    11. Lenis smooth scroll
    12. GSAP setup
    13. page transition foundation
    14. cinematic hero
    15. Earth section placeholder
    16. responsive styles
    17. reduced motion support

    Homepage hero copy:

    "A place for the moments I want to remember."

    Supporting:

    "Travels, places, people, food, films and everything in between."

    Design it as an editorial opening scene.

    Do not build the database yet.

    Do not build the other pages yet.

    After implementation, run lint/build checks and fix all introduced errors.

---

# 106. PHASE PROMPT — PHASE 02

    Read the specification.

    Build only Phase 02.

    Implement:

    1. PostgreSQL connection
    2. Prisma schema
    3. Trip
    4. Place
    5. TripPlace
    6. TripDay
    7. Memory
    8. Photo
    9. JournalEntry
    10. Experience
    11. FoodExperience
    12. Movie
    13. TimelineEvent
    14. enums
    15. relationships
    16. indexes where appropriate
    17. seed script
    18. query layer
    19. domain/view types

    Seed realistic demo content.

    Do not redesign the frontend.

    Verify:

    npx prisma generate
    npx prisma migrate dev
    seed execution
    npm run lint

    Ensure the schema can support the relationships described in the specification.

---

# 107. PHASE PROMPT — PHASE 03

    Read the specification.

    Build only Phase 03.

    Replace homepage placeholder content with database-driven content.

    Implement:

    1. featured trips
    2. trip statistics
    3. timeline preview
    4. photography story
    5. life beyond travel

    Requirements:

    - no duplicated hardcoded trip content
    - query data through lib/queries
    - keep server data fetching on the server
    - use client components only for interactive/animated parts
    - preserve Phase 01 visual identity

    Verify all homepage links.

    Check desktop, mobile and reduced motion.

---

# 108. PHASE PROMPT — PHASE 04

    Read the specification.

    Build only Phase 04.

    Implement:

        /trips
        /trips/[slug]

    Include:

    - trip listing
    - editorial trip cards
    - cinematic trip hero
    - introduction
    - trip stats
    - day-by-day journey
    - route map abstraction
    - photo story
    - food
    - accommodation placeholder/data section
    - budget placeholder/data section
    - personal tips
    - journal links
    - gallery
    - next journey

    Use real database relationships.

    Invalid slugs must use Next.js not-found handling.

    Do not duplicate query logic between components.

    Verify all seed trips.

---

# 109. PHASE PROMPT — PHASE 05

    Read the specification.

    Build only Phase 05.

    Implement:

        /places
        /places/[slug]
        /map

    Requirements:

    - reusable map abstraction
    - interactive markers
    - related trips
    - place photos
    - place journal entries
    - filters
    - map clustering where required
    - mobile map controls

    Do not tightly couple route components to map-provider-specific code.

---

# 110. PHASE PROMPT — PHASE 06

    Read the specification.

    Build:

        /timeline
        /experiences
        /food
        /cinema

    Use database data.

    Timeline must be chronologically ordered.

    Experiences must support categories.

    Food and cinema remain personal archive sections rather than review platforms.

    Preserve the editorial visual identity.

---

# 111. PHASE PROMPT — PHASE 07

    Read the specification.

    Build:

        /photography
        /journal
        /journal/[slug]

    Implement:

    - responsive photography archive
    - filters
    - fullscreen viewer
    - journal listing
    - journal detail
    - related trips
    - related places
    - metadata
    - SEO metadata

    Pay particular attention to reading typography on journal pages.

---

# 112. PHASE PROMPT — PHASE 08

    Read the specification.

    Build:

        /explore
        /search

    Implement:

    - category filtering
    - year filtering
    - location filtering
    - URL query parameters
    - global keyboard shortcut
    - search overlay
    - debounced search
    - grouped results

    Results must link to the actual underlying content entity.

---

# 113. PHASE PROMPT — PHASE 09

    Read the specification.

    Perform a complete product polish pass.

    Check:

    - typography
    - spacing
    - navigation
    - page transitions
    - hero
    - imagery
    - map
    - gallery
    - mobile layouts
    - empty states
    - loading states
    - error states
    - accessibility
    - reduced motion
    - metadata
    - sitemap
    - robots
    - OpenGraph
    - performance

    Fix issues rather than merely reporting them.

    Do not redesign the entire product.

---

# 114. FINAL ACCEPTANCE CRITERIA

Life Atlas is ready for a first public-quality release when:

## Visual

- homepage has a cinematic identity
- typography feels editorial
- images are treated as content, not decoration
- layouts are not generic card grids
- desktop and mobile feel intentional
- animation is controlled

## Content

- trips are connected to places
- places are connected to trips
- photographs are connected to content
- journal entries connect to trips/places
- timeline reflects the archive
- search discovers content

## Technical

- TypeScript is strict
- Prisma is working
- PostgreSQL is working
- seed data works
- routes work
- no runtime errors
- no hydration errors
- no obvious lint errors
- no secrets are committed

## UX

- navigation is intuitive
- full-screen menu works
- photo viewer works
- map works
- keyboard controls work
- reduced motion works
- mobile interactions work

## Architecture

Adding one trip should mostly require:

1. creating the trip record
2. adding places
3. adding trip days
4. adding photographs
5. optionally adding experiences/journal entries

The UI should automatically surface the new content.

---

# 115. FINAL DIRECTION TO ANTIGRAVITY

The most important instruction:

**Do not simplify Life Atlas into a generic website.**

The visual experience, content model and relationships are the product.

A visitor should feel that they are moving through a real person's collected memories, not browsing a content management demo.

Travel is the central thread.

Every section should answer one of these questions:

- Where was I?
- How did I get there?
- What did I see?
- What did I feel?
- What do I still remember?
- What photograph keeps the moment alive?
- What story belongs to this place?

Build the system so those answers remain connected for years as the archive grows.

---