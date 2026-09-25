# LIFE ATLAS — ANTIGRAVITY IMPLEMENTATION PLAYBOOK

This is the step-by-step execution manual for building Life Atlas from an empty folder to a production-ready website.

Use together with:

    LIFE_ATLAS_ANTIGRAVITY_SPEC.md

The specification defines WHAT the product is.
This playbook defines HOW and WHEN to implement it.

## HOW TO USE THIS FILE

Keep both files in the project root:

    life-atlas/
    ├── LIFE_ATLAS_ANTIGRAVITY_SPEC.md
    └── LIFE_ATLAS_IMPLEMENTATION_PLAYBOOK.md

Do NOT paste this whole file into Antigravity.

Use one phase prompt at a time.

For every phase:

    Read specification
        ↓
    Paste phase prompt
        ↓
    Antigravity implements
        ↓
    Run checks
        ↓
    Inspect browser
        ↓
    Fix problems
        ↓
    Git commit
        ↓
    Next phase

Do not move to the next phase just because Antigravity says it is finished.

---

# 1. COMPLETE ROADMAP

Build in this exact general order:

00. Prepare environment
01. Create project
02. Visual foundation
03. Prisma + PostgreSQL
04. Homepage data
05. Trips
06. Trip details
07. Places
08. Global map
09. Timeline
10. Experiences / Food / Cinema
11. Photography + viewer
12. Journal
13. Explore
14. Search
15. About
16. Final globe
17. Animation polish
18. Responsive refinement
19. Loading / error / empty states
20. SEO
21. Accessibility
22. Performance
23. Security
24. Real content migration
25. Production preparation
26. Deployment
27. Final QA

---

# 2. STEP 00 — PREPARE ENVIRONMENT

Have available:

- Node.js LTS
- npm
- Git
- PostgreSQL or an approved hosted PostgreSQL service
- Antigravity
- browser

Check:

    node -v
    npm -v
    git --version
    psql --version

Do not put database passwords or private tokens into Antigravity prompts.

If using hosted PostgreSQL, obtain the private connection string from the provider and keep it in environment variables.

---

# 3. STEP 01 — CREATE EMPTY PROJECT

Create an empty directory:

    mkdir life-atlas
    cd life-atlas

Open it in Antigravity.

Place:

    LIFE_ATLAS_ANTIGRAVITY_SPEC.md
    LIFE_ATLAS_IMPLEMENTATION_PLAYBOOK.md

in the root.

Expected starting structure:

    life-atlas/
    ├── LIFE_ATLAS_ANTIGRAVITY_SPEC.md
    └── LIFE_ATLAS_IMPLEMENTATION_PLAYBOOK.md

---

# 4. STEP 01 PROMPT — INITIAL PROJECT

Paste into Antigravity:

--------------------------------------------------
Read these files completely before making changes:

- LIFE_ATLAS_ANTIGRAVITY_SPEC.md
- LIFE_ATLAS_IMPLEMENTATION_PLAYBOOK.md

We are starting Life Atlas from an empty directory.

Inspect the repository first.

Create the initial Next.js App Router project using:

- React
- TypeScript
- Tailwind CSS
- ESLint
- current stable mutually compatible package versions
- npm

Do not install unnecessary packages.

Do not implement Prisma or PostgreSQL yet.

Do not build the complete website yet.

Set up the project so the application starts successfully.

Then:

1. Install dependencies.
2. Run lint/type checks available in the project.
3. Start the development server.
4. Verify the homepage loads.
5. Fix setup errors.

Do not proceed to the visual foundation.

Report:
- files created
- dependencies added
- commands run
- warnings/errors
- development command

--------------------------------------------------

## CHECKPOINT 01

Verify:

[ ] Project starts
[ ] Homepage loads
[ ] No fatal terminal error
[ ] No browser runtime error
[ ] TypeScript works
[ ] ESLint works

Initialize Git:

    git init
    git add .
    git commit -m "chore: initialize life atlas"

---

# 5. STEP 02 — VISUAL FOUNDATION

Now establish the identity of the product.

Implement only:

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
- cinematic hero
- Earth/globe placeholder
- responsive design
- accessibility basics
- reduced motion

Do NOT add the database.

---

# 6. STEP 02 PROMPT — VISUAL FOUNDATION

--------------------------------------------------
Read:

    LIFE_ATLAS_ANTIGRAVITY_SPEC.md

Implement only the visual foundation.

Build:

