
# Life Atlas: Android Trip Vault Architecture & Implementation Plan

> **Document Version:** 1.15.0  
> **Status:** All 15 Phases Implemented, Audited & Verified (Trip Vault Feature Suite Complete)  
> **Target Platform:** Life Atlas Android Application (Capacitor 6 + Next.js 16 App Router)  
> **Scope:** Exclusive Android Trip Vault feature suite inside the authenticated Secret Section  

---

## 1. Discovered App Architecture & Inspection Findings

### 1.1 Dual-Target Hybrid Architecture
The Life Atlas project utilizes a **unified full-stack repository** powering both the public website and the native Android application:
- **Web Layer:** Next.js 16.3.6 (App Router, Turbopack, React 19.2.8, Tailwind CSS v4) hosted on Vercel at `https://life-atlas-eight-five.vercel.app`.
- **Database & Cloud:** Neon PostgreSQL (`@prisma/client` v5.22.0) with Neon Object Storage (`files-sdk` via S3-compatible bucket).
- **Android Native Shell:** Capacitor 6.2.2 (`@capacitor/android`, `@capacitor/core`, `@capacitor/app`, `@capacitor/status-bar`, `@aparajita/capacitor-biometric-auth` v8.0.2).
- **Native Android Project:** Located in `android/` with package `com.lifeatlas.app`, compiling against Android SDK 34 (`minSdkVersion = 22`, `targetSdkVersion = 34`).
- **Capacitor Configuration (`capacitor.config.ts`):** `server.url` points to `https://life-atlas-eight-five.vercel.app`, loading the web application inside Capacitor's native `BridgeActivity` (`MainActivity.java`).

### 1.2 Android vs. Website Separation Mechanism
- Native platform detection is established via `Capacitor.isNativePlatform()`.
- On the **public website** (`Capacitor.isNativePlatform() === false`):
  - Visitors explore public chronicles: `/`, `/trips`, `/places`, `/explore`, `/cinema`, `/food`, `/photography`, `/map`, `/timeline`.
  - The Web Admin portal exists at `/admin` (protected by `AdminMobileGuard`, which redirects mobile app users to `/`).
- In the **Android App** (`Capacitor.isNativePlatform() === true`):
  - `MobileAppBridge.tsx` sets edge-to-edge immersion, hides the status bar, and intercepts the Android hardware back button.
  - The Secret Door on the 3D Hero scene serves as the gate to the private creator and expedition sanctuary (`/secret`).
  - Access requires device biometric verification (`@aparajita/capacitor-biometric-auth` native Android BiometricPrompt or WebAuthn, with Guardian PIN fallback `1984`).
  - The route `/secret` and all subroutes are strictly guarded by `SecretAppGuard.tsx`.

### 1.3 Exact Files & Directories Involved

#### Existing Architecture Files (Preserved without regression)
- `capacitor.config.ts`: Capacitor app configuration.
- `android/app/src/main/AndroidManifest.xml`: Android manifest & native permissions.
- `android/app/src/main/java/com/lifeatlas/app/MainActivity.java`: Capacitor BridgeActivity.
- `android/app/build.gradle`: Android application build configuration.
- `src/components/layout/MobileAppBridge.tsx`: Hardware back-button & system bar bridge.
- `src/components/home/hero/SecretDoorHotspot.tsx`: 3D door double-tap gesture & biometric trigger.
- `src/lib/deviceAuth.ts`: Universal device biometric & PIN authentication service.
- `src/components/auth/DeviceAuthModal.tsx`: Biometric scanner modal & PIN fallback.
- `src/components/secret/SecretAppGuard.tsx`: Route protector for `/secret/*`.
- `src/app/secret/page.tsx`: Private Atlas dashboard.
- `src/app/secret/studio/page.tsx`: Existing Creator Studio (preserved).
- `src/app/admin/Studio.tsx`: Web journal creation tool (preserved).
- `prisma/schema.prisma`: Neon PostgreSQL database schema.

#### New Trip Vault Files to be Created Under `/secret/vault`
- `src/lib/vault/types.ts`: Comprehensive TypeScript types for the Trip Vault data model.
- `src/lib/vault/storage.ts`: Local-first IndexedDB offline persistence engine & document store.
- `src/lib/vault/sync.ts`: Optional cloud sync layer with Prisma / Neon database.
- `src/lib/vault/notifications.ts`: Native Android local notification scheduler.
- `src/lib/vault/export.ts`: Trip export, backup, and public journal publisher.
- `src/app/secret/vault/page.tsx`: Trip Vault Dashboard (active trips, upcoming journeys, archives).
- `src/app/secret/vault/new/page.tsx`: Comprehensive Trip Creator & Configurator.
- `src/app/secret/vault/[tripId]/page.tsx`: Master Trip Command Center.
- `src/app/secret/vault/[tripId]/itinerary/page.tsx`: Day-by-day & hourly timeline itinerary.
- `src/app/secret/vault/[tripId]/bookings/page.tsx`: Transport (Train/PNR/Flight/Bus) & Hotel vouchers.
- `src/app/secret/vault/[tripId]/documents/page.tsx`: Offline Document Vault (PDFs, screenshots).
- `src/app/secret/vault/[tripId]/food/page.tsx`: Culinary roadmap & restaurant scheduler.
- `src/app/secret/vault/[tripId]/rentals/page.tsx`: Bike/Scooter rental manager & deposit tracker.
- `src/app/secret/vault/[tripId]/routes/page.tsx`: Waypoint maps & offline GPS route notes.
- `src/app/secret/vault/[tripId]/budget/page.tsx`: Multi-currency expense tracker & deposit monitor.
- `src/app/secret/vault/[tripId]/packing/page.tsx`: Categorized checklist & gear tracker.
- `src/app/secret/vault/[tripId]/safety/page.tsx`: Emergency contacts, medical card & Plan B contingencies.
- `src/app/secret/vault/[tripId]/memories/page.tsx`: Post-trip photo gallery & journal reflection.

---

## 2. Functional Scope (The 15 Pillars)

