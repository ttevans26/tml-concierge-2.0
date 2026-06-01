import type { ItineraryItem } from "@/stores/useTripStore";

export interface Waypoint {
  order: number;
  label: string;
  lat: number;
  lng: number;
  date: string | null;
}

/**
 * Build an ordered list of geographic waypoints for a trip's route map.
 * Prefers `stays` (one pin per unique location), falls back to logistics arrivals.
 * Dedupes by rounded lat/lng (~1km) and by normalized label.
 */
export function buildRouteFromItems(items: ItineraryItem[]): Waypoint[] {
  const sorted = [...items].sort((a, b) => {
    const ad = a.date ?? "";
    const bd = b.date ?? "";
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const stays = sorted.filter(
    (i) => i.category === "stays" && i.location_lat != null && i.location_lng != null,
  );

  const pool = stays.length >= 1
    ? stays
    : sorted.filter((i) => i.location_lat != null && i.location_lng != null);

  const seen = new Set<string>();
  const waypoints: Waypoint[] = [];

  for (const item of pool) {
    const lat = Number(item.location_lat);
    const lng = Number(item.location_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const labelKey = (item.location_name || item.title || "").trim().toLowerCase();
    const dedupeKey = labelKey || key;
    if (seen.has(key) || seen.has(dedupeKey)) continue;
    seen.add(key);
    seen.add(dedupeKey);

    waypoints.push({
      order: waypoints.length + 1,
      label: shortenLabel(item.location_name || item.title),
      lat,
      lng,
      date: item.date,
    });
  }

  return waypoints;
}

function shortenLabel(raw: string): string {
  if (!raw) return "";
  // Strip trailing country/region detail past the second comma.
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(", ");
  return `${parts[0]}, ${parts[1]}`;
}