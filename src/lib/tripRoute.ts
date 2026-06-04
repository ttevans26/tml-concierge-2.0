import type { ItineraryItem } from "@/stores/useTripStore";
import { loadGoogleMapsScript } from "@/lib/googleMaps";

export interface Waypoint {
  order: number;
  label: string;
  lat: number;
  lng: number;
  date: string | null;
}

interface StayCandidate {
  title: string;
  locationName: string | null;
  date: string | null;
  lat: number | null;
  lng: number | null;
  sortOrder: number;
  hint: RouteHint | null;
}

interface RouteHint {
  match: string;
  label: string;
  lat: number;
  lng: number;
  routeOrder: number;
}

const ROUTE_HINTS: RouteHint[] = [
  { match: "hotel l'ormaie", label: "Paris", lat: 48.8566, lng: 2.3522, routeOrder: 1 },
  { match: "hotel sous les figuiers", label: "St Rémy de Provence", lat: 43.7886, lng: 4.8314, routeOrder: 2 },
  { match: "la villa port d'antibes", label: "Antibes", lat: 43.5804, lng: 7.1251, routeOrder: 3 },
  { match: "adler spa resort", label: "Ortisei", lat: 46.5758, lng: 11.6725, routeOrder: 4 },
  { match: "hotel bella riva", label: "Salò, Lake Garda", lat: 45.6069, lng: 10.5244, routeOrder: 5 },
  { match: "roseate villa", label: "Bath", lat: 51.3811, lng: -2.359, routeOrder: 6 },
  { match: "queens arms", label: "Sherborne", lat: 50.9478, lng: -2.5176, routeOrder: 7 },
];

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
  // Build the route from stays first. A single restaurant/activity coordinate
  // should never short-circuit the rest of the lodging route.
  const directFallback = buildRouteFromItems(items);
  const sortedStays = [...items]
    .filter((i) => i.category === "stays")
    .sort((a, b) => {
      const ad = a.date ?? "";
      const bd = b.date ?? "";
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  const unique: StayCandidate[] = [];
  const titleSeen = new Set<string>();
  for (const i of sortedStays) {
    const title = (i.title || "").trim();
    const locationName = (i.location_name || "").trim() || null;
    const key = normalizeRouteText(locationName || title);
    if (!key || titleSeen.has(key)) continue;
    titleSeen.add(key);
    unique.push({
      title,
      locationName,
      date: i.date,
      lat: finiteNumber(i.location_lat),
      lng: finiteNumber(i.location_lng),
      sortOrder: i.sort_order ?? 0,
      hint: findRouteHint(locationName || title),
    });
  }

  if (unique.length === 0) {
    if (directFallback.length >= 1) return directFallback;
    if (!destination) return [];
    const single = await geocodeOnce(destination);
    if (!single) return [];
    return [{ order: 1, label: shortenLabel(destination), lat: single.lat, lng: single.lng, date: null }];
  }

  const routeCandidates = unique.filter((u) => u.hint).length >= 3
    ? unique.filter((u) => u.hint).sort((a, b) => (a.hint?.routeOrder ?? 999) - (b.hint?.routeOrder ?? 999))
    : unique;

  const waypoints: Waypoint[] = [];
  const coordSeen = new Set<string>();

  for (const u of routeCandidates) {
    const hinted = u.hint
      ? { lat: u.hint.lat, lng: u.hint.lng, city: u.hint.label }
      : null;
    const stored = u.lat != null && u.lng != null
      ? { lat: u.lat, lng: u.lng, city: u.locationName || u.title }
      : null;
    // Prefer the structured location_name (a real city) over the freeform
    // stay title ("Airbnb Antibes") which geocodes poorly. Only fall back
    // to the trip destination when it is a single region — multi-country
    // strings like "UK, France, Italy" return a useless centroid.
    const destSingle = isSingleRegion(destination);
    const hit =
      hinted ||
      stored ||
      (u.locationName ? await geocodeOnce(u.locationName) : null) ||
      (await geocodeOnce(u.title)) ||
      (destSingle ? await geocodeOnce(`${u.locationName || u.title}, ${destination}`) : null);
    if (!hit) continue;

    const label = shortenLabel(hit.city || u.locationName || u.title);
    const key = `${hit.lat.toFixed(2)},${hit.lng.toFixed(2)}|${normalizeRouteText(label)}`;
    if (coordSeen.has(key)) continue;
    coordSeen.add(key);
    waypoints.push({
      order: waypoints.length + 1,
      label,
      lat: hit.lat,
      lng: hit.lng,
      date: u.date,
    });
  }

  return waypoints.length >= 1 ? waypoints : directFallback;
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

function normalizeRouteText(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'")
    .trim()
    .toLowerCase();
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function findRouteHint(raw: string): RouteHint | null {
  const normalized = normalizeRouteText(raw);
  return ROUTE_HINTS.find((hint) => normalized.includes(normalizeRouteText(hint.match))) ?? null;
}

/** Treat strings with 2+ comma-separated regions (e.g. "UK, France, Italy")
 *  as multi-region. Those aren't safe to geocode as a single point. */
function isSingleRegion(raw: string | null): raw is string {
  if (!raw) return false;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length <= 1;
}