```mermaid
graph TD
  Door["Secret Door Double-Tap"] --> Bio["Biometric Fingerprint Gate"]
  Bio --> SecretHome["/secret Dashboard"]
  SecretHome --> Studio["Creator Studio (/secret/studio)"]
  SecretHome --> Vault["Trip Vault (/secret/vault)"]
  
  Vault --> T1["1. Trip Dashboard & Life-Cycle"]
  Vault --> T2["2. Multi-Destination Itinerary"]
  Vault --> T3["3. Transport & Hotel Bookings"]
  Vault --> T4["4. Document & Ticket Vault"]
  Vault --> T5["5. Food & Culinary Roadmaps"]
  Vault --> T6["6. Bike & Scooter Rentals"]
  Vault --> T7["7. Maps & Route Waypoints"]
  Vault --> T8["8. Budget & Deposit Tracker"]
  Vault --> T9["9. Packing Lists & Checklists"]
  Vault --> T10["10. Safety & Emergency Contacts"]
  Vault --> T11["11. Native Local Notifications"]
  Vault --> T12["12. Offline-First Storage"]
  Vault --> T13["13. AI Itinerary & Parser"]
  Vault --> T14["14. Biometric Security Gate"]
  Vault --> T15["15. Completed Trip Memories"]
```

### Pillar 1: Trip Dashboard & Creation/Editing
- Full trip lifecycle: `DRAFT`, `PLANNING`, `ACTIVE` (in progress), `COMPLETED`, `ARCHIVED`.
- Core trip metadata: Title, subtitle, primary destination & sub-regions, travel style (Motorcycle, Backpacking, Roadtrip, Leisure), start & end dates, cover photo, base currency, travel companions.
- Trip quick-stats: Days remaining / elapsed, total budgeted vs spent, packed progress, upcoming booking alerts.

### Pillar 2: Multiple Destinations & Day-by-Day Itinerary
- Multi-city route sequencing with travel distance and transit estimates between legs.
- Day-by-day itinerary: Date, day index, day theme (e.g., "Manali to Sarchu via Baralacha La"), weather forecast note, physical intensity rating.
- Hourly activity timeline blocks (Morning, Afternoon, Evening, Night) with time, location, cost, status (`Planned`, `In Progress`, `Completed`, `Skipped`), and notes.

### Pillar 3: Transport Bookings, Train Tickets, PNRs & Hotels
- **Transport:**
  - Types: Train (IRCTC), Flight, Intercity Bus, Taxi/Cab, Ferry, Self-Drive.
  - PNR / Booking reference, e-ticket number.
  - Train-specific fields: Train number & name, Coach, Berth/Seat number, Quota (General, Tatkal), Charting status.
  - Departure & Arrival stations/airports, scheduled timings, platform/terminal info.
- **Accommodations & Hotels:**
  - Property name, address, Google Maps coordinate link, contact telephone.
  - Check-in & check-out dates/times, room type, breakfast inclusion.
  - Confirmation reference, total tariff, advance deposit paid, balance due at check-in.

### Pillar 4: Ticket PDFs, Screenshots & Booking Attachments
- Local offline attachment storage for e-tickets, boarding passes, IRCTC PDFs, hotel vouchers, and ID copies.
- Full offline viewing capability: cached as binary blobs in IndexedDB/Capacitor Filesystem.
- In-app preview modal with zoom/pan and external Android intent viewer trigger.

### Pillar 5: Food Planning & Meal Scheduling
- Regional culinary checklist: Must-try local delicacies, street foods, regional beverages.
- Restaurant wishlist: Venue name, location, pricing tier, meal slot (Breakfast, Lunch, Dinner, Cafe/Chai).
- Dietary attributes: Vegetarian, Vegan, Non-Veg, Halal, Gluten-Free.
- Status tracker: Visited / Reviewed with 1-5 star rating and personal dish recommendation.

### Pillar 6: Bike & Scooter Rental Management
- Vehicle model (e.g., Royal Enfield Himalayan 450, Scram 411, Activa 6G, Thar).
- Rental agency details: Vendor name, phone, pickup/drop-off depot address.
- Registration number, engine capacity, helmet & riding gear provided (jackets, knee guards, bungee cords).
- Odometer & fuel tracking: Start km, end km, fuel policy (full-to-full, empty-to-empty).
- Financials: Daily rate, security deposit paid, deposit receipt note, refund status (`Pending`, `Refunded`, `Deducted`).
- Vehicle condition inspector: Pre-rental inspection checklist with photo attachments for existing scratches/dents.

### Pillar 7: Maps, Routes & Offline Waypoints
- Saved point-of-interest (POI) markers with GPS coordinates, elevation, and category (Scenic Pass, Fuel Pump, Mechanic, Medical, Cafe).
- Route leg details: Altitude profile, road condition warnings, estimated transit time.
- One-tap Android native navigation trigger: Launches Google Maps / OsmAnd with `geo:` coordinates.

### Pillar 8: Budget Planning, Expense Tracking & Deposits
- Total trip budget allocation by category: Transport, Stays, Food, Rentals, Fuel, Activities, Permits, Misc.
- Live expense logger: Amount, currency, category, paid by, payment method (Cash, UPI, Card), split shares.
- Security deposit dashboard: Tracks refundable bike/hotel deposits, due dates, and refund receipts.
- Live analytics: Category spend breakdown, daily burn rate, remaining allowance.

### Pillar 9: Packing Lists & Equipment Checklists
- Curated template categories: Documents & Permits, Riding/Outdoor Gear, Warm Layers & Thermals, Electronics & Power, Toiletries, First Aid & Mountain Medicine.
- Smart item attributes: Quantity, "Essential / Non-Negotiable" flag, packed status toggle.
- Real-time packing progress bar with missing essential items warning.

### Pillar 10: Weather, Emergency Contacts & Plan B Contingencies
- Emergency Directory: Local police, nearest hospital, mountain rescue / disaster helpline, state tourist police, personal ICE (In Case of Emergency) contacts.
- Personal Medical Profile: Blood group, emergency medications, AMS (Acute Mountain Sickness) medical kit checklist, travel insurance policy details.
- Contingency / Plan B matrix: Alternative routes if passes close, backup accommodations, bad weather diversions.

### Pillar 11: Local Notifications & Reminders
- Native Android notification alerts scheduled via `@capacitor/local-notifications`.
- Automated reminders:
  - 24h & 3h before train/flight departure.
  - Hotel check-in time alert.
  - Bike rental drop-off deadline warning to avoid extra-day penalties.
  - Custom user reminders (e.g., "Take Diamox at 8 AM", "Check Rohtang pass status").

### Pillar 12: Offline-First Architecture
- Full read and write capabilities with zero cellular or Wi-Fi network connection.
- Local persistence via IndexedDB (`life_atlas_vault_db`) backed by web storage and optional Capacitor Filesystem caching for heavy PDFs.
- Automatic online re-sync: When an internet connection is detected, data changes can be synced to Neon Postgres.