1. Global CSS and design tokens
2. Typography system
3. Root layout
4. Desktop navigation
5. Mobile navigation
6. Fullscreen navigation menu
7. Footer
8. Lenis smooth scrolling
9. GSAP foundation
10. Page transition foundation
11. Cinematic homepage hero
12. Earth/globe transition placeholder
13. Responsive behavior
14. Accessibility basics
15. prefers-reduced-motion support

Visual direction:

- cinematic
- editorial
- atmospheric
- minimal
- premium
- photographic
- personal

Avoid:

- SaaS dashboard styling
- excessive glassmorphism
- random gradient blobs
- excessive rounded cards
- generic portfolio layout
- generic AI landing-page aesthetics

Hero:

"A place for the moments I want to remember."

Supporting copy:

"Travels, places, people, food, films and everything in between."

Make the hero feel like the opening scene of a documentary.

Use GSAP only for meaningful movement.

Use Lenis once at the application level.

Do not make the entire application a Client Component.

Respect reduced motion.

Do not implement Prisma.

Do not implement remaining content pages.

After coding:

- run lint
- run type checks
- run dev server
- inspect browser
- fix all introduced issues

Stop after this phase.
--------------------------------------------------

## CHECKPOINT 02

Personally inspect:

- 375px
- 390px
- 430px
- 768px
- 1280px
- 1440px
- 1920px

Check:

[ ] Hero
[ ] Typography
[ ] Navigation
[ ] Fullscreen menu
[ ] Mobile menu
[ ] Smooth scrolling
[ ] Page transition foundation
[ ] No horizontal overflow
[ ] Reduced motion
[ ] No console errors

Commit:

    git add .
    git commit -m "feat: build life atlas visual foundation"

---

# 7. STEP 03 — DATABASE + PRISMA

Create the data model only after the visual foundation is stable.

Core models:

- User
- Trip
- Place
- TripPlace
- TripDay
- Memory
- Photo
- JournalEntry
- Experience
- FoodExperience
- Movie
- TimelineEvent

Use the exact relationships from the master specification.

---

# 8. STEP 03 — DATABASE ENVIRONMENT

Create:

    .env.local

Example:

    DATABASE_URL="private-postgresql-connection-string"

Create:

    .env.example

Example:

    DATABASE_URL=

Ensure `.env.local` is ignored by Git.

Never use a public variable for DATABASE_URL.

---

# 9. STEP 03 PROMPT — DATABASE

--------------------------------------------------
Read:

    LIFE_ATLAS_ANTIGRAVITY_SPEC.md
    LIFE_ATLAS_IMPLEMENTATION_PLAYBOOK.md

Implement only the database phase.

Add:

- Prisma
- PostgreSQL connection
- complete Prisma schema
- enums
- relationships
- appropriate indexes/constraints
- seed script
- query layer
- domain/view types

Required entities:

- User
- Trip
- Place
- TripPlace
- TripDay
- Memory
- Photo
- JournalEntry
- Experience
- FoodExperience
- Movie
- TimelineEvent

Follow the master specification for the relationships.

Create query modules under:

    lib/queries/

Create:

    lib/prisma.ts

Create realistic development seed data:

- 4 trips
- 10 places
- 15 trip days
- 25–30 photos
- 10 experiences
- 5 food records
- 5 cinema records
- 5 journal entries
- 20 timeline events

Demo content can be fictional, but relationships must be internally consistent.

Do not redesign the existing UI.

Do not put Prisma queries into React presentation components.

Run:

    npx prisma validate
    npx prisma generate
    npx prisma migrate dev
    npx prisma db seed

Then run lint/type/build checks available in the project.

Fix errors introduced by this phase.

Do not build database-driven pages yet.
--------------------------------------------------

## DATABASE CHECKPOINT

Run:

    npx prisma validate
    npx prisma migrate status

Verify:

[ ] Database connects
[ ] Prisma generates
[ ] Migration succeeds
[ ] Seed succeeds
[ ] Slugs are unique
[ ] Relationships are valid
[ ] Secrets are not committed

Commit:

    git add .
    git commit -m "feat: add life atlas database"

---

# 10. STEP 04 — HOMEPAGE DATA

Connect the existing homepage to the database.

Replace static demo sections with:

- featured trips
- database stats
- timeline preview
- photography
- life beyond travel

---

# 11. STEP 04 PROMPT — HOMEPAGE DATA

--------------------------------------------------
Read the specification.

Implement only homepage data integration.

Use Prisma through the query layer.

Do not place database queries directly in presentation components.

Connect:

1. Featured trips
2. Database-driven life statistics
3. Timeline preview
4. Photography story
5. Life beyond travel

