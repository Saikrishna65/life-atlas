/**
 * Life Atlas: AI Itinerary Architect & Curated Expedition Generator
 * Powers Phase 14 REQ-AIX-01.
 * Supports online Neon AI Gateway model generation with graceful, rich offline fallback.
 */

import {
  AIPendingPlan,
  AIPendingDay,
  TravelStyle,
  ID,
  ItineraryDayRecord,
  ItineraryActivity,
  PackingItemRecord,
} from "./types";
import { saveItineraryDay, savePackingItem, getTrip } from "./storage";
import { notifyVaultChange } from "./useTripVault";

export interface ItineraryGenerationParams {
  destination: string;
  durationDays: number;
  travelStyle: TravelStyle;
  intensity?: "RELAXED" | "MODERATE" | "CHALLENGING";
  interests?: string[];
}

/**
 * Curated Expedition Database for Offline Fallback & Template Routing
 */
const CURATED_EXPEDITIONS: Record<
  string,
  {
    title: string;
    budgetPerDay: number;
    days: AIPendingDay[];
    gear: string[];
    advisories: string[];
  }
> = {
  spiti: {
    title: "Spiti Valley High Altitude Circuit",
    budgetPerDay: 3200,
    gear: [
      "Diamox (Acetazolamide) for AMS",
      "Thermal base layers (Merino wool)",
      "Windproof & waterproof riding jacket",
      "High UV Polarized sunglasses (UV400)",
      "BSNL SIM card (only provider in Kaza)",
      "Cash buffer (ATMs frequently out of cash)",
      "Hydration bladder / 2L thermos flask",
      "Puncture repair kit & portable air inflator",
    ],
    advisories: [
      "Acclimatize at least 24 hours in Kalpa or Narkanda before ascending to Kaza (12,500 ft).",
      "Kunzum Pass (14,931 ft) is usually snow-blocked until late May or early June.",
      "Strict zero-litter policy around Sacred Chandra Taal Lake.",
      "Fuel is unavailable between Kaza and Tandi (over 200 km). Always refuel at Kaza.",
    ],
    days: [
      {
        dayNumber: 1,
        title: "Shimla to Narkanda & The Apple Valleys",
        highlights: ["Hindustan-Tibet Road (NH-05)", "Hatu Peak sunset", "Apple orchards of Narkanda"],
        suggestedStayArea: "Narkanda / Rampur",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "07:00", title: "Depart Shimla via NH-05 Hindustan-Tibet Highway" },
          { timeSlot: "AFTERNOON", startTime: "13:30", title: "Climb Hatu Peak (11,152 ft) for 360-degree Himalayan panorama" },
          { timeSlot: "EVENING", startTime: "18:00", title: "Warm bonfire dinner and acclimatization rest in pine forest" },
        ],
      },
      {
        dayNumber: 2,
        title: "Kinnaur Gateway: Rampur to Kalpa",
        highlights: ["Taranda Dhank cliff road", "Kinnaur Kailash sacred peak view", "Roghi cliff overhang"],
        suggestedStayArea: "Kalpa / Reckong Peo",
        intensity: "CHALLENGING",
        activities: [
          { timeSlot: "MORNING", startTime: "07:30", title: "Ride through Taranda Dhank rock-cut cliff road along Sutlej" },
          { timeSlot: "AFTERNOON", startTime: "14:00", title: "Ascend to Kalpa (9,711 ft); explore apple orchards" },
          { timeSlot: "EVENING", startTime: "18:30", title: "Witness sunset turning Kinnaur Kailash peak into molten crimson" },
        ],
      },
      {
        dayNumber: 3,
        title: "Into the Cold Desert: Kalpa to Tabo via Nako",
        highlights: ["Confluence of Spiti & Sutlej at Khab", "Nako Lake & 11th century Gompa", "Gue 500-year-old Mummy"],
        suggestedStayArea: "Tabo",
        intensity: "CHALLENGING",
        activities: [
          { timeSlot: "MORNING", startTime: "07:00", title: "Cross Khab bridge into cold desert terrain; climb Ka loops" },
          { timeSlot: "AFTERNOON", startTime: "12:30", title: "Lunch at Nako Lake; optional detour to Gue Mummy of Sangha Tenzin" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Check-in at Tabo mud homestay; attend evening monastery bells" },
        ],
      },
      {
        dayNumber: 4,
        title: "Dhankar Cliff Monastery & Mudh Pin Valley",
        highlights: ["Dhankar Gompa perched on cliff edge", "Pin Valley National Park", "Mudh village mud-brick architecture"],
        suggestedStayArea: "Mudh (Pin Valley) / Kaza",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "08:00", title: "Explore 1,000-year-old Tabo murals ('Ajanta of the Himalayas')" },
          { timeSlot: "AFTERNOON", startTime: "12:00", title: "Hike up to Dhankar Gompa and cliff viewpoint above Spiti-Pin confluence" },
          { timeSlot: "EVENING", startTime: "17:00", title: "Enter Pin Valley; overnight at Mudh village under crystal starry skies" },
        ],
      },
      {
        dayNumber: 5,
        title: "Kaza & World's Highest Villages Circuit",
        highlights: ["Hikkim highest post office (14,567 ft)", "Komic highest motorable village", "Langza Buddha statue & marine fossils"],
        suggestedStayArea: "Kaza",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "08:30", title: "Send handwritten postcards from Hikkim World's Highest Post Office" },
          { timeSlot: "AFTERNOON", startTime: "12:30", title: "Tea at Komic Tangyud Monastery (15,027 ft); fossil hunting in Langza" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Stroll Kaza local market, buy Sea Buckthorn tea and yak wool woollens" },
        ],
      },
      {
        dayNumber: 6,
        title: "Key Monastery & Wild Chicham Suspension Bridge",
        highlights: ["Key Gompa fort architecture", "Chicham Bridge (World's highest gorge suspension bridge 13,596 ft)", "Kibber wildlife sanctuary"],
        suggestedStayArea: "Kibber / Kaza / Losar",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "08:30", title: "Tour Key Monastery; drink herbal tea with senior resident monks" },
          { timeSlot: "AFTERNOON", startTime: "13:00", title: "Cross dizzying Chicham gorge bridge; scan cliffs for Himalayan Ibex" },
          { timeSlot: "EVENING", startTime: "18:00", title: "Rest at Losar base camp before crossing Kunzum Pass" },
        ],
      },
      {
        dayNumber: 7,
        title: "Kunzum La to Sacred Chandra Taal Lake",
        highlights: ["Kunzum Pass (14,931 ft) Stupa circumambulation", "Crescent-shaped Moon Lake (Chandra Taal)", "Alpine wilderness camping"],
        suggestedStayArea: "Chandra Taal Tents / Batal",
        intensity: "CHALLENGING",
        activities: [
          { timeSlot: "MORNING", startTime: "07:30", title: "Ascend Kunzum La pass; ring bells around Goddess Kunzum temple" },
          { timeSlot: "AFTERNOON", startTime: "13:00", title: "Descend rugged 14 km boulder trail to Chandra Taal campsite" },
          { timeSlot: "EVENING", startTime: "17:00", title: "Walk along turquoise lake shore; witness Milky Way galaxy unpolluted" },
        ],
      },
      {
        dayNumber: 8,
        title: "The Batal Watercrossings & Return via Atal Tunnel",
        highlights: ["Gramphu-Batal notorious dirt highway", "Chhatru dhaba lunch (Chacha-Chachi)", "Atal Tunnel emergence into Manali"],
        suggestedStayArea: "Manali",
        intensity: "CHALLENGING",
        activities: [
          { timeSlot: "MORNING", startTime: "06:30", title: "Cross Pagal Nullah water crossings early while glacial melt is lowest" },
          { timeSlot: "AFTERNOON", startTime: "13:30", title: "Warm dal-chawal at famous Chacha Chachi Dhaba in Batal" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Drive through Atal Tunnel into lush green Solang Valley and Manali" },
        ],
      },
    ],
  },
  ladakh: {
    title: "Leh-Ladakh Trans-Himalayan Odyssey",
    budgetPerDay: 4000,
    gear: [
      "Inner Line Permits (ILP) printouts (5 copies)",
      "High altitude oxygen can (portable)",
      "Merino wool neck buff & balaclava",
      "Postpaid BSNL or Airtel SIM card",
      "Lip balm with SPF 30 & high-altitude cold cream",
      "Gloves (inner fleece + outer windproof)",
    ],
    advisories: [
      "Mandatory 48-hour rest upon landing at Leh airport (11,500 ft) to prevent AMS.",
      "Khardung La (17,982 ft) and Chang La (17,688 ft) pass crossings require warm layers.",
      "Carry sufficient cash; ATMs beyond Leh are notoriously unreliable.",
    ],
    days: [
      {
        dayNumber: 1,
        title: "Arrive in Leh & Mandatory Acclimatization",
        highlights: ["Leh Palace view", "Shanti Stupa sunset", "Slow walking & hydration"],
        suggestedStayArea: "Leh Market / Changspa",
        intensity: "RELAXED",
        activities: [
          { timeSlot: "MORNING", startTime: "09:00", title: "Rest and rehydrate; strictly avoid physical exertion" },
          { timeSlot: "AFTERNOON", startTime: "14:00", title: "Gentle stroll in Leh Main Bazaar; drink hot ginger lemon honey tea" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Watch sunset from Shanti Stupa overlooking snowclad Stok Kangri" },
        ],
      },
      {
        dayNumber: 2,
        title: "Indus Valley Monasteries: Shey, Thiksey & Hemis",
        highlights: ["Thiksey Gompa Mini-Potala", "Maitreya Future Buddha statue", "Sindhu Ghat"],
        suggestedStayArea: "Leh",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "06:00", title: "Attend morning puja and conch chanting at Thiksey Monastery" },
          { timeSlot: "AFTERNOON", startTime: "13:00", title: "Visit ancient Hemis Monastery and museum hidden in mountain gorge" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Sunset reflection at Sindhu Ghat alongside the Holy Indus River" },
        ],
      },
      {
        dayNumber: 3,
        title: "Khardung La to Nubra Valley & Sand Dunes",
        highlights: ["Khardung La Pass (17,982 ft)", "Diskit Giant Maitreya Buddha", "Hunder double-humped Bactrian Camels"],
        suggestedStayArea: "Hunder / Diskit",
        intensity: "CHALLENGING",
        activities: [
          { timeSlot: "MORNING", startTime: "07:30", title: "Conquer Khardung La pass; stop for quick photos and prayer flags" },
          { timeSlot: "AFTERNOON", startTime: "14:00", title: "Visit 106-ft outdoor Maitreya Buddha overlooking Nubra Valley" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Walk along cold white desert sand dunes of Hunder" },
        ],
      },
      {
        dayNumber: 4,
        title: "Turtuk: Balti Culture at the Border",
        highlights: ["Last Indian village before LoC", "Balti heritage museum & apricot orchards", "K2 mountain peek on clear days"],
        suggestedStayArea: "Turtuk / Hunder",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "08:00", title: "Ride along Shyok River towards the Pakistan border" },
          { timeSlot: "AFTERNOON", startTime: "12:30", title: "Explore wooden Balti houses and ancient watermills in Turtuk Youl" },
          { timeSlot: "EVENING", startTime: "17:00", title: "Taste fresh apricot pancakes and walnut chutney" },
        ],
      },
      {
        dayNumber: 5,
        title: "Nubra to Pangong Tso via Shyok River",
        highlights: ["Shyok riverbed crossings", "Pangong Tso first glimpse at Lukung", "Changing lake colors from turquoise to navy"],
        suggestedStayArea: "Spangmik / Merak (Pangong Tso)",
        intensity: "CHALLENGING",
        activities: [
          { timeSlot: "MORNING", startTime: "07:00", title: "Navigate rugged Shyok valley road avoiding sudden afternoon flash waters" },
          { timeSlot: "AFTERNOON", startTime: "14:00", title: "Arrive at 14,270 ft Pangong Lake; admire 134-km long alpine waters" },
          { timeSlot: "EVENING", startTime: "18:00", title: "Stargazing beside freezing shoreline under brilliant cosmic skies" },
        ],
      },
      {
        dayNumber: 6,
        title: "Pangong Tso to Leh via Mighty Chang La",
        highlights: ["Sunrise over Pangong Lake", "Chang La Pass (17,688 ft)", "Himalayan Marmots in grasslands"],
        suggestedStayArea: "Leh",
        intensity: "CHALLENGING",
        activities: [
          { timeSlot: "MORNING", startTime: "06:30", title: "Golden hour photography along Pangong shore" },
          { timeSlot: "AFTERNOON", startTime: "12:30", title: "Cross steep icy switchbacks of Chang La pass; hot tea at Army post" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Return to Leh; celebratory dinner with traditional Ladakhi Thukpa" },
        ],
      },
    ],
  },
  meghalaya: {
    title: "Meghalaya Monsoon & Living Roots Expedition",
    budgetPerDay: 2800,
    gear: [
      "Heavy duty rain poncho / waterproof shell jacket",
      "Trail running shoes with aggressive mud grip",
      "Dry bags for electronics and passport/money",
      "Leech socks (essential for Nongriat trek)",
      "Quick-dry hiking pants",
    ],
    advisories: [
      "Trek down to Nongriat double-decker living root bridge requires 3,500 stone stairs each way.",
      "Carry cash; mobile network is spotty inside deep river valleys.",
      "Umngot river waters in Dawki are crystal clear from November to April.",
    ],
    days: [
      {
        dayNumber: 1,
        title: "Guwahati to Shillong via Umiam Lake",
        highlights: ["Umiam Lake viewpoint", "Police Bazar street food", "Laitlum Canyons sunset"],
        suggestedStayArea: "Shillong",
        intensity: "RELAXED",
        activities: [
          { timeSlot: "MORNING", startTime: "09:00", title: "Drive through pine-scented hills of Assam-Meghalaya border" },
          { timeSlot: "AFTERNOON", startTime: "14:00", title: "Stand atop Laitlum Grand Canyon edge looking down into sheer gorges" },
          { timeSlot: "EVENING", startTime: "18:30", title: "Evening walk through vibrant Police Bazar, try hot momos and jadoh" },
        ],
      },
      {
        dayNumber: 2,
        title: "Shillong to Cherrapunji (Sohra): The Waterfalls",
        highlights: ["Nohkalikai Falls (India's tallest plunge)", "Wei Sawdong three-tier waterfall", "Mawsmai Limestone Caves"],
        suggestedStayArea: "Cherrapunji",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "08:00", title: "Gaze at the mist-shrouded emerald pool of Nohkalikai plunge falls" },
          { timeSlot: "AFTERNOON", startTime: "13:00", title: "Scramble down root ladders to hidden Wei Sawdong turquoise pools" },
          { timeSlot: "EVENING", startTime: "17:00", title: "Explore lit limestone stalactite chambers of Mawsmai Cave" },
        ],
      },
      {
        dayNumber: 3,
        title: "Trek to Nongriat Double Decker Living Root Bridge",
        highlights: ["3,500 stone stairs descent", "Jingkieng Nongriat bio-engineered ficus roots", "Rainbow Falls natural rock pool"],
        suggestedStayArea: "Nongriat Village Homestay",
        intensity: "CHALLENGING",
        activities: [
          { timeSlot: "MORNING", startTime: "07:00", title: "Begin descent from Tyrna village crossing iron suspension bridges" },
          { timeSlot: "AFTERNOON", startTime: "12:00", title: "Marvel at the 250-year-old double decker living root bridge" },
          { timeSlot: "EVENING", startTime: "15:30", title: "Hike further to Rainbow Falls pool; swim in clear azure waters" },
        ],
      },
      {
        dayNumber: 4,
        title: "Dawki Glass Waters & Mawlynnong Cleanest Village",
        highlights: ["Umngot River transparent boating", "Bangladesh border crossing at Tamabil", "Mawlynnong bamboo skywalk"],
        suggestedStayArea: "Shnongpdeng / Dawki",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "08:30", title: "Climb out of Nongriat valley and drive towards Dawki" },
          { timeSlot: "AFTERNOON", startTime: "13:30", title: "Wooden canoe boat ride on crystal clear Umngot river" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Camp on Shnongpdeng river gravel beach under star constellations" },
        ],
      },
      {
        dayNumber: 5,
        title: "Krang Shuri Cascades & Jaintia Hills Return",
        highlights: ["Krang Shuri azure waterfall plunge pool", "Nartiang Monoliths", "Return to Guwahati"],
        suggestedStayArea: "Guwahati / Shillong",
        intensity: "MODERATE",
        activities: [
          { timeSlot: "MORNING", startTime: "08:00", title: "Cliff jumping and swimming with life jackets at Krang Shuri" },
          { timeSlot: "AFTERNOON", startTime: "13:00", title: "Visit Nartiang royal stone monolith garden" },
          { timeSlot: "EVENING", startTime: "17:30", title: "Conclude expedition; transfer to Guwahati airport or station" },
        ],
      },
    ],
  },
};