### Pillar 13: Optional AI Itinerary Assistant & Document Parser
- AI Itinerary Generator: Takes destination, duration, travel style, and budget to generate a suggested day-by-day plan using structured JSON.
- Document Parser: Extracts PNR, train number, departure dates, hotel booking codes from raw confirmation text or emails.
- Graceful offline degradation: Disables AI actions with an informative banner when offline, without disrupting manual entry.

### Pillar 14: Biometric Security Gate
- Seamlessly protected by the existing Secret Door double-tap and `@aparajita/capacitor-biometric-auth` fingerprint prompt.
- Vault-specific session timeout (configurable, default 15 minutes of inactivity).
- Instant "Lock Vault" button in the navigation header to purge session tokens immediately.

### Pillar 15: Completed-Trip Archives & Memories
- Trip completion milestone celebration: Transition trip to `COMPLETED`.
- Trip summary dossier: Total distance traveled, total expenses vs budget, photos captured, places checked off.
- Photo memory wall with geotags and captions.
- "Publish to Life Atlas Journal" export action: Formats selected photos and narrative into the public Life Atlas journal.

---

## 3. Core vs. External Dependency Classification

| Tier | Category | Features Included | Dependencies / Requirements | Fallback if Unavailable |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Core Local (100% Offline)** | Trip dashboard, Itineraries, Bookings, Rentals, Food, Budget, Packing, Emergency, Memories | React 19, IndexedDB, Tailwind CSS, Lucide icons, `localStorage` | None required; self-contained |
| **Tier 2** | **Native Android Plugins** | Biometric lock, Local notifications, System navigation intents, Haptic feedback | `@aparajita/capacitor-biometric-auth`, `@capacitor/local-notifications`, `@capacitor/app` | WebAuthn / PIN modal, browser alerts, Web Audio |
| **Tier 3** | **Local File Storage** | Ticket PDFs, booking screenshots, vehicle inspection photos | IndexedDB Blob store / `@capacitor/filesystem` | Base64 image cache in IndexedDB |
| **Tier 4** | **Backend / Cloud Services** | Cloud backup, multi-device sync, permanent photo CDN | Neon PostgreSQL (`@prisma/client`), Neon Object Storage (`files-sdk`) | Remains securely in local IndexedDB |
| **Tier 5** | **External AI Services** | AI itinerary generation, PNR text parsing | Neon AI Gateway / OpenAI API / Databricks endpoint | Manual entry forms always functional |

---

## 4. Technical Architecture & Persistence Strategy

### 4.1 Storage Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                   Life Atlas Android Client (WebView)                  │
├────────────────────────────────────────────────────────────────────────┤
│  React 19 State / Context (useTripVaultStore)                          │
├───────────────────────────────────┬────────────────────────────────────┤
│  Local-First Persistence Layer    │  Native Capacitor Bridge           │
│  - IndexedDB (life_atlas_vault_db)│  - BiometricAuth Plugin            │
│    * Trips Store                  │  - LocalNotifications Plugin       │
│    * Itineraries Store            │  - App / StatusBar Plugin          │
│    * Bookings & PNRs Store        │  - Hardware Back-Button            │
│    * Documents Blob Store (PDFs)  │                                    │
│    * Expenses Store               │                                    │
│    * Packing Checklists Store     │                                    │
├───────────────────────────────────┴────────────────────────────────────┤
│  (Optional Cloud Sync when Online)                                     │
│  - POST /api/vault/sync -> Neon PostgreSQL                             │
│  - POST /api/upload -> Neon Object Storage (Images / Large Files)      │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Database Schema (IndexedDB Object Stores)
1. `trips`: `id` (key), `title`, `destination`, `startDate`, `endDate`, `status`, `travelStyle`, `coverImage`, `budgetTotal`, `currency`, `companions`, `createdAt`, `updatedAt`.
2. `itineraries`: `id` (key), `tripId` (index), `dayIndex`, `date`, `title`, `description`, `weatherNote`, `activities` (JSON array of hourly blocks).
3. `bookings`: `id` (key), `tripId` (index), `category` (`TRANSPORT` | `HOTEL`), `type`, `title`, `pnrNumber`, `carrier`, `departureTime`, `arrivalTime`, `departureLocation`, `arrivalLocation`, `cost`, `status`, `notes`.
4. `documents`: `id` (key), `tripId` (index), `bookingId`, `title`, `type` (`PDF` | `IMAGE`), `blobData` (binary), `mimeType`, `sizeBytes`, `createdAt`.
5. `rentals`: `id` (key), `tripId` (index), `vehicleModel`, `vehicleRegNumber`, `vendorName`, `vendorPhone`, `pickupDate`, `dropoffDate`, `dailyRate`, `securityDeposit`, `depositRefunded`, `conditionNotes`, `inspectionPhotos`.
6. `food_items`: `id` (key), `tripId` (index), `name`, `type` (`SPECIALTY` | `RESTAURANT`), `cuisine`, `location`, `mealSlot`, `priceLevel`, `status`, `rating`, `notes`.
7. `expenses`: `id` (key), `tripId` (index), `title`, `amount`, `currency`, `category`, `paidBy`, `paymentMode`, `date`, `isDeposit`, `depositRefunded`.
8. `packing_items`: `id` (key), `tripId` (index), `category`, `name`, `quantity`, `isEssential`, `isPacked`.
9. `safety_contacts`: `id` (key), `tripId` (index), `name`, `role`, `phone`, `alternatePhone`, `address`, `notes`, `isEmergency`.
10. `reminders`: `id` (key), `tripId` (index), `title`, `body`, `triggerTime`, `nativeNotificationId`, `isTriggered`.

---

## 5. Implementation Phases & Roadmap

```mermaid
gantt
  title Life Atlas Android Trip Vault Implementation Roadmap
  dateFormat  YYYY-MM-DD
  section Foundation & Storage
  Phase 1: Foundation, Data Models & Offline Storage    :p1, 2026-10-22, 2d
  Phase 2: Trip Dashboard & Creation UI               :p2, after p1, 2d
  section Core Travel Logistics
  Phase 3: Multi-Destination Route & Daily Itinerary   :p3, after p2, 2d
  Phase 4: Transport Bookings, PNRs & Hotels          :p4, after p3, 2d
  Phase 5: Offline Document & PDF Attachment Vault    :p5, after p4, 2d
  section Supporting Features
  Phase 6: Food Roadmaps & Restaurant Scheduler        :p6, after p5, 1d
  Phase 7: Bike & Scooter Rental Management           :p7, after p6, 2d
  Phase 8: Maps, Offline Waypoints & GPS Navigation   :p8, after p7, 2d
  Phase 9: Budget Planning, Expenses & Deposits       :p9, after p8, 2d
  Phase 10: Packing Lists & Gear Checklists           :p10, after p9, 1d
  section Security & Native Integrations
  Phase 11: Safety Directory, Medical ICE & Plan B    :p11, after p10, 1d
  Phase 12: Android Local Notifications & Reminders   :p12, after p11, 2d
  Phase 13: Completed Trip Archives & Photo Memories  :p13, after p12, 1d
  Phase 14: AI Itinerary Assistant & PNR Text Parser  :p14, after p13, 2d
  Phase 15: Quality Audit, Website Isolation & Build  :p15, after p14, 2d
```