Rules:

- statistics must come from the database
- featured trips must come from Trip records
- timeline preview must come from TimelineEvent
- photography must come from Photo
- experiences must come from actual records
- links must use slugs
- preserve the Phase 01 design
- do not replace editorial layouts with generic card grids

Use Server Components whenever possible.

Use Client Components only for browser interaction/animation.

Test:
- desktop
- mobile
- empty states
- loading
- console
- TypeScript

Do not implement remaining routes yet.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: connect homepage to archive data"

---

# 12. STEP 05 — TRIPS LIST

Route:

    /trips

Build the main journey archive.

---

# 13. STEP 05 PROMPT — TRIPS

--------------------------------------------------
Read the specification.

Implement only:

    /trips

Use database data.

Include:

- editorial page heading
- trip list
- cover
- title
- location
- date
- duration
- description

Sorting:

- latest
- oldest
- longest
- most photographs

Default:

latest

Do not use a generic SaaS-style card grid.

Create reusable TripCard/TripGrid components because trips will appear on multiple pages.

Add intentional empty state.

Preserve mobile design.

Do not implement /trips/[slug] yet.

Run lint/type/build checks.
--------------------------------------------------

Checkpoint:

[ ] list works
[ ] sorting works
[ ] links work
[ ] images work
[ ] mobile works

Commit:

    git add .
    git commit -m "feat: add trips archive"

---

# 14. STEP 06 — TRIP DETAIL

Route:

    /trips/[slug]

This is a major feature.

---

# 15. STEP 06 PROMPT — TRIP DETAIL

--------------------------------------------------
Read the complete specification.

Implement:

    /trips/[slug]

Required sections:

1. Cinematic hero
2. Personal introduction
3. Trip overview
4. Day-by-day journey
5. Route map abstraction
6. Photo story
7. Food
8. Accommodation section when data exists
9. Budget section when data exists
10. Personal tips
11. Journal connections
12. Complete photo gallery
13. Next journey

Requirements:

- fetch trip through the query layer
- use relations
- invalid slug must call notFound()
- no Prisma queries in presentational components
- no invented personal details
- optional sections should be omitted or show a useful empty state
- responsive
- reduced-motion friendly

Create reusable subcomponents under:

    components/trips/

Test:
- valid trip
- invalid slug
- desktop
- mobile

Run checks.

Do not implement the global map page yet.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add trip detail experience"

---

# 16. STEP 07 — PLACES

Routes:

    /places
    /places/[slug]

---

# 17. STEP 07 PROMPT — PLACES

--------------------------------------------------
Read the specification.

Implement:

    /places
    /places/[slug]

List page should show:

- place name
- country
- region
- city/locality
- cover image
- related trip count
- visit context

Detail page should contain:

1. Hero
2. Location data
3. Map preview
4. Personal description
5. Related trips
6. Photos
7. Experiences
8. Journal entries
9. Timeline entries

Use the existing data model.

Use a reusable map abstraction.

Do not create another unrelated map implementation.

Test invalid place slug.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add place archive"

---

# 18. STEP 08 — GLOBAL MAP

Route:

    /map

This is the main interactive atlas.

Create:

    components/map/AtlasMap.tsx
    components/map/MapMarker.tsx
    components/map/MapPopup.tsx

Keep provider-specific code isolated.

---

# 19. STEP 08 PROMPT — MAP

--------------------------------------------------
Read the specification.

Implement only:

    /map

Build the interactive Life Atlas map.

Show:

- visited places
- relevant trip/place markers
- real coordinates from database
- marker hover
- marker click
- zoom
- pan
- clustering when needed
- filters
- mobile controls

Filters:

- All
- Trips
- Places
- Food
- Events
- Photography

Popup should show:

- place
- region/country
- visit year/date
- related trip
- View link

Map provider must be abstracted behind domain components.

If map credentials are missing:
- do not crash the app
- provide a useful fallback state

Do not invent coordinates for real personal data.

Optimize map loading.

Test desktop/mobile and multiple markers.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add interactive atlas map"

---

# 20. STEP 09 — TIMELINE

Route:

    /timeline

---

# 21. STEP 09 PROMPT — TIMELINE

--------------------------------------------------
Read the specification.

Implement:

    /timeline

Use TimelineEvent.

Requirements:

- grouped by year
- chronological
- event type
- optional image
- related entity link
- responsive editorial layout

Supported event types may include:

- trip
- place
- experience
- memory
- journal
- cinema
- food
- project
- other

Do not create a duplicate timeline data system.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add life timeline"

---

