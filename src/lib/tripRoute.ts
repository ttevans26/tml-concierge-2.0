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
  // Location-row matches (category === "location") — keyed off city names
  // so the Europe 2026 route resolves cleanly even without hotel titles.
  { match: "paris", label: "Paris", lat: 48.8566, lng: 2.3522, routeOrder: 1 },
  { match: "st remy", label: "St Rémy de Provence", lat: 43.7886, lng: 4.8314, routeOrder: 2 },
  { match: "st-remy", label: "St Rémy de Provence", lat: 43.7886, lng: 4.8314, routeOrder: 2 },
  { match: "saint remy", label: "St Rémy de Provence", lat: 43.7886, lng: 4.8314, routeOrder: 2 },
  { match: "st rémy", label: "St Rémy de Provence", lat: 43.7886, lng: 4.8314, routeOrder: 2 },
  { match: "antibes", label: "Antibes", lat: 43.5804, lng: 7.1251, routeOrder: 3 },
  { match: "ortisei", label: "Ortisei", lat: 46.5758, lng: 11.6725, routeOrder: 4 },
  { match: "salo", label: "Salò, Lake Garda", lat: 45.6069, lng: 10.5244, routeOrder: 5 },
  { match: "salò", label: "Salò, Lake Garda", lat: 45.6069, lng: 10.5244, routeOrder: 5 },
  { match: "lake garda", label: "Salò, Lake Garda", lat: 45.6069, lng: 10.5244, routeOrder: 5 },
  { match: "bath", label: "Bath", lat: 51.3811, lng: -2.359, routeOrder: 6 },
  { match: "sherborne", label: "Sherborne", lat: 50.9478, lng: -2.5176, routeOrder: 7 },
];

interface DestinationContext {
  countryCodes: string[]; // ISO 3166-1 alpha-2, lowercased for Google
  bounds: any | null;     // google.maps.LatLngBounds union of geocoded pieces
}