### Phase 1: Foundation, Data Models & Offline Storage
- Establish `src/lib/vault/types.ts` with rigorous TypeScript definitions.
- Implement `src/lib/vault/storage.ts` using native IndexedDB with zero external runtime dependencies.
- Implement CRUD operations and reactive hooks (`useTripVaultStore`).
- Ensure 100% offline persistence testable immediately in browser and Android WebView.

### Phase 2: Trip Dashboard & Creation UI (`/secret/vault`)
- Create `/secret/vault/page.tsx` displaying Active Trip Hero, Upcoming Expeditions, and Past Archives.
- Create `/secret/vault/new/page.tsx` with persistent multi-step trip creation (Dates, Travel Style, Destination, Budget).
- Add Trip Vault Gateway Card to `src/app/secret/page.tsx` alongside existing Creator Studio.

### Phase 3: Multi-Destination Route & Day-by-Day Itinerary
- Create `/secret/vault/[tripId]/itinerary/page.tsx`.
- Multi-destination stops sequence with transit estimate badges.
- Day-by-day itinerary view with hourly time slots (Morning, Afternoon, Evening, Night).
- Activity creation modal with status toggles (`Planned`, `In Progress`, `Done`).

### Phase 4: Transport Bookings, Train Tickets, PNRs & Hotels
- Create `/secret/vault/[tripId]/bookings/page.tsx`.
- Train/Flight/Bus booking forms with PNR, coach, berth, stations, and live timing fields.
- Hotel accommodation cards with check-in/out badges, address, contact phone, and deposit balance.
- Quick copy PNR and 1-tap call hotel actions.

### Phase 5: Offline Document & PDF Attachment Vault
- Create `/secret/vault/[tripId]/documents/page.tsx`.
- Document uploader supporting PDF files and image screenshots.
- Storage in IndexedDB as binary blobs with offline URL generation (`URL.createObjectURL`).
- Built-in PDF reader / image zoom modal with download action.

### Phase 6: Food Planning & Culinary Roadmaps
- Create `/secret/vault/[tripId]/food/page.tsx`.
- Regional specialties checklist ("Dishes to taste").
- Curated cafe & restaurant wishlist categorized by meal slot.
- Star ratings and personal tasting notes.

### Phase 7: Bike & Scooter Rental Management
- Create `/secret/vault/[tripId]/rentals/page.tsx`.
- Vehicle rental specs: Model, registration number, vendor phone, pickup/drop dates.
- Security deposit tracking: Amount paid, receipt note, refund status tracker.
- Vehicle condition inspector with inspection photo gallery for pre-existing scratches.

### Phase 8: Maps, Offline Waypoints & GPS Navigation
- Create `/secret/vault/[tripId]/routes/page.tsx`.
- Saved waypoints list with elevation, category, coordinates, and notes.
- Route overview summary (Total estimated km, mountain passes, road condition advisories).
- One-tap navigation trigger passing `geo:lat,lng` to Google Maps on Android.

### Phase 9: Budget Planning, Expenses & Deposit Tracker
- Create `/secret/vault/[tripId]/budget/page.tsx`.
- Category budget allocation vs actual spending progress bars.
- Live expense addition with multi-currency conversion, payment modes, and split notes.
- Dedicated Security Deposit Recovery ledger.

### Phase 10: Packing Lists & Gear Checklists
- Create `/secret/vault/[tripId]/packing/page.tsx`.
- Multi-category checklists with pre-populated expedition templates.
- "Essential Items" high-priority filters and progress indicators.
- Custom gear addition with quantity indicators.

### Phase 11: Safety Directory, Medical ICE & Plan B Contingencies
- Create `/secret/vault/[tripId]/safety/page.tsx`.
- Quick-dial emergency contact list (Police, Mountain Rescue, Local Hospitals).
- Personal ICE card: Blood group, allergies, travel insurance policy hotline.
- Plan B contingency notes for road closures or weather disruptions.

### Phase 12: Android Local Notifications & Reminders
- Install and configure `@capacitor/local-notifications`.
- Request notification permissions on Android 13+ (`POST_NOTIFICATIONS`).
- Schedule departure alerts, hotel check-in alarms, and bike return reminders.
- Manage scheduled notification IDs and cancellation triggers.

### Phase 13: Completed Trip Archives & Photo Memories
- Create `/secret/vault/[tripId]/memories/page.tsx`.
- Trip wrap-up screen: Mark trip as `COMPLETED`.
- Milestone statistics (Total km, days on the road, budget saved/spent).
- Photo memory wall with captioning and reflections journal.
- "Export to Public Journal" tool.

### Phase 14: Optional AI Itinerary Assistant & Document Parser
- Optional AI itinerary generator modal using structured prompt output.
- Document text parser for extracting PNR, flight dates, and hotel codes from pasted text.
- Fallback banner when offline; never blocks manual creation.

### Phase 15: Quality Audit, Website Isolation & Build Verification
- Rigorous verification of website isolation: Verify `/`, `/trips`, `/places`, `/admin` have zero regressions.
- Verify secret door double-tap and biometric fingerprint authentication remain 100% operational.
- Execute full production build (`npm run build`).
- Execute Capacitor sync (`npx cap sync android`).

---

## 6. Comprehensive Project Requirements Checklist

> **Legend:**  
> **Legend:**  
> - `Status`: `Not Started` | `In Progress` | `Implemented` | `Verified`  
> - `Platform`: `ANDROID_VAULT` (Executed inside Android secret section)  
> - `Type`: `CORE` (Offline/Local) | `NATIVE` (Capacitor Plugin) | `EXTERNAL` (API/Cloud)  

