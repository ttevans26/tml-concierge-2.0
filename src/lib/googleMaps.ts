// Centralized Google Maps configuration & utilities.
// Reads from VITE_GOOGLE_MAPS_API_KEY when available; falls back to the project key.
export const GOOGLE_MAPS_API_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  "AIzaSyBYwYMCsW5bFK0xZxPV2H1GxdnNcwXDWRU";

let scriptLoaded = false;
let scriptLoading = false;
const callbacks: (() => void)[] = [];

/** Loads the Google Maps JS API (with Places library) exactly once. */
export function loadGoogleMapsScript(): Promise<void> {
  const g = (window as any).google;
  if (scriptLoaded && g?.maps?.places) return Promise.resolve();
  return new Promise((resolve) => {
    if (scriptLoading) {
      callbacks.push(resolve);
      return;
    }
    if (g?.maps?.places) {
      scriptLoaded = true;
      resolve();
      return;
    }
    scriptLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = async () => {
      try {
        // With loading=async, google.maps.* is not ready at script.onload —
        // must await importLibrary for each library before resolving.
        const g = (window as any).google;
        await Promise.all([
          g.maps.importLibrary("maps"),
          g.maps.importLibrary("places"),
        ]);
      } catch (err) {
        console.error("Google Maps importLibrary failed", err);
      }
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      callbacks.forEach((cb) => cb());
      callbacks.length = 0;
    };
    script.onerror = () => {
      scriptLoading = false;
      console.error("Failed to load Google Maps JS API");
      resolve();
    };
    document.head.appendChild(script);
  });
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string | null;
}

/** Geocode a free-form address/query string via the Google Maps JS Geocoder. */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  if (!query?.trim()) return null;
  await loadGoogleMapsScript();
  const g = (window as any).google;
  if (!g?.maps) return null;
  const geocoder = new g.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address: query }, (results: any[] | null, status: string) => {
      if (status === "OK" && results && results.length > 0) {
        const r = results[0];
        const loc = r.geometry?.location;
        if (!loc) return resolve(null);
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          formattedAddress: r.formatted_address || query,
          placeId: r.place_id || null,
        });
      } else {
        resolve(null);
      }
    });
  });
}

import { supabase } from "@/integrations/supabase/client";

export interface HealResult {
  lat: number;
  lng: number;
  placeId: string | null;
  formattedAddress: string | null;
}

/**
 * Look up an item's coordinates via Google Places (with Geocoder fallback)
 * and persist the result to studio_items. Shared by manual Re-sync and the
 * automatic background heal pass on the Proximity Map.
 */
export async function healItemCoordinates(
  item: { id: string; title: string; address?: string | null; api_metadata?: any },
  folderLocation: string
): Promise<HealResult | null> {
  await loadGoogleMapsScript();
  const g = (window as any).google;
  if (!g?.maps?.places) return null;

  const query = `${item.title}${folderLocation ? ", " + folderLocation : ""}${item.address ? ", " + item.address : ""}`;

  // 1) FindPlaceFromQuery (richer metadata)
  const div = document.createElement("div");
  const service = new g.maps.places.PlacesService(div);
  const placeResult: any = await new Promise((resolve) => {
    service.findPlaceFromQuery(
      {
        query,
        fields: ["place_id", "name", "geometry", "formatted_address", "rating", "user_ratings_total", "photos", "website"],
      },
      (results: any[] | null, status: string) => {
        if (status === "OK" && results && results.length > 0) resolve(results[0]);
        else resolve(null);
      }
    );
  });

  let lat: number | null = null;
  let lng: number | null = null;
  let placeId: string | null = null;
  let formattedAddress: string | null = null;
  let meta = { ...(item.api_metadata || {}) };

  if (placeResult) {
    lat = placeResult.geometry?.location?.lat() ?? null;
    lng = placeResult.geometry?.location?.lng() ?? null;
    placeId = placeResult.place_id || null;
    formattedAddress = placeResult.formatted_address || null;
    const firstPhoto = placeResult.photos?.[0];
    const photoUrl = firstPhoto ? firstPhoto.getUrl({ maxWidth: 400, maxHeight: 300 }) : null;
    meta = {
      ...meta,
      rating: placeResult.rating ?? null,
      user_ratings_total: placeResult.user_ratings_total ?? null,
      photo_url: photoUrl,
    };
  } else {
    // 2) Geocoder fallback
    const geo = await geocodeAddress(item.address || query);
    if (!geo) return null;
    lat = geo.lat;
    lng = geo.lng;
    placeId = geo.placeId;
    formattedAddress = geo.formattedAddress;
  }

  if (lat == null || lng == null) return null;

  await supabase
    .from("studio_items")
    .update({
      google_place_id: placeId,
      lat,
      lng,
      address: formattedAddress || item.address || null,
      api_metadata: meta,
    } as any)
    .eq("id", item.id);

  return { lat, lng, placeId, formattedAddress };
}