async function buildDestinationContext(destination: string | null): Promise<DestinationContext> {
  const ctx: DestinationContext = { countryCodes: [], bounds: null };
  if (!destination) return ctx;
  await loadGoogleMapsScript();
  const g = (window as any).google;
  if (!g?.maps?.Geocoder) return ctx;
  const geocoder = new g.maps.Geocoder();

  const pieces = destination
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  // Always also try the full string in case a piece alone is ambiguous.
  const queries = Array.from(new Set([destination, ...pieces]));

  const seenCountries = new Set<string>();
  for (const q of queries) {
    const res = await new Promise<any | null>((resolve) => {
      geocoder.geocode({ address: q }, (results: any[] | null, status: string) => {
        resolve(status === "OK" && results?.[0] ? results[0] : null);
      });
    });
    if (!res) continue;
    const comps = (res.address_components as any[] | undefined) || [];
    const country = comps.find((c) => c.types?.includes("country"));
    const shortName = typeof country?.short_name === "string" ? country.short_name : null;
    if (shortName && !seenCountries.has(shortName)) {
      seenCountries.add(shortName);
      ctx.countryCodes.push(shortName.toLowerCase());
    }
    const vp = res.geometry?.viewport;
    if (vp?.getNorthEast && vp?.getSouthWest) {
      const ne = vp.getNorthEast();
      const sw = vp.getSouthWest();
      // Skip overly broad viewports (multi-country centroid) from union.
      if (Math.abs(ne.lat() - sw.lat()) < 12 && Math.abs(ne.lng() - sw.lng()) < 12) {
        if (!ctx.bounds) ctx.bounds = new g.maps.LatLngBounds();
        ctx.bounds.union(vp);
      }
    }
  }
  return ctx;
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
    if (isLikelyNullIsland(lat, lng)) continue;

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
    .filter((i) => i.category === "stays" || i.category === "location")
    .sort((a, b) => {
      const ad = a.date ?? "";
      const bd = b.date ?? "";
      if (ad !== bd) return ad.localeCompare(bd);
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  // Prefer explicit `location` rows as the route backbone — their
  // location_name (e.g. "Antibes", "Bath") is a clean, geocodable city.
  // Stays often have a hotel title or no location_name at all.
  const unique: StayCandidate[] = [];
  const keySeen = new Set<string>();
  for (const i of sortedStays) {
    const title = (i.title || "").trim();
    const locationName = (i.location_name || "").trim() || null;
    // For `location` rows, the title IS the geographic label
    // (e.g. "Antibes, France"). Prefer it for matching/hints.
    const primaryLabel = i.category === "location"
      ? (locationName || title)
      : (locationName || title);
    const key = normalizeRouteText(primaryLabel);
    if (!key || keySeen.has(key)) continue;
    keySeen.add(key);
    const candLat = finiteNumber(i.location_lat);
    const candLng = finiteNumber(i.location_lng);
    const validStored =
      candLat != null && candLng != null && !isLikelyNullIsland(candLat, candLng);
    unique.push({
      title,
      locationName,
      date: i.date,
      lat: validStored ? candLat : null,
      lng: validStored ? candLng : null,
      sortOrder: i.sort_order ?? 0,
      hint: findRouteHint(primaryLabel),
    });
  }

  if (unique.length === 0) {
    if (directFallback.length >= 1) return directFallback;
    if (!destination) return [];
    const single = await geocodeOnce(destination);
    if (!single) return [];
    return [{ order: 1, label: shortenLabel(destination), lat: single.lat, lng: single.lng, date: null }];
  }

  const ctx = await buildDestinationContext(destination);

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
    // Prefer hints / stored coords; otherwise geocode within the destination
    // country/bounds context so "Airbnb Antibes" can't resolve to a town in
    // Africa or Australia.
    const hit =
      hinted ||
      stored ||
      (u.locationName ? await geocodeOnce(u.locationName, ctx) : null) ||
      (await geocodeOnce(u.title, ctx));
    if (!hit) continue;

    // If we have a destination bounds, reject coords that fall outside it.
    if (ctx.bounds && !ctx.bounds.contains({ lat: hit.lat, lng: hit.lng } as any)
        && typeof ctx.bounds.contains === "function") {
      // bounds.contains expects a LatLng — construct one.
      const g = (window as any).google;
      if (g?.maps?.LatLng && !ctx.bounds.contains(new g.maps.LatLng(hit.lat, hit.lng))) {
        continue;
      }
    }

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

  if (waypoints.length >= 1) return waypoints;
  // Filter the direct fallback against the destination bounds if we have one,
  // so a stray bad coord can't drag the map to Africa.
  if (ctx.bounds && directFallback.length) {
    const g = (window as any).google;
    if (g?.maps?.LatLng) {
      return directFallback.filter((w) =>
        ctx.bounds.contains(new g.maps.LatLng(w.lat, w.lng)),
      );
    }
  }
  return directFallback;
}

async function geocodeOnce(
  query: string,
  ctx?: DestinationContext,
): Promise<{ lat: number; lng: number; city: string | null } | null> {
  await loadGoogleMapsScript();
  const g = (window as any).google;
  if (!g?.maps?.Geocoder) return null;
  const geocoder = new g.maps.Geocoder();
  return new Promise((resolve) => {
    const req: any = { address: query };
    if (ctx?.bounds) req.bounds = ctx.bounds;
    if (ctx?.countryCodes?.length) {
      // Google supports a single country in componentRestrictions; pick the
      // first when multiple exist and rely on bounds + post-filter for the rest.
      req.componentRestrictions = { country: ctx.countryCodes };
    }
    geocoder.geocode(req, (results: any[] | null, status: string) => {
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
      // Reject results whose viewport is bigger than a city/county — a single
      // stay should not resolve to a country-sized centroid.
      const vp = r.geometry?.viewport;
      if (vp?.getNorthEast && vp?.getSouthWest) {
        const ne = vp.getNorthEast();
        const sw = vp.getSouthWest();
        if (Math.abs(ne.lat() - sw.lat()) > 8 || Math.abs(ne.lng() - sw.lng()) > 8) {
          resolve(null);
          return;
        }
      }
      // Country filter (defensive — componentRestrictions sometimes ignored).
      if (ctx?.countryCodes?.length) {
        const comps = (r.address_components as any[] | undefined) || [];
        const country = comps.find((c) => c.types?.includes("country"));
        const cc = country?.short_name?.toLowerCase();
        if (cc && !ctx.countryCodes.includes(cc)) {
          resolve(null);
          return;
        }
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

/** Detect coords pinned to (0,0) "Null Island" — a common bad-data sentinel. */
function isLikelyNullIsland(lat: number, lng: number): boolean {
  return Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001;
}

function findRouteHint(raw: string): RouteHint | null {
  const normalized = normalizeRouteText(raw);
  return ROUTE_HINTS.find((hint) => normalized.includes(normalizeRouteText(hint.match))) ?? null;
}