# 22. STEP 10 — EXPERIENCES / FOOD / CINEMA

Routes:

    /experiences
    /food
    /cinema

---

# 23. STEP 10 PROMPT

--------------------------------------------------
Read the specification.

Implement:

    /experiences
    /food
    /cinema

Experiences:
- category
- title
- date
- location
- image
- description
- related trip/place

Food:
- name
- location
- date
- image
- personal notes
- related trip/place

Cinema:
- title
- watched date
- cinema/platform
- location
- personal note
- optional rating

Important:
Food is a personal memory archive, not a restaurant review platform.

Cinema is a personal archive, not a public film-review platform.

Reuse existing editorial components.

Add loading and empty states.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add experiences archive"

---

# 24. STEP 11 — PHOTOGRAPHY

Route:

    /photography

---

# 25. STEP 11 PROMPT — PHOTOGRAPHY

--------------------------------------------------
Read the specification.

Implement:

    /photography

Filters:

- All
- Travel
- Nature
- Architecture
- Food
- People
- Street
- Night

Use Photo records.

Each photo should support:

- URL
- alt
- caption
- date
- place
- trip
- category
- display order

Do not use a generic photo grid.

Build an editorial visual archive.

Add reusable fullscreen viewer with:

- open
- close
- previous
- next
- keyboard
- mobile swipe
- caption
- date
- place
- trip

Keyboard:
Escape = close
ArrowLeft = previous
ArrowRight = next

Accessibility:
- focus handling
- labelled dialog
- keyboard support

Optimize images and preserve dimensions.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add photography archive and viewer"

---

# 26. STEP 12 — JOURNAL

Routes:

    /journal
    /journal/[slug]

---

# 27. STEP 12 PROMPT — JOURNAL

--------------------------------------------------
Read the specification.

Implement:

    /journal
    /journal/[slug]

Listing:
- title
- date
- excerpt
- cover
- related trip/place

Detail:
- title
- metadata
- context
- cover
- body
- related photos/media
- related trip/place
- next entry

Prioritize reading typography.

Use:
- narrow reading column
- comfortable line length
- strong hierarchy
- responsive typography
- proper image/caption treatment

Do not make it look like an admin CMS.

Use dynamic metadata.

Invalid slug uses notFound().

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add journal"

---

# 28. STEP 13 — EXPLORE

Route:

    /explore

This is a unified browser over existing archive content.

---

# 29. STEP 13 PROMPT — EXPLORE

--------------------------------------------------
Read the specification.

Implement:

    /explore

Categories:

- All
- Travel
- Food
- Cinema
- Events
- Photography
- Journal
- Memories

Filters:

- year
- country
- region
- city
- category

Use URL query parameters.

Example:

    /explore?category=travel&year=2026

Rules:

- filters must be shareable
- do not duplicate content records
- Explore is a view across existing content
- preserve editorial layout
- show useful entity type
- correct links to underlying records
- useful empty state

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add explore archive"

---

# 30. STEP 14 — SEARCH

Implement global search and:

    /search

Use Cmd/Ctrl + K and slash if appropriate.

---

# 31. STEP 14 PROMPT — SEARCH

--------------------------------------------------
Read the specification.

Implement global search.

Search across:

- trips
- places
- photographs
- experiences
- food
- cinema
- journal
- memories

Create a reusable SearchOverlay.

Requirements:

- Cmd/Ctrl + K
- optional "/" shortcut
- debounced input
- keyboard navigation
- grouped results
- title
- type
- excerpt
- image when useful
- location
- date
- correct slug/route
- Escape closes

Database search lives in:

    lib/queries/search.ts

Do not put Prisma code in the search input component.

First implementation may use PostgreSQL-compatible search.

Keep UI independent of any future search vendor.

Test:
- no results
- exact title
- partial search
- location
- keyboard
- mobile

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add global search"

---

# 32. STEP 15 — ABOUT

Route:

    /about

---

# 33. STEP 15 PROMPT — ABOUT

--------------------------------------------------
Read the specification.

Implement:

    /about

Explain:

- why Life Atlas exists
- why travel matters
- why memories are archived
- photography
- places and stories
- technology behind the project

Do not create a corporate About page.

Do not invent achievements or autobiographical facts not provided.

Keep the same editorial/cinematic language.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add about page"

---

# 34. STEP 16 — FINAL HOMEPAGE GLOBE

Only now replace the temporary Earth placeholder.

---

# 35. STEP 16 PROMPT — FINAL GLOBE

--------------------------------------------------
Read the specification.