### 6.1 Foundation & Local Persistence (FND)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-FND-01` | Vault TypeScript Schema | Define strict interfaces for Trips, Itineraries, Bookings, Rentals, Expenses, Documents, Packing, and Safety. | None | `ANDROID_VAULT` | `CORE` | `Verified` | `src/lib/vault/types.ts` defined with strict types; TypeScript compiles with zero errors; covers all 15 pillars. |
| `REQ-FND-02` | IndexedDB Offline Engine | Implement `vault/storage.ts` using raw IndexedDB for full CRUD operations across all stores. | `REQ-FND-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Data persists across page reloads in browser and Android WebView with zero network; 8 automated tests passing in `tests/vault/storage.test.ts`. |
| `REQ-FND-03` | Reactive Vault Store Hook | Build `useTripVaultStore` providing cached reactive state and instant UI updates. | `REQ-FND-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Mutations immediately update UI without manual page refresh; verified in `src/lib/vault/useTripVaultStore.ts` and `tests/vault/tripVaultFlow.test.ts`. |
| `REQ-FND-04` | Secret Dashboard Integration | Add "Trip Vault" access card to `/secret/page.tsx` alongside existing Creator Studio. | Existing Secret Section | `ANDROID_VAULT` | `CORE` | `Verified` | Visible inside `/secret`; preserved existing Creator Studio and biometric gate. |

### 6.2 Trip Management & Lifecycle (TRP)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-TRP-01` | Trip Vault Dashboard View | Render `/secret/vault/page.tsx` showing active trips, upcoming expeditions, and archived journeys. | `REQ-FND-03` | `ANDROID_VAULT` | `CORE` | `Verified` | Displays trip cards with dates, destination badges, status filters, and active expedition hero. |
| `REQ-TRP-02` | Trip Creation Form | Multi-step form at `/secret/vault/new/page.tsx` for title, dates, destinations, style, and budget. | `REQ-TRP-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Submitting persists to IndexedDB, supports multi-stop waypoints, and navigates to command center. |
| `REQ-TRP-03` | Trip Edit & Delete | Allow updating trip parameters and safe deletion with confirmation modal. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Updates persist immediately; deletion cleans up cascaded child records; verified in unit tests. |
| `REQ-TRP-04` | Trip Lifecycle Transition | Change trip status between `PLANNING`, `ACTIVE`, `COMPLETED`, and `ARCHIVED`. | `REQ-TRP-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Status changes persist immediately in IndexedDB; active countdown and command center badges render dynamically. |

### 6.3 Itinerary & Day-by-Day Scheduling (ITN)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-ITN-01` | Multi-Destination Legs | Sequence multiple destinations with transit mode and distance estimates. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Displays chronological stop cards with transit connectors and stay nights; verified in `src/app/secret/vault/[tripId]/itinerary/page.tsx` and unit tests. |
| `REQ-ITN-02` | Day-by-Day Calendar | Generate calendar days from trip start to end dates with custom themes. | `REQ-ITN-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Auto-generates days aligned with trip dates, custom themes, weather forecasts, and intensity ratings; verified in `src/lib/vault/useItinerary.ts`. |
| `REQ-ITN-03` | Hourly Activity Blocks | Add morning, afternoon, evening, and night activities with time and location. | `REQ-ITN-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Chronological activity timeline segmented by time slots with cost and location pins; full CRUD supported. |
| `REQ-ITN-04` | Activity Status Tracking | Toggle activity between `Planned`, `In Progress`, `Completed`, and `Skipped`. | `REQ-ITN-03` | `ANDROID_VAULT` | `CORE` | `Verified` | Toggling updates day completion percentage and overall expedition progress meter in real time with offline persistence. |

### 6.4 Bookings, Transport & Accommodation (BKG)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-BKG-01` | Transport Booking Manager | Record Train (IRCTC), Flight, Bus, and Cab bookings with PNR, seats, and timings. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Displays transport ticket cards with 1-tap copy PNR button; verified in `src/app/secret/vault/[tripId]/bookings/page.tsx` and unit tests. |
| `REQ-BKG-02` | Hotel & Stay Manager | Record hotel name, address, check-in/out times, room type, and contact phone. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Displays stay voucher cards with 1-tap call and directions buttons; verified in UI and tests. |
| `REQ-BKG-03` | Deposit & Balance Tracker | Track advance deposit paid vs remaining balance payable at check-in. | `REQ-BKG-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Financial totals correctly compute balance due on arrival with real-time balance calculations; verified in `src/lib/vault/useBookings.ts`. |

### 6.5 Offline Documents & PDF Attachments (DOC)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-DOC-01` | Offline Document Uploader | Upload PDFs, PNGs, and JPEGs (tickets, boarding passes, ID cards). | `REQ-BKG-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Binary Blob persisted directly in IndexedDB `documents` store with MIME type and size; verified in `src/lib/vault/useDocuments.ts` and automated tests. |
| `REQ-DOC-02` | Offline Document Viewer | In-app document previewer supporting multi-page PDFs and images. | `REQ-DOC-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Dedicated in-app PDF & zoomable image preview modal with Blob object URL creation, cleanup, and download action in `src/app/secret/vault/[tripId]/documents/page.tsx`. |
| `REQ-DOC-03` | Document Association | Link documents directly to specific transport or hotel bookings. | `REQ-DOC-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Linked to bookings via `bookingId`; filterable in documents view and dynamic "View Attached Ticket (N)" button rendered on booking cards in `bookings/page.tsx`. |

### 6.6 Culinary & Food Roadmaps (FOD)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-FOD-01` | Regional Specialty Checklist | Curated checklist of local regional dishes, beverages, and street food. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Curated regional dishes checklist with 1-tap tried checkbox toggle, 1-to-5 star rating bar, personal flavor critique notes, and regional preset generator in `src/app/secret/vault/[tripId]/food/page.tsx`; verified in unit tests. |
| `REQ-FOD-02` | Restaurant & Cafe Scheduler | Wishlist of eateries categorized by meal slot (Breakfast, Lunch, Dinner, Cafe). | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Categorized by meal slots with distinct icons, price tier indicators (₹-₹₹₹₹), must-order spotlight banners, 1-tap Google Maps directions action, and multi-tag dietary filters (VEG, NON_VEG, VEGAN, JAIN, EGG); verified in tests and production build. |

