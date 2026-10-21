"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FoodPlannerRecord,
  FoodType,
  MealSlot,
  DietaryTag,
  ID,
} from "./types";
import {
  getFoodItemsForTrip,
  saveFoodItem,
  deleteFoodItem,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export interface FoodStats {
  totalCount: number;
  specialtiesCount: number;
  specialtiesTried: number;
  restaurantsCount: number;
  restaurantsVisited: number;
  triedPercentage: number;
  avgRating: number;
  ratedCount: number;
}

export interface RegionalPreset {
  name: string;
  type: FoodType;
  cuisine: string;
  mealSlot: MealSlot;
  priceLevel: 1 | 2 | 3 | 4;
  dietaryTags: DietaryTag[];
  mustOrderDish?: string;
  reviewNotes?: string;
}

// Curated authentic regional specialty database
export const REGIONAL_PRESETS_BY_KEYWORD: Record<string, RegionalPreset[]> = {
  ladakh: [
    {
      name: "Traditional Ladakhi Thukpa",
      type: "SPECIALTY_DISH",
      cuisine: "Ladakhi / Tibetan",
      mealSlot: "DINNER",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Vegetable Thukpa with homemade hand-pulled noodles",
      reviewNotes: "Hearty warming soup broth essential for high altitude acclimatization.",
    },
    {
      name: "Gur Gur Chai (Salted Butter Tea)",
      type: "SPECIALTY_DISH",
      cuisine: "Ladakhi",
      mealSlot: "CAFE_CHAI",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Yak butter tea with roasted barley tsampa",
      reviewNotes: "Rich, salty, and comforting brew for chilly mornings in Leh.",
    },
    {
      name: "Steamed Tingmo & Shamu",
      type: "SPECIALTY_DISH",
      cuisine: "Tibetan",
      mealSlot: "LUNCH",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Soft flower-shaped steamed buns with mushroom gravy",
      reviewNotes: "Fluffy steamed bread ideal for soaking up local vegetable curry.",
    },
    {
      name: "Steamed Momos with Spicy Garlic Chutney",
      type: "SPECIALTY_DISH",
      cuisine: "Tibetan",
      mealSlot: "SNACK",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Cheese & spinach or spiced minced dumplings",
      reviewNotes: "Crispy or steamed momos paired with fiery local red chili paste.",
    },
    {
      name: "Ladakhi Skyu",
      type: "SPECIALTY_DISH",
      cuisine: "Ladakhi",
      mealSlot: "DINNER",
      priceLevel: 2,
      dietaryTags: ["VEG"],
      mustOrderDish: "Traditional thumb-pressed dough pasta stew with root vegetables",
      reviewNotes: "Old-school Ladakhi winter comfort food slow-cooked over wood stove.",
    },
  ],
  himachal: [
    {
      name: "Authentic Pahadi Siddu with Desi Ghee",
      type: "SPECIALTY_DISH",
      cuisine: "Himachali",
      mealSlot: "BREAKFAST",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Steamed Siddu stuffed with spiced walnut & poppy seed paste",
      reviewNotes: "Signature mountain bread dipped generously in molten desi ghee.",
    },
    {
      name: "Fresh Himalayan Rainbow Trout",
      type: "SPECIALTY_DISH",
      cuisine: "Himachali",
      mealSlot: "DINNER",
      priceLevel: 3,
      dietaryTags: ["NON_VEG"],
      mustOrderDish: "Pan-fried trout with lemon butter garlic herbs",
      reviewNotes: "Freshly caught from the Beas or Tirthan river.",
    },
    {
      name: "Himachali Dham Thali",
      type: "SPECIALTY_DISH",
      cuisine: "Himachali",
      mealSlot: "LUNCH",
      priceLevel: 2,
      dietaryTags: ["VEG"],
      mustOrderDish: "Chana Madra, Sepu Badi, Khatta, and Meetha Bhaat",
      reviewNotes: "Traditional festive celebratory feast served without onions or garlic.",
    },
    {
      name: "Bhagsu Cake & Mountain Roast",
      type: "SPECIALTY_DISH",
      cuisine: "Tibetan / Israeli Fusion",
      mealSlot: "CAFE_CHAI",
      priceLevel: 2,
      dietaryTags: ["VEG"],
      mustOrderDish: "Layered biscuit crunch with melted caramel & dark chocolate",
      reviewNotes: "Iconic sweet treat born in Bhagsu / McLeodganj cafes.",
    },
  ],
  rajasthan: [
    {
      name: "Royal Dal Baati Churma",
      type: "SPECIALTY_DISH",
      cuisine: "Rajasthani",
      mealSlot: "LUNCH",
      priceLevel: 2,
      dietaryTags: ["VEG"],
      mustOrderDish: "Ghee-drenched baati with spicy panchmel dal & sweet churma",
      reviewNotes: "The undisputed culinary jewel of Rajasthan.",
    },
    {
      name: "Mathania Laal Maas",
      type: "SPECIALTY_DISH",
      cuisine: "Rajasthani",
      mealSlot: "DINNER",
      priceLevel: 3,
      dietaryTags: ["NON_VEG"],
      mustOrderDish: "Slow-cooked mutton with smoked Mathania red chilies & garlic",
      reviewNotes: "Rich, fiery warrior curry with bold red hue and smoky aroma.",
    },
    {
      name: "Ker Sangri Desert Sabzi with Bajra Roti",
      type: "SPECIALTY_DISH",
      cuisine: "Rajasthani",
      mealSlot: "DINNER",
      priceLevel: 2,
      dietaryTags: ["VEG"],
      mustOrderDish: "Wild desert berries & beans cooked with amchur & spices",
      reviewNotes: "Unique indigenous Thar desert specialty preserved through traditions.",
    },
    {
      name: "Crispy Pyaaz Kachori with Sweet Tamarind",
      type: "SPECIALTY_DISH",
      cuisine: "Rajasthani Street",
      mealSlot: "BREAKFAST",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Flaky golden fried kachori with spiced onion filling",
      reviewNotes: "Crispy breakfast staple paired with kulhad masala chai.",
    },
    {
      name: "Honeycomb Saffron Ghevar",
      type: "SPECIALTY_DISH",
      cuisine: "Rajasthani Sweet",
      mealSlot: "SNACK",
      priceLevel: 2,
      dietaryTags: ["VEG"],
      mustOrderDish: "Crisp disc topped with rabdi, pistachios & silver vark",
      reviewNotes: "Decadent disc-shaped sweet steeped in saffron sugar syrup.",
    },
  ],
  kerala: [
    {
      name: "Lacy Appam with Creamy Vegetable Stew",
      type: "SPECIALTY_DISH",
      cuisine: "Kerala",
      mealSlot: "BREAKFAST",
      priceLevel: 1,
      dietaryTags: ["VEGAN"],
      mustOrderDish: "Fermented rice pancake with spiced coconut milk stew",
      reviewNotes: "Soft spongy center with paper-thin crisp edges.",
    },
    {
      name: "Banana Leaf Karimeen Pollichathu",
      type: "SPECIALTY_DISH",
      cuisine: "Kerala",
      mealSlot: "DINNER",
      priceLevel: 3,
      dietaryTags: ["NON_VEG"],
      mustOrderDish: "Pearl spot fish baked in spicy shallot & kokum masala inside banana leaf",
      reviewNotes: "Smoky, tangy backwater delicacy bursting with local spices.",
    },
    {
      name: "Malabar Parotta with Roast",
      type: "SPECIALTY_DISH",
      cuisine: "Malabar",
      mealSlot: "DINNER",
      priceLevel: 2,
      dietaryTags: ["NON_VEG"],
      mustOrderDish: "Flaky layered parotta with peppery roast gravy",
      reviewNotes: "Buttery, flaky bread paired with dark caramelized curry.",
    },
    {
      name: "Traditional South Indian Filter Coffee",
      type: "SPECIALTY_DISH",
      cuisine: "South Indian",
      mealSlot: "CAFE_CHAI",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Strong chicory-infused decoction with frothy boiled milk in dabarah",
      reviewNotes: "Aromatic pick-me-up served in brass tumbler and davarah.",
    },
  ],
  general: [
    {
      name: "Highway Kulhad Masala Chai & Bun Maska",
      type: "SPECIALTY_DISH",
      cuisine: "Street Food",
      mealSlot: "BREAKFAST",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Crushed ginger-cardamom chai served in clay kulhad",
      reviewNotes: "The quintessential roadtrip fuel at highway dhabas.",
    },
    {
      name: "Woodfired Artisan Pizza & Local Brew",
      type: "RESTAURANT",
      cuisine: "Cafe & Continental",
      mealSlot: "DINNER",
      priceLevel: 3,
      dietaryTags: ["VEG"],
      mustOrderDish: "Quattro formaggi pizza with garlic dip",
      reviewNotes: "Cozy mountain cafe ambiance after a long day on the road.",
    },
    {
      name: "Crispy Samosa Chaat",
      type: "SPECIALTY_DISH",
      cuisine: "Street Food",
      mealSlot: "SNACK",
      priceLevel: 1,
      dietaryTags: ["VEG"],
      mustOrderDish: "Crushed potato samosas with chickpea curry, curd & chutneys",
      reviewNotes: "Sweet, tangy, and spicy explosion of street flavors.",
    },
  ],
};

export function useFoodPlanner(tripId: string) {
  const [foodItems, setFoodItems] = useState<FoodPlannerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadFoodItems = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getFoodItemsForTrip(tripId);
      // Sort: To Try first, then visited, then newest
      data.sort((a, b) => {
        if (a.status === "TO_TRY" && b.status !== "TO_TRY") return -1;
        if (a.status !== "TO_TRY" && b.status === "TO_TRY") return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setFoodItems(data);
    } catch (err) {
      console.error("Failed loading food items from vault:", err);
      setError("Unable to load culinary roadmap items.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getFoodItemsForTrip(tripId);
        if (mounted) {
          data.sort((a, b) => {
            if (a.status === "TO_TRY" && b.status !== "TO_TRY") return -1;
            if (a.status !== "TO_TRY" && b.status === "TO_TRY") return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setFoodItems(data);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial food items load:", err);
          setError("Failed to load food items.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    const handleVaultChange = () => {
      loadFoodItems();
    };

    window.addEventListener("vault-storage-change", handleVaultChange);
    return () => {
      mounted = false;
      window.removeEventListener("vault-storage-change", handleVaultChange);
    };
  }, [tripId, loadFoodItems]);

  // Derived collections
  const specialties = useMemo(
    () => foodItems.filter((i) => i.type === "SPECIALTY_DISH"),
    [foodItems]
  );

  const restaurants = useMemo(
    () => foodItems.filter((i) => i.type === "RESTAURANT"),
    [foodItems]
  );

  // Computed summary metrics
  const stats: FoodStats = useMemo(() => {
    const totalCount = foodItems.length;
    const specialtiesCount = specialties.length;
    const specialtiesTried = specialties.filter((i) => i.status === "VISITED").length;
    const restaurantsCount = restaurants.length;
    const restaurantsVisited = restaurants.filter((i) => i.status === "VISITED").length;

    const visitedCount = specialtiesTried + restaurantsVisited;
    const triedPercentage = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

    const ratedItems = foodItems.filter((i) => typeof i.rating === "number" && i.rating > 0);
    const avgRating =
      ratedItems.length > 0
        ? Number(
            (ratedItems.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedItems.length).toFixed(1)
          )
        : 0;

    return {
      totalCount,
      specialtiesCount,
      specialtiesTried,
      restaurantsCount,
      restaurantsVisited,
      triedPercentage,
      avgRating,
      ratedCount: ratedItems.length,
    };
  }, [foodItems, specialties, restaurants]);

  // Actions
  const addItem = useCallback(
    async (
      item: Omit<FoodPlannerRecord, "id" | "tripId" | "createdAt" | "updatedAt">
    ): Promise<FoodPlannerRecord> => {
      const record: FoodPlannerRecord = {
        ...item,
        id: `food-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tripId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveFoodItem(record);
      notifyVaultChange();
      await loadFoodItems();
      return saved;
    },
    [tripId, loadFoodItems]
  );

  const updateItem = useCallback(
    async (item: FoodPlannerRecord): Promise<FoodPlannerRecord> => {
      const updated: FoodPlannerRecord = {
        ...item,
        updatedAt: new Date().toISOString(),
      };
      const saved = await saveFoodItem(updated);
      notifyVaultChange();
      await loadFoodItems();
      return saved;
    },
    [loadFoodItems]
  );

  const toggleStatus = useCallback(
    async (id: ID, newStatus?: "TO_TRY" | "VISITED" | "SKIPPED") => {
      const current = foodItems.find((i) => i.id === id);
      if (!current) return;

      let nextStatus = newStatus;
      if (!nextStatus) {
        // Toggle cycle: TO_TRY -> VISITED -> SKIPPED -> TO_TRY
        if (current.status === "TO_TRY") nextStatus = "VISITED";
        else if (current.status === "VISITED") nextStatus = "SKIPPED";
        else nextStatus = "TO_TRY";
      }

      await updateItem({
        ...current,
        status: nextStatus,
      });
    },
    [foodItems, updateItem]
  );

  const rateItem = useCallback(
    async (id: ID, rating: number, notes?: string) => {
      const current = foodItems.find((i) => i.id === id);
      if (!current) return;

      await updateItem({
        ...current,
        rating,
        status: current.status === "TO_TRY" ? "VISITED" : current.status,
        reviewNotes: notes !== undefined ? notes : current.reviewNotes,
      });
    },
    [foodItems, updateItem]
  );

  const removeItem = useCallback(
    async (id: ID) => {
      await deleteFoodItem(id);
      notifyVaultChange();
      await loadFoodItems();
    },
    [loadFoodItems]
  );

  // Seed regional suggestions based on destination match or general
  const seedRegionalPresets = useCallback(
    async (destinationHint?: string): Promise<number> => {
      const destLower = (destinationHint || "").toLowerCase();
      let presetsToSeed = REGIONAL_PRESETS_BY_KEYWORD.general;

      if (destLower.includes("ladakh") || destLower.includes("leh") || destLower.includes("spiti")) {
        presetsToSeed = REGIONAL_PRESETS_BY_KEYWORD.ladakh;
      } else if (
        destLower.includes("manali") ||
        destLower.includes("himachal") ||
        destLower.includes("kasol") ||
        destLower.includes("dharamshala") ||
        destLower.includes("shimla")
      ) {
        presetsToSeed = REGIONAL_PRESETS_BY_KEYWORD.himachal;
      } else if (
        destLower.includes("rajasthan") ||
        destLower.includes("jaipur") ||
        destLower.includes("udaipur") ||
        destLower.includes("jodhpur") ||
        destLower.includes("jaisalmer")
      ) {
        presetsToSeed = REGIONAL_PRESETS_BY_KEYWORD.rajasthan;
      } else if (
        destLower.includes("kerala") ||
        destLower.includes("kochi") ||
        destLower.includes("munnar") ||
        destLower.includes("alleppey")
      ) {
        presetsToSeed = REGIONAL_PRESETS_BY_KEYWORD.kerala;
      }

      let count = 0;
      for (const preset of presetsToSeed) {
        // Prevent duplicate names
        const exists = foodItems.some(
          (f) => f.name.toLowerCase() === preset.name.toLowerCase()
        );
        if (!exists) {
          await saveFoodItem({
            id: `food-preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            tripId,
            name: preset.name,
            type: preset.type,
            cuisine: preset.cuisine,
            mealSlot: preset.mealSlot,
            priceLevel: preset.priceLevel,
            dietaryTags: preset.dietaryTags,
            mustOrderDish: preset.mustOrderDish,
            reviewNotes: preset.reviewNotes,
            status: "TO_TRY",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          count++;
        }
      }

      if (count > 0) {
        notifyVaultChange();
        await loadFoodItems();
      }

      return count;
    },
    [tripId, foodItems, loadFoodItems]
  );

  return {
    foodItems,
    specialties,
    restaurants,
    stats,
    isLoading,
    error,
    addItem,
    updateItem,
    toggleStatus,
    rateItem,
    removeItem,
    seedRegionalPresets,
    refresh: loadFoodItems,
  };
}