/**
 * Dynamically generates a rich expedition plan for ANY destination.
 */
function generateDynamicExpedition(params: ItineraryGenerationParams): AIPendingPlan {
  const { destination, durationDays, travelStyle, intensity = "MODERATE" } = params;
  const days: AIPendingDay[] = [];

  const adjectives = ["Expedition Arrival", "Exploration & Hidden Gems", "Ridge Trails & Scenic Passes", "Cultural Immersion", "Epic High Trails", "Local Delicacies & Heritage", "Grand Finale & Departure"];

  for (let i = 1; i <= durationDays; i++) {
    const adj = adjectives[(i - 1) % adjectives.length];
    days.push({
      dayNumber: i,
      title: `${destination}: Day ${i} - ${adj}`,
      highlights: [
        `Key scenic landmark of ${destination}`,
        `Local culinary specialty tasting`,
        `${travelStyle} route exploration`,
      ],
      suggestedStayArea: `${destination} Central / Scenic Outskirts`,
      intensity,
      activities: [
        {
          timeSlot: "MORNING",
          startTime: "08:00",
          title: `Morning expedition departure & exploration in ${destination}`,
          notes: "Stay hydrated and check local road/weather condition reports.",
        },
        {
          timeSlot: "AFTERNOON",
          startTime: "13:00",
          title: `Afternoon scenic discovery & local lunch in ${destination}`,
          notes: "Sample local regional street food and specialty dishes.",
        },
        {
          timeSlot: "EVENING",
          startTime: "18:00",
          title: `Sunset viewpoint, photography & evening recap`,
          notes: "Review vehicle odometer, gear check, and prepare for tomorrow.",
        },
      ],
    });
  }

  const gear = [
    "Identification Documents (Aadhaar / Passport & copies)",
    "First Aid kit & personal prescription medications",
    "High-capacity power bank (20,000 mAh)",
    "Appropriate footwear for " + travelStyle.toLowerCase(),
    "Weather-rated jacket & thermal layers",
    "Cash reserve for off-grid vendors",
  ];

  const advisories = [
    `Check local seasonal advisories for ${destination} prior to departure.`,
    "Keep offline maps and emergency contact numbers cached on your device.",
    "Support local vendors and practice zero-waste Leave No Trace ethics.",
  ];

  const estimatedBudget = durationDays * (travelStyle === "MOTORCYCLE" ? 3000 : travelStyle === "BACKPACKING" ? 1800 : 3500);

  return {
    destination,
    durationDays,
    travelStyle,
    budgetEstimate: estimatedBudget,
    generatedDays: days,
    suggestedGear: gear,
    localAdvisories: advisories,
    isOfflineFallback: true,
  };
}

