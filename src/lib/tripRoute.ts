import type { ItineraryItem } from "@/stores/useTripStore";
import { loadGoogleMapsScript } from "@/lib/googleMaps";

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

/**
 * For trips with no coordinates stored, derive an ordered list of unique
 * stay names and geocode them client-side via Google Geocoder.
 * Falls back to the trip destination if no stays exist.
 */
export async function buildRouteWithGeocoding(
  items: ItineraryItem[],
  destination: string | null,
): Promise<Waypoint[]> {
  // First, try the coord-based path.
  const direct = buildRouteFromItems(items);
  if (direct.length >= 1) return direct;

  // Otherwise, geocode unique stay titles in chronological order.
  const sorted = [...items]
    .filter((i) => i.category === "stays")
    .sort((a, b) => {
      const ad = a.date ?? "";
      const bd = b.date ?? "";
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  const unique: { title: string; date: string | null }[] = [];
  const titleSeen = new Set<string>();
  for (const i of sorted) {
    const key = (i.title || "").trim().toLowerCase();
    if (!key || titleSeen.has(key)) continue;
    titleSeen.add(key);
    unique.push({ title: i.title, date: i.date });
  }

  if (unique.length === 0) {
    if (!destination) return [];
    const single = await geocodeOnce(destination);
    if (!single) return [];
    return [{ order: 1, label: shortenLabel(destination), lat: single.lat, lng: single.lng, date: null }];
  }

  await loadGoogleMapsScript();
  const g = (window as any).google;
  if (!g?.maps?.Geocoder) return [];

  const waypoints: Waypoint[] = [];
  const coordSeen = new Set<string>();

  for (const u of unique) {
    const query = destination ? `${u.title}, ${destination}` : u.title;
    const hit =
      (await geocodeOnce(query)) ||
      (await geocodeOnce(u.title));
    if (!hit) continue;
    const key = `${hit.lat.toFixed(2)},${hit.lng.toFixed(2)}`;
    if (coordSeen.has(key)) continue;
    coordSeen.add(key);
    waypoints.push({
      order: waypoints.length + 1,
      label: shortenLabel(hit.city || u.title),
      lat: hit.lat,
      lng: hit.lng,
      date: u.date,
    });
  }

  return waypoints;
}

async function geocodeOnce(
  query: string,
): Promise<{ lat: number; lng: number; city: string | null } | null> {
  await loadGoogleMapsScript();
  const g = (window as any).google;
  if (!g?.maps?.Geocoder) return null;
  const geocoder = new g.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address: query }, (results: any[] | null, status: string) => {
      if (status !== "OK" || !results || !results[0]) {
        resolve(null);
        return;
      }
      const r = results[0];
      const loc = r.geometry?.location;
      if (!loc) {
        resolve(null);
        return;
      }
      // Extract the locality/town component to use as the marker label.
      const comp = (r.address_components as any[] | undefined) || [];
      const localityType = ["locality", "postal_town", "administrative_area_level_2", "administrative_area_level_1"];
      let city: string | null = null;
      for (const t of localityType) {
        const m = comp.find((c) => c.types?.includes(t));
        if (m) { city = m.long_name; break; }
      }
      resolve({ lat: loc.lat(), lng: loc.lng(), city });
    });
  });
}

function shortenLabel(raw: string): string {
  if (!raw) return "";
  // Strip trailing country/region detail past the second comma.
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(", ");
  return `${parts[0]}, ${parts[1]}`;
}