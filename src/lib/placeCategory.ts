import type { StudioCategory } from "@/stores/useStudioStore";

/**
 * Classify a Google Place into one of our four Studio categories
 * based on its `types` array. First match wins.
 */
export function classifyPlace(types: string[] | null | undefined): StudioCategory {
  if (!types || types.length === 0) return "activity";
  const set = new Set(types.map((t) => t.toLowerCase()));

  // Stays
  if (
    set.has("lodging") ||
    set.has("hotel") ||
    set.has("resort") ||
    set.has("resort_hotel") ||
    set.has("bed_and_breakfast") ||
    set.has("extended_stay_hotel") ||
    set.has("inn") ||
    set.has("motel") ||
    set.has("guest_house") ||
    set.has("hostel") ||
    set.has("campground") ||
    set.has("rv_park")
  ) {
    return "stays";
  }

  // Dining
  if (
    set.has("restaurant") ||
    set.has("cafe") ||
    set.has("coffee_shop") ||
    set.has("bar") ||
    set.has("bakery") ||
    set.has("food") ||
    set.has("meal_takeaway") ||
    set.has("meal_delivery") ||
    set.has("pub") ||
    set.has("wine_bar") ||
    set.has("ice_cream_shop")
  ) {
    return "dining";
  }

  // Sites of Interest (landmarks, cultural, natural)
  if (
    set.has("tourist_attraction") ||
    set.has("museum") ||
    set.has("art_gallery") ||
    set.has("landmark") ||
    set.has("historical_landmark") ||
    set.has("historical_place") ||
    set.has("monument") ||
    set.has("church") ||
    set.has("place_of_worship") ||
    set.has("hindu_temple") ||
    set.has("mosque") ||
    set.has("synagogue") ||
    set.has("park") ||
    set.has("national_park") ||
    set.has("state_park") ||
    set.has("garden") ||
    set.has("point_of_interest")
  ) {
    return "sites";
  }

  // Default — spas, shops, gyms, tours, etc.
  return "activity";
}

export const CATEGORY_LABEL: Record<StudioCategory, string> = {
  stays: "Stays",
  dining: "Dining",
  activity: "Activities",
  sites: "Sites of Interest",
};