Replace the homepage Earth/globe placeholder with the final interactive world experience.

Requirements:

- visited location markers
- subtle globe motion
- cinematic atmosphere
- location labels
- marker interaction
- links to trip/place pages
- transition from hero into globe
- reduced-motion support
- mobile fallback/simplified mode

Use the simplest robust technology that creates the desired effect.

Do not add unnecessary WebGL complexity.

Do not make the globe look like analytics/dashboard software.

Do not display too many labels at once.

Optimize:
- initialization
- rendering
- marker count
- mobile GPU load

If the 3D implementation performs poorly, use a lighter fallback while preserving the concept.

Test desktop/mobile/reduced motion.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: add interactive globe"

---

# 36. STEP 17 — GLOBAL ANIMATION POLISH

---

# 37. STEP 17 PROMPT

--------------------------------------------------
Audit all animations across Life Atlas.

Review:

- page transitions
- navigation
- menu
- hero
- section reveals
- image hover
- photo viewer
- map
- buttons/links
- custom cursor
- scrolling

Rules:

- animation supports content
- navigation remains responsive
- no duplicate ScrollTriggers
- clean up GSAP contexts
- no memory leaks
- no unnecessary Client Components
- reduced-motion support
- cursor disabled on touch

Do not redesign the product.

Fix concrete animation problems.

Run:
- lint
- type checks
- production build

Inspect browser.
--------------------------------------------------

Commit:

    git add .
    git commit -m "feat: polish global interactions"

---

# 38. STEP 18 — RESPONSIVE PASS

---

# 39. STEP 18 PROMPT

--------------------------------------------------
Perform a complete responsive pass.

Test at:

375px
390px
430px
768px
1024px
1280px
1440px
1920px

Do not merely shrink the desktop layout.

Refine mobile intentionally.

Inspect:

- navbar
- hero
- globe
- trips
- trip detail
- places
- map
- timeline
- photography
- photo viewer
- journal
- explore
- search
- about
- footer

Fix:
- horizontal overflow
- bad image crop
- unreadable text
- clipped titles
- tiny controls
- broken grids
- inaccessible touch targets

Preserve the Life Atlas visual identity.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "fix: refine responsive layouts"

---

# 40. STEP 19 — ERROR / LOADING / EMPTY STATES

---

# 41. STEP 19 PROMPT

--------------------------------------------------
Audit every public route.

Ensure the application has:

- app/error.tsx
- app/not-found.tsx
- appropriate loading.tsx or route-level loading
- trip empty states
- place empty states
- journal empty states
- photography empty states
- search no-results state
- map configuration fallback

Never expose raw database/server errors to users.

Use Life Atlas tone.

Do not overanimate loading states.

Fix problems instead of only reporting them.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "fix: improve loading error and empty states"

---

# 42. STEP 20 — SEO

---

# 43. STEP 20 PROMPT

--------------------------------------------------
Perform a complete SEO pass.

Implement:

- root metadata
- dynamic trip metadata
- dynamic place metadata
- dynamic journal metadata
- useful metadata for other public pages
- canonical URLs
- sitemap
- robots
- OpenGraph
- social metadata as appropriate

Content pages should use content-specific:
- title
- description
- image

Do not use one generic metadata object for every page.

Do not expose private information.

Run production build and verify generated metadata.
--------------------------------------------------

Commit:

    git add .
    git commit -m "chore: add seo and metadata"

---

# 44. STEP 21 — ACCESSIBILITY

---

# 45. STEP 21 PROMPT

--------------------------------------------------
Perform a complete accessibility audit.

Test:

- keyboard navigation
- visible focus
- desktop navigation
- fullscreen menu
- search overlay
- photo viewer
- buttons
- links
- headings
- image alt text
- dialogs
- Escape behavior
- reduced motion
- contrast
- touch target size

Requirements:

- semantic HTML
- real buttons
- real links
- aria labels where needed
- logical heading hierarchy
- focus management
- accessible modal/gallery
- reduced motion

Fix issues found.

Do not merely list problems.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "chore: improve accessibility"

---

# 46. STEP 22 — PERFORMANCE

---

# 47. STEP 22 PROMPT

--------------------------------------------------
Perform a production performance audit.

Inspect:

- initial JS
- Client Components
- images
- fonts
- map
- globe
- GSAP
- hydration
- layout shift
- mobile GPU/render cost

Optimize:

- image dimensions
- lazy loading
- dynamic imports
- expensive interactive components
- font loading
- unnecessary client code
- map/globe initialization

Do not remove important product features without trying architectural improvements first.