### 6.7 Bike & Scooter Rental Logistics (RNT)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-RNT-01` | Vehicle Specs & Vendor Record | Record vehicle model, registration number, vendor name, and phone. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Vehicle specs card with license plate badge, vendor contact hotline, and 1-tap `tel:` dialer link in `src/app/secret/vault/[tripId]/rentals/page.tsx`; verified in unit tests. |
| `REQ-RNT-02` | Rental Dates & Odometer Log | Record pickup/drop-off dates, start km, end km, and fuel policy. | `REQ-RNT-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Pickup/drop schedule tracking, daily tariff calculation, and automated telemetry distance computation (`endKm - startKm`) with quick-log odometer modal; verified in tests. |
| `REQ-RNT-03` | Security Deposit Ledger | Track deposit amount paid, receipt note, and refund status. | `REQ-RNT-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Security deposit tracking with payment mode badges, pending refund tally, and 1-tap transition from `PENDING` to `REFUNDED` or `DEDUCTED`; verified in `src/lib/vault/useRentals.ts`. |
| `REQ-RNT-04` | Pre-Rental Scratch Inspector | Attach condition photos and checklist of pre-existing vehicle dents/scratches. | `REQ-RNT-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Scratch inspector with gear checklist, condition notes, and client-side photo capture gallery with fullscreen zoom lightbox; verified in tests and production build. |

### 6.8 Maps, Routes & Offline Waypoints (MAP)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MAP-01` | Saved Waypoints Directory | Save key POIs (Fuel pumps, passes, mechanics, scenic spots) with GPS coords. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Waypoint directory categorized by type (Passes, Fuel, Mechanics, Hazards, Medical, Viewpoints) with elevation meters, GPS coordinates with 1-tap copy, and Himalayan preset seeder in `src/app/secret/vault/[tripId]/routes/page.tsx`; verified in unit tests. |
| `REQ-MAP-02` | Route Segment Summary | Outline road legs with terrain, distance, and road condition advisories. | `REQ-MAP-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Chronological route segments with distance km, driving hours, road condition badges (Excellent, Paved, Potholes, Gravel, Water Crossing, Extreme), passes crossed, and advisory notes; verified in tests. |
| `REQ-MAP-03` | Native Navigation Intent | Tap waypoint to trigger native Android navigation via `geo:` protocol. | `REQ-MAP-01` | `ANDROID_VAULT` | `NATIVE` | `Verified` | 1-tap navigation intent for individual waypoints (`geo:lat,lng` intent and Google Maps URL) and origin-to-destination directions for route legs; verified in unit tests and production build. |

### 6.9 Budget, Expenses & Deposit Management (BDG)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-BDG-01` | Budget Allocation | Set overall budget and divide across Transport, Stay, Food, Rentals, Misc. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Set total budget and category allocations (Transport, Stay, Food, Rentals, Misc); visual progress bars with warning states (>90% Amber, >100% Crimson), remaining amount calculation, and modal budget editor in `src/app/secret/vault/[tripId]/budget/page.tsx`; verified in unit tests. |
| `REQ-BDG-02` | Live Expense Logger | Add expense with amount, currency, category, paid by, and payment mode. | `REQ-BDG-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Live expense logger with amount, category, payment mode (UPI, Cash, Credit Card, Debit Card, Net Banking), payer, split notes, date/time, and search/filter; recalculates remaining balance and category utilization instantly; verified in unit tests. |
| `REQ-BDG-03` | Refundable Deposit Dashboard | Dedicated view aggregating all security deposits (Bikes, Hotels, Gear). | `REQ-BDG-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Dedicated Refundable Security Deposit Recovery Dashboard aggregating rental and stay deposits with status badges (PENDING, REFUNDED, DEDUCTED, FORFEITED), pending refund tally, and 1-tap settlement modal; verified in unit tests and production build. |

### 6.10 Packing Lists & Equipment Checklists (PCK)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-PCK-01` | Categorized Gear Lists | Checklists for Clothes, Electronics, Riding Gear, Medical, and Documents. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Categorized checklists for Documents, Riding Gear, Electronics, First Aid, Clothing, Toiletries, Camping, and Misc with 1-tap persistent checkbox toggles, overall readiness progress bar, category progress pills, and bulk pack/reset actions in `src/app/secret/vault/[tripId]/packing/page.tsx`; verified in unit tests. |
| `REQ-PCK-02` | Essential Items Filter | Mark critical items (IDs, permits, medicines) with an "Essential" flag. | `REQ-PCK-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Critical essentials filter with 'Essentials Only' toggle button; high-visibility glowing alert card prominently warning if any critical item is unpacked with 1-tap pack action; verified in unit tests and production build. |
| `REQ-PCK-03` | Custom Checklist Items | Add, edit, and delete custom packing items with quantity counters. | `REQ-PCK-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Add, edit, and delete custom packing items with quantity stepper counters (+ / -), critical flag toggles, location notes, and expedition blueprint presets (Himalayan Ride, Weekend Roadtrip, Monsoon Expedition); verified in unit tests. |

### 6.11 Emergency, Medical & Plan B Contingencies (SAF)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-SAF-01` | Emergency Services Directory | Fast-access contacts for Police, Mountain Rescue, Hospitals, and Local SOS. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Fast-access Emergency Services Directory for Police, Mountain Rescue, Hospital, Personal ICE, and Mechanic; 1-tap call triggers Android dialer with `tel:` URI protocol; rapid emergency SOS ribbon and national emergency presets in `src/app/secret/vault/[tripId]/safety/page.tsx`; verified in unit tests. |
| `REQ-SAF-02` | Medical & Insurance Card | Quick-view card: Blood group, allergies, emergency meds, insurance policy. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Clear offline Medical & Insurance Card with blood group badge, verified allergies, emergency medications, insurance policy number, 1-tap cashless TPA hotline, and emergency responder directives; verified in unit tests and production build. |
| `REQ-SAF-03` | Contingency / Plan B Matrix | Document backup plans for road closures, weather delays, or missed trains. | `REQ-TRP-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Documented Contingency / Plan B Matrix for road closures, mountain pass snow blockage, and mechanical breakdowns with trigger condition, step-by-step backup action protocol, and alternate route notes; verified in unit tests. |

### 6.12 Android Local Notifications & Reminders (NOT)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-NOT-01` | Local Notification Plugin | Install `@capacitor/local-notifications` and configure Android permissions. | None | `ANDROID_VAULT` | `NATIVE` | `Verified` | Installed `@capacitor/local-notifications` v6.1.3; configured Android permissions (`POST_NOTIFICATIONS`, `VIBRATE`, `SCHEDULE_EXACT_ALARM`) in `AndroidManifest.xml`; verified via `npx cap sync android` registering the plugin with the native project. |
| `REQ-NOT-02` | Departure & Check-in Alarms | Schedule native notification reminders for transport and hotel check-in. | `REQ-NOT-01`, `REQ-BKG-01` | `ANDROID_VAULT` | `NATIVE` | `Verified` | Automated departure alarms for transport bookings (trains, flights, buses with PNR & berth info) and check-in alarms for hotel stays with sound, vibration, high-priority heads-up banner channel (`trip_vault_expedition_channel`), and in-app cancellation in `src/app/secret/vault/[tripId]/reminders/page.tsx`; verified in unit tests. |
| `REQ-NOT-03` | Rental Drop-off Warning | Schedule alert 3 hours before bike rental deadline to avoid penalty. | `REQ-NOT-01`, `REQ-RNT-02` | `ANDROID_VAULT` | `NATIVE` | `Verified` | Automated rental drop-off deadline warning scheduled 3 hours prior to return deadline to prevent late return penalties, reminding the traveler of fuel policy, deposit recovery (₹ amount), and vendor hotline; verified in unit tests. |