/**
 * Main AI Itinerary Generator: Attempts online AI call; falls back to curated knowledge engine if offline.
 */
export async function generateExpeditionItinerary(
  params: ItineraryGenerationParams
): Promise<AIPendingPlan> {
  const { destination, durationDays, travelStyle } = params;
  const destLower = (destination || "").toLowerCase().trim();

  // Check if online AI endpoint is reachable
  try {
    const res = await fetch("/api/vault/ai/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.generatedDays && Array.isArray(data.generatedDays)) {
        return {
          ...data,
          isOfflineFallback: false,
        };
      }
    }
  } catch {
    // Graceful offline fallback - expected when mobile device has no active internet
  }

  // Check Curated Expeditions
  for (const [key, preset] of Object.entries(CURATED_EXPEDITIONS)) {
    if (destLower.includes(key)) {
      const slicedDays = preset.days.slice(0, durationDays);
      // If duration is longer than curated days, duplicate / stretch days
      if (durationDays > slicedDays.length) {
        for (let i = slicedDays.length + 1; i <= durationDays; i++) {
          slicedDays.push({
            dayNumber: i,
            title: `${destination}: Exploration & Leisure Day ${i}`,
            highlights: ["Scenic countryside trails", "Local cafe culture & photography"],
            suggestedStayArea: slicedDays[slicedDays.length - 1]?.suggestedStayArea || destination,
            intensity: "RELAXED",
            activities: [
              { timeSlot: "MORNING", startTime: "08:30", title: "Morning walk & photography" },
              { timeSlot: "AFTERNOON", startTime: "13:00", title: "Traditional local lunch & relaxation" },
              { timeSlot: "EVENING", startTime: "18:00", title: "Sunset reflection & campfire" },
            ],
          });
        }
      }

      return {
        destination,
        durationDays,
        travelStyle,
        budgetEstimate: durationDays * preset.budgetPerDay,
        generatedDays: slicedDays,
        suggestedGear: preset.gear,
        localAdvisories: preset.advisories,
        isOfflineFallback: true,
      };
    }
  }

  // Fallback to Dynamic Destination Generator
  return generateDynamicExpedition(params);
}