Run production build.

Report measurable problems and fixes.
--------------------------------------------------

Commit:

    git add .
    git commit -m "perf: optimize life atlas"

---

# 48. STEP 23 — SECURITY

---

# 49. STEP 23 PROMPT

--------------------------------------------------
Perform a security/configuration audit.

Check:

- .env files
- database credentials
- map tokens
- secret logging
- NEXT_PUBLIC variables
- user-controlled HTML rendering
- raw SQL
- validation
- dependency issues

Ensure:

- secrets stay server-side
- public variables are genuinely public
- external input is validated
- rich content is safely rendered
- .env.local is ignored
- .env.example contains names only

Fix concrete problems.

Do not break existing functionality.

Run checks.
--------------------------------------------------

Commit:

    git add .
    git commit -m "chore: harden production configuration"

---

# 50. STEP 24 — REAL CONTENT MIGRATION

Do this only after the technical product is stable.

Recommended order:

    Trip
      ↓
    Places
      ↓
    Trip days
      ↓
    Photos
      ↓
    Memories
      ↓
    Experiences
      ↓
    Food
      ↓
    Journal
      ↓
    Timeline

Do not delete all demo data immediately.

Replace content gradually.

---

# 51. REAL TRIP DATA RULE

When adding a real journey:

1. Create the Trip.
2. Create/confirm Places.
3. Connect Trip ↔ Places.
4. Add TripDays.
5. Add Photos.
6. Add Memories if applicable.
7. Add Experiences if applicable.
8. Add Food records if applicable.
9. Add Journal entry if applicable.
10. Add Timeline events.
11. Verify coordinates.
12. Verify image metadata.
13. Test trip page.
14. Test place page.
15. Test map.
16. Test timeline.
17. Test photography.
18. Test search.

Do not manually duplicate the trip data in frontend files.

---

# 52. STEP 24 PROMPT — ADD A REAL TRIP

Use this every time a real trip is added:

--------------------------------------------------
Read the Life Atlas specification.

I am adding one real journey to the archive.

First inspect the existing Prisma schema, query layer, seed/data conventions and reusable UI.

Add the trip using the existing architecture.

Connect it to:
- places
- trip days
- photographs
- memories where applicable
- experiences where applicable
- food where applicable
- journal where applicable
- timeline events

Do not invent details that I did not provide.

Use placeholders only when explicitly requested.

Validate:
- dates
- slug
- relationships
- coordinates
- image metadata

After adding:
1. validate database
2. verify trip page
3. verify related places
4. verify map
5. verify timeline
6. verify photography
7. verify search

Report what was added and what information is still missing.
--------------------------------------------------

---

# 53. STEP 25 — LOCAL PRODUCTION CHECK

Run:

    npm run lint
    npm run build

If the project has a typecheck script:

    npm run typecheck

Prisma:

    npx prisma validate
    npx prisma migrate status

Development:

    npm run dev

---

# 54. ROUTE TEST CHECKLIST

Test every public route:

    /
    /explore
    /trips
    /trips/[valid-slug]
    /trips/[invalid-slug]
    /places
    /places/[valid-slug]
    /places/[invalid-slug]
    /map
    /timeline
    /photography
    /experiences
    /food
    /cinema
    /journal
    /journal/[valid-slug]
    /journal/[invalid-slug]
    /search
    /about

---

# 55. CONNECTION TEST CHECKLIST

Verify these relationships:

    Trip → Place
    Place → Trip
    Trip → Photo
    Photo → Trip
    Photo → Place
    Trip → Journal
    Journal → Trip
    Journal → Place
    Timeline → Trip
    Timeline → Place
    Map → Place
    Map → Trip
    Search → correct entity

This connected content graph is a core product requirement.

---

# 56. STEP 26 — PRODUCTION PREPARATION PROMPT

Only use this after local development is stable.

--------------------------------------------------
Read:

    LIFE_ATLAS_ANTIGRAVITY_SPEC.md
    LIFE_ATLAS_IMPLEMENTATION_PLAYBOOK.md

Prepare the Life Atlas project for production deployment.

Do not deploy.

Audit:

- production build
- environment variables
- Prisma configuration
- production migration workflow
- static/public assets
- image strategy
- metadata
- sitemap
- robots
- map configuration
- error handling
- logging
- seed-data safety

Ensure development seed behavior cannot accidentally overwrite production data.

Document:

- production environment variables
- migration steps
- build command
- start command
- deployment prerequisites
- known limitations

Run a production build.

Do not claim anything is verified unless it was actually checked.
--------------------------------------------------

