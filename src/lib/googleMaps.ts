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
    script.onload = () => {
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