/**
 * 1-Click Accept & Import: Writes the generated AI itinerary into local IndexedDB
 */
export async function importPlanIntoVaultItinerary(
  tripId: ID,
  plan: AIPendingPlan,
  startDateIso?: string
): Promise<{ daysCreated: number; gearCreated: number }> {
  const trip = await getTrip(tripId);
  const baseDate = startDateIso || trip?.startDate || new Date().toISOString();

  let daysCreated = 0;
  let gearCreated = 0;

  // 1. Create Itinerary Days & Activities
  for (const day of plan.generatedDays) {
    const dayDate = new Date(new Date(baseDate).getTime() + (day.dayNumber - 1) * 24 * 60 * 60 * 1000).toISOString();
    const itinId = `itin_${tripId}_day_${day.dayNumber}`;

    const activities: ItineraryActivity[] = (day.activities || []).map((act, idx) => ({
      id: `act_${itinId}_${idx}`,
      timeSlot: act.timeSlot,
      startTime: act.startTime,
      title: act.title,
      notes: act.notes,
      status: "PLANNED",
    }));

    // If no activities were pre-defined, create defaults from highlights
    if (activities.length === 0 && day.highlights?.length > 0) {
      day.highlights.forEach((h, idx) => {
        activities.push({
          id: `act_${itinId}_${idx}`,
          timeSlot: idx === 0 ? "MORNING" : idx === 1 ? "AFTERNOON" : "EVENING",
          title: h,
          status: "PLANNED",
        });
      });
    }

    const dayRecord: ItineraryDayRecord = {
      id: itinId,
      tripId,
      dayIndex: day.dayNumber - 1,
      date: dayDate,
      title: day.title,
      description: day.highlights?.join(" • ") || undefined,
      intensity: day.intensity || "MODERATE",
      activities,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveItineraryDay(dayRecord);
    daysCreated++;
  }

  // 2. Import Suggested Gear into Packing Store
  if (plan.suggestedGear && plan.suggestedGear.length > 0) {
    for (const item of plan.suggestedGear) {
      const gearId = `pck_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();

      const packingRecord: PackingItemRecord = {
        id: gearId,
        tripId,
        category: "DOCUMENTS",
        name: item,
        quantity: 1,
        isEssential: true,
        isPacked: false,
        notes: "Suggested by Expedition AI Architect",
        createdAt: now,
        updatedAt: now,
      };

      await savePackingItem(packingRecord);
      gearCreated++;
    }
  }

  notifyVaultChange();
  return { daysCreated, gearCreated };
}