---

# 57. PRODUCTION DATABASE RULE

Never use:

    prisma migrate reset

against production.

Do not casually delete production content.

Use controlled migrations.

Keep backups.

---

# 58. DEPLOYMENT ARCHITECTURE

Typical structure:

    Browser
       ↓
    Next.js
       ↓
    PostgreSQL
       ↓
    image storage/CDN
       ↓
    map provider

For a growing photography archive, do not rely on storing every large real photo permanently inside the application repository.

Use appropriate image storage/CDN later.

---

# 59. STEP 27 — DEPLOYMENT

Deployment depends on the hosting/database provider selected.

Generic process:

1. Create production PostgreSQL.
2. Configure production DATABASE_URL.
3. Run production migrations.
4. Configure public map token.
5. Deploy Next.js.
6. Configure domain.
7. Enable HTTPS.
8. Verify production routes.
9. Verify images.
10. Verify map.
11. Verify search.
12. Verify metadata.
13. Verify mobile.

Do not migrate real personal content until the deployed application is stable.

---

# 60. FINAL QA PROMPT

Paste into Antigravity at the end:

--------------------------------------------------
Life Atlas is feature-complete.

Read:

    LIFE_ATLAS_ANTIGRAVITY_SPEC.md
    LIFE_ATLAS_IMPLEMENTATION_PLAYBOOK.md

Perform a final engineering and UX audit.

Inspect every public route.

Check:

- functionality
- navigation
- database relationships
- animations
- responsive design
- accessibility
- performance
- SEO
- errors
- loading states
- empty states
- security
- image loading
- map
- gallery
- search
- reduced motion

Do not redesign the site.

Fix concrete problems found.

Do not hide warnings.

Run:
- lint
- type checks
- production build
- Prisma validation

Then report:

1. final route checklist
2. files changed
3. bugs fixed
4. remaining limitations
5. production readiness status

Only claim verification for things actually checked.
--------------------------------------------------

---

# 61. PERSONAL FINAL QA

Even after Antigravity finishes, personally inspect:

## Homepage
[ ] Hero
[ ] Globe
[ ] Featured journeys
[ ] Statistics
[ ] Timeline
[ ] Photography
[ ] Life beyond travel
[ ] Final CTA

## Navigation
[ ] Desktop
[ ] Mobile
[ ] Fullscreen menu
[ ] Search

## Trips
[ ] Listing
[ ] Detail
[ ] Day timeline
[ ] Map
[ ] Photos
[ ] Journal
[ ] Related places

## Places
[ ] Listing
[ ] Detail
[ ] Related trips
[ ] Photos
[ ] Map

## Map
[ ] Markers
[ ] Popups
[ ] Filters
[ ] Mobile controls

## Timeline
[ ] Chronological order
[ ] Related content

## Photography
[ ] Filters
[ ] Viewer
[ ] Keyboard
[ ] Mobile swipe

## Journal
[ ] Listing
[ ] Detail
[ ] Typography
[ ] Related content

## Search
[ ] Shortcut
[ ] Results
[ ] No-result state
[ ] Correct links

## About
[ ] Personal tone
[ ] Visual consistency

---

# 62. GIT STRATEGY

Create a commit after every stable major phase.

Suggested history:

    chore: initialize life atlas
    feat: build life atlas visual foundation
    feat: add life atlas database
    feat: connect homepage to archive data
    feat: add trips archive
    feat: add trip detail experience
    feat: add place archive
    feat: add interactive atlas map
    feat: add life timeline
    feat: add experiences archive
    feat: add photography archive and viewer
    feat: add journal
    feat: add explore archive
    feat: add global search
    feat: add about page
    feat: add interactive globe
    feat: polish global interactions
    fix: refine responsive layouts
    fix: improve loading error and empty states
    chore: add seo and metadata
    chore: improve accessibility
    perf: optimize life atlas
    chore: harden production configuration

Do not make one giant commit for the entire project.

---

# 63. BUG-FIX PROMPT TEMPLATE

When something breaks, use a focused prompt:

--------------------------------------------------
There is a bug in the current Life Atlas implementation.

First inspect the existing implementation and reproduce the problem.

Problem:
[exact problem]

Expected:
[expected behavior]

Actual:
[actual behavior]

Constraints:
- preserve existing architecture
- preserve existing visual design
- do not rewrite unrelated code
- do not remove existing functionality
- fix the root cause

After fixing:
- run lint/type checks
- verify affected route
- verify related functionality
- report root cause
- report files changed
--------------------------------------------------

---