### 6.13 Memories, Archives & Public Journal Export (MEM)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-MEM-01` | Completed Trip Dossier | Summary screen upon completing trip with distance, costs, and memories. | `REQ-TRP-04` | `ANDROID_VAULT` | `CORE` | `Verified` | Summary celebration dossier with milestone completion toggle, days on road, total distance km aggregated from rental odometers and route segments, budget variance, and multi-pillar completion bars in `src/app/secret/vault/[tripId]/memories/page.tsx`; verified in unit tests. |
| `REQ-MEM-02` | Photo Reflection Wall | Gallery of trip memories with captions, dates, and locations. | `REQ-MEM-01` | `ANDROID_VAULT` | `CORE` | `Verified` | Masonry reflection wall with client-side image attachment, star ratings, highlight badge filter, and fullscreen zoom lightbox; verified in unit tests and production build. |
| `REQ-MEM-03` | Export to Public Journal | Convert selected vault memories into public Life Atlas journal entries. | `REQ-MEM-02` | `ANDROID_VAULT` | `EXTERNAL` | `Verified` | 1-tap export API in `src/app/api/vault/export/route.ts` converting vault memories into public Prisma Postgres `Trip`, `Memory`, `TimelineEvent`, and `Photo` records with zero changes to public website code; verified in unit tests and production build. |

### 6.14 Optional AI Itinerary & Document Parser (AIX)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-AIX-01` | AI Itinerary Generator | Generate suggested day-by-day itinerary from destination and style prompt. | Neon AI Gateway | `ANDROID_VAULT` | `EXTERNAL` | `Verified` | Full itinerary architect with Neon AI Gateway proxy and offline curated knowledge engine (Spiti, Ladakh, Meghalaya, and dynamic templates); 1-click import into IndexedDB with hourly activities & gear in `src/app/secret/vault/[tripId]/assistant/page.tsx`; verified in unit tests and production build. |
| `REQ-AIX-02` | PNR & Booking Parser | Extract PNR, train number, and departure times from pasted confirmation text. | Neon AI Gateway | `ANDROID_VAULT` | `EXTERNAL` | `Verified` | 100% offline regex & NLP confirmation parser extracting IRCTC 10-digit PNRs, coach/berth details, flight references, bus sleeper seats, and stay vouchers with 1-tap auto-fill into vault bookings; verified in unit tests. |