# 64. IF ANTIGRAVITY DRIFTS INTO A GENERIC DESIGN

Use:

--------------------------------------------------
The current design is drifting from the Life Atlas identity.

Audit the affected page against LIFE_ATLAS_ANTIGRAVITY_SPEC.md.

Remove:
- SaaS patterns
- generic portfolio cards
- excessive glassmorphism
- random gradient decorations
- excessive rounded containers
- generic AI landing-page aesthetics

Restore:
- editorial typography
- negative space
- asymmetric composition
- photography hierarchy
- restrained color
- cinematic transitions
- personal tone

Do not rewrite unrelated functionality.
--------------------------------------------------

---

# 65. IF ANTIGRAVITY CREATES BAD ARCHITECTURE

Use:

--------------------------------------------------
Stop adding new features.

Audit the current code against the master specification.

Identify violations such as:
- duplicated components
- duplicated data
- Prisma inside UI components
- excessive Client Components
- huge page components
- repeated query logic
- unnecessary dependencies
- unsafe typing
- animation cleanup problems

Refactor only the violating areas.

Preserve behavior and design.

Run lint/type/build checks.

Do not proceed until the affected architecture is stable.
--------------------------------------------------

---

# 66. IF A DEPENDENCY BREAKS

Use:

--------------------------------------------------
A dependency/setup problem is occurring.

Inspect:
- package.json
- lockfile
- Node version
- exact terminal error
- package compatibility

Find the root cause before changing versions.

Do not randomly downgrade packages.

Change the minimum number of dependencies.

Then:
- reinstall
- generate
- build
- lint
- type check
- inspect browser

Report why the change was necessary.
--------------------------------------------------

---

# 67. IF THE GLOBE IS TOO SLOW

Use:

--------------------------------------------------
The globe experience is creating performance problems.

Do not immediately remove it.

Profile:
- initialization
- marker count
- textures
- animation frequency
- JS bundle
- mobile GPU
- hydration

Implement appropriate fallbacks such as:
- lighter globe
- delayed initialization
- dynamic import
- reduced marker detail
- reduced animation
- static/mobile alternative

Preserve the visual concept.

Verify production build performance.
--------------------------------------------------

---

# 68. IF MOBILE IS BROKEN

Use:

--------------------------------------------------
The mobile implementation is not meeting the Life Atlas requirements.

Inspect the affected page.

Fix:
- overflow
- typography
- navigation
- image cropping
- spacing
- buttons
- gallery
- map
- section order

Do not simply shrink desktop styles.

Create intentional mobile layouts.

Verify:
375px
390px
430px

Preserve desktop behavior.
--------------------------------------------------

---

# 69. MAINTENANCE RULE

When a major architectural decision changes:

1. Update LIFE_ATLAS_ANTIGRAVITY_SPEC.md.
2. Update this playbook if execution order changes.
3. Commit the documentation.
4. Tell Antigravity to reread both files.

Do not let the specification become stale.

---

# 70. LONG-TERM CONTENT WORKFLOW

Once the site is live:

    Add new trip
        ↓
    Add/connect places
        ↓
    Add trip days
        ↓
    Add photographs
        ↓
    Add memories
        ↓
    Add experiences
        ↓
    Add food
        ↓
    Add journal
        ↓
    Add timeline events
        ↓
    Existing UI automatically surfaces content

The long-term goal is that adding content does not require rebuilding the frontend.

---

# 71. FUTURE ADMIN

Do not build admin initially.

Later:

    /admin
    /admin/trips
    /admin/places
    /admin/photos
    /admin/journal
    /admin/experiences

Admin should use the same domain model.

Do not create a second content system.

---

# 72. FINAL PRINCIPLE

Life Atlas should age well.

The technology may change.
The map provider may change.
The image provider may change.
The search provider may change.
The visual design may evolve.

The core archive should remain:

    PLACE
       +
    JOURNEY
       +
    MEMORY
       +
    PHOTOGRAPH
       +
    STORY

The product is successful when it feels like a real person's collected world rather than a content-management demo.

---

# 73. FINAL EXECUTION RULE

At every phase:

    READ
      ↓
    IMPLEMENT
      ↓
    RUN
      ↓
    INSPECT
      ↓
    FIX
      ↓
    COMMIT
      ↓
    NEXT PHASE

Never:

    GENERATE EVERYTHING
      ↓
    HOPE IT WORKS

One excellent page is better than ten broken pages.

One clean data model is better than duplicated structures.

One meaningful animation is better than twenty unnecessary effects.

END OF PLAYBOOK