### 6.15 Security, Isolation & Quality Audit (AUD)
| ID | Requirement Title | Description | Dependencies | Platform | Type | Status | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-AUD-01` | Website Isolation Audit | Verify public website routes (`/`, `/trips`, `/places`, `/admin`) are 100% unaffected. | All Reqs | `WEBSITE` | `CORE` | `Verified` | Automated Next.js build passes all 42 routes; public routes render unchanged; zero database leaks between PostgreSQL and local Vault IndexedDB. Verified in unit tests. |
| `REQ-AUD-02` | Secret Door & Biometric Audit | Verify 3D secret door double-tap and fingerprint authentication work perfectly. | Existing Hero | `ANDROID_VAULT` | `NATIVE` | `Verified` | BiometricPrompt and WebAuthn platform authenticators supported with fallback Guardian PIN 1984; immediate session grant & instant token revocation on vault lock; verified in unit tests. |
| `REQ-AUD-03` | Offline Resilience Audit | Verify all vault features function in airplane mode without network errors. | `REQ-FND-02` | `ANDROID_VAULT` | `CORE` | `Verified` | Full 15-pillar end-to-end trip lifecycle passes in simulated airplane mode with local IndexedDB storage; atomic cascade cleanup across all 10 stores verified with 0 orphaned records. |
| `REQ-AUD-04` | Production Android Build | Build production APK and verify zero compilation or native manifest errors. | `npx cap sync` | `ANDROID_VAULT` | `NATIVE` | `Verified` | `npm run build` exits 0 (42/42 static & dynamic routes compiled); `npx cap sync android` exits 0 (4 plugins synced); native permissions (`INTERNET`, `USE_BIOMETRIC`, `POST_NOTIFICATIONS`, `VIBRATE`, `SCHEDULE_EXACT_ALARM`) verified in `AndroidManifest.xml`. |

---

## 7. Risk Analysis & Mitigation Strategies

### 7.1 Shared Website Files Regression Risk
- **Risk:** Modifications to shared components could break public website routes or desktop styling.
- **Mitigation:**
  - Strict encapsulation: All Trip Vault pages and UI components reside exclusively under `src/app/secret/vault/` and `src/components/vault/`.
  - Zero modification to public routes (`/`, `/explore`, `/trips`, `/places`, `/cinema`, `/food`, `/photography`, `/map`, `/timeline`, `/about`, `/admin`).
  - Automated Next.js static build validation (`npm run build`) runs after every phase to guarantee zero build breakage.

### 7.2 Secret Section Authentication Bypass Risk
- **Risk:** Unauthenticated users accessing `/secret/vault` directly via URL or deep links.
- **Mitigation:**
  - `src/components/secret/SecretAppGuard.tsx` wraps the entire `/secret` tree in `src/app/secret/layout.tsx`.
  - If `isSecretAccessGranted()` is false, direct visits immediately present the Vault Protected Lock Screen requiring device biometric verification (`@aparajita/capacitor-biometric-auth`) or Guardian PIN.
  - Adding a manual "Lock Vault" button in the Trip Vault header to purge session tokens immediately upon exit.

### 7.3 Local Persistence & Storage Quota on Android WebView
- **Risk:** Large document attachments (PDFs, high-resolution photos) exceeding standard browser local storage limits.
- **Mitigation:**
  - IndexedDB is used instead of `localStorage` for all trip entities and documents. IndexedDB on modern Android WebViews supports gigabytes of structured and blob data.
  - Documents are compressed and stored as raw binary `Blob` objects.
  - When online, optional background backup to Neon Object Storage frees up local capacity while keeping cached thumbnails.

### 7.4 Offline Access Failures in Remote Mountain Zones
- **Risk:** Features crashing or displaying blank screens when traveling with no cellular connectivity.
- **Mitigation:**
  - Local-first architecture: All read and write operations execute synchronously against the local IndexedDB database.
  - No network request is in the critical rendering path of any Trip Vault view.
  - AI features and cloud backup are clearly designated as optional enhancements that degrade gracefully with offline status indicators.

### 7.5 Android Back-Button & Fullscreen Immersion Compatibility
- **Risk:** Pressing the Android hardware back button exiting the entire application instead of stepping back through vault screens.
- **Mitigation:**
  - `MobileAppBridge.tsx` handles `CapApp.addListener('backButton')`.
  - Within `/secret/vault/*`, the back button pops the vault navigation stack (e.g., from Itinerary back to Trip Command Center, and from Trip Command Center back to Vault Dashboard).
  - Only when on the public root `/` does the hardware back button exit the app.

---

## 8. Verification & Testing Strategy

### 8.1 Website Isolation Verification Protocol
1. Run `npm run lint` and verify zero errors across the entire repository.
2. Run `npm run build` and verify that all public routes (`/`, `/trips`, `/places`, `/admin`, etc.) compile statically with status code 200.
3. Verify that `/admin` remains protected by `AdminMobileGuard` for desktop web and does not expose vault data.
4. Verify that public `/trips` displays only public chronicles and is completely isolated from private vault trips.

### 8.2 Android Offline Vault Verification Protocol
1. Load `/secret/vault` in Android WebView or browser emulator.
2. Enable Network Offline (Airplane Mode).
3. Create a new trip with multi-day itinerary, train booking, PNR, and hotel.
4. Attach a sample PDF ticket and verify it opens offline.
5. Add expenses, checklist items, and emergency contacts.
6. Refresh the page while still offline and verify 100% data retention.

### 8.3 Biometric Gate Verification Protocol
1. Double-tap the Secret Door on the 3D Hero screen.
2. Confirm that the native fingerprint prompt or Device Security Modal appears.
3. Authenticate with fingerprint or Guardian PIN (`1984`).
4. Confirm navigation to `/secret` and access to Trip Vault.
5. Tap "Lock Vault" and confirm that accessing `/secret/vault` immediately locks and presents the biometric gate.

---

## 9. Smallest Sensible Implementation Order

To maintain stability, avoid regressions, and enable incremental testing:

1. **Phase 1: Foundation & Offline Storage Engine**
   - TypeScript definitions (`types.ts`), IndexedDB engine (`storage.ts`), reactive store (`useTripVaultStore`).
   - *Test:* Unit test IndexedDB persistence across page reloads.

2. **Phase 2: Trip Dashboard & Creation Flow**
   - `/secret/vault/page.tsx`, `/secret/vault/new/page.tsx`, entrance card in `/secret/page.tsx`.
   - *Test:* Create, edit, and view trips; verify Secret Door and Creator Studio remain intact.

3. **Phase 3: Itinerary & Multi-Destination Timeline**
   - `/secret/vault/[tripId]/itinerary/page.tsx`, hourly blocks, day themes.
   - *Test:* Add multi-day schedule with hourly activities and status toggles.

4. **Phase 4: Bookings (Train/PNR/Flight/Bus) & Hotel Stays**
   - `/secret/vault/[tripId]/bookings/page.tsx`, PNR copy, stay vouchers, deposit calculations.
   - *Test:* Add train booking with seat/coach and hotel with advance deposit balance.

5. **Phase 5: Offline Documents & PDF Ticket Vault**
   - `/secret/vault/[tripId]/documents/page.tsx`, blob storage, in-app viewer.
   - *Test:* Upload PDF e-ticket; view offline in airplane mode.

6. **Phase 6: Food Planning & Local Specialties**
   - `/secret/vault/[tripId]/food/page.tsx`, must-try food checklist, meal scheduler.
   - *Test:* Add restaurants, rate dishes, toggle tasted items.

7. **Phase 7: Bike & Scooter Rental Logistics**
   - `/secret/vault/[tripId]/rentals/page.tsx`, vendor contacts, deposit recovery, inspection photos.
   - *Test:* Record vehicle details, track deposit refund status, upload damage inspection photos.

8. **Phase 8: Maps, Saved Waypoints & GPS Navigation**
   - `/secret/vault/[tripId]/routes/page.tsx`, POIs, mountain passes, `geo:` intent triggers.
   - *Test:* Save coordinates; trigger native Google Maps launch on mobile.

9. **Phase 9: Budget Planning, Expenses & Deposit Tracker**
   - `/secret/vault/[tripId]/budget/page.tsx`, expense logger, multi-currency, deposit ledger.
   - *Test:* Add expenses; verify budget progress bar and refundable deposit calculations.

10. **Phase 10: Packing Lists & Gear Checklists**
    - `/secret/vault/[tripId]/packing/page.tsx`, categorized lists, essential item filters.
    - *Test:* Check off items; verify packing progress percentage and essential item alerts.

11. **Phase 11: Emergency Directory, Medical Card & Plan B**
    - `/secret/vault/[tripId]/safety/page.tsx`, 1-tap dialer, blood group/allergies, contingency notes.
    - *Test:* Verify offline access to medical details and 1-tap call triggers.

12. **Phase 12: Android Native Local Notifications & Reminders**
    - Install `@capacitor/local-notifications`, schedule departure and rental alerts.
    - *Test:* Schedule notification 1 minute out; verify system banner triggers on Android.

13. **Phase 13: Completed Trip Archives & Photo Memories (Implemented & Verified)**
    - `/secret/vault/[tripId]/memories/page.tsx`, trip completion milestone, photo wall, export.
    - *Test:* Transition trip to `COMPLETED`; view final statistics and memories gallery. Verified in 4 unit tests.

14. **Phase 14: Optional AI Assistant & Document Parser (Implemented & Verified)**
    - `/secret/vault/[tripId]/assistant/page.tsx`, AI itinerary generation, offline knowledge engine, and smart PNR parser.
    - *Test:* Verify parsing with mock text; verify graceful degradation when offline. Verified in 4 unit tests.

15. **Phase 15: Quality Audit, Website Isolation & Android Build (Implemented, Audited & Verified)**
    - Full `npm test` (67/67 tests passing across all 15 suites), `npm run lint` (0 errors), `npm run build` (42/42 static & dynamic routes compiled), and `npx cap sync android` (all 4 native plugins synced).
    - *Test:* Comprehensive audit ensuring 100% website isolation, native biometric security, end-to-end 15-pillar offline resilience, and Android manifest integrity. Verified in 4 unit tests (`tests/vault/finalQualityAudit.test.ts`).

