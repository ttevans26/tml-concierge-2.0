// Centralized Google Maps configuration & utilities.
// Prefers the Lovable-managed Google Maps connector key (referrer-restricted
// to *.lovable.app / *.lovableproject.com), then a user-supplied
// VITE_GOOGLE_MAPS_API_KEY, then a last-ditch hardcoded fallback.
const CONNECTOR_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
  | string
  | undefined;
const USER_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const FALLBACK_KEY = "AIzaSyBYwYMCsW5bFK0xZxPV2H1GxdnNcwXDWRU";

export type GoogleMapsKeySource = "connector" | "user-env" | "hardcoded-fallback";

export const GOOGLE_MAPS_KEY_SOURCE: GoogleMapsKeySource = CONNECTOR_KEY
  ? "connector"
  : USER_KEY
    ? "user-env"
    : "hardcoded-fallback";

export const GOOGLE_MAPS_API_KEY: string = CONNECTOR_KEY || USER_KEY || FALLBACK_KEY;

/** Live status of the Maps JS API load, surfaced to UI for self-diagnosis. */
export type GoogleMapsStatus =
  | "idle"
  | "loading"
  | "ready"
  | "referer-not-allowed"
  | "invalid-key"
  | "script-error"
  | "init-failed";

export interface GoogleMapsDiagnostics {
  keySource: GoogleMapsKeySource;
  keyMasked: string;
  channel: string | undefined;
  origin: string;
  status: GoogleMapsStatus;
  lastError: string | null;
}

let status: GoogleMapsStatus = "idle";
let lastError: string | null = null;
const listeners = new Set<(d: GoogleMapsDiagnostics) => void>();

function maskKey(k: string): string {
  if (!k) return "(none)";
  if (k.length <= 10) return k;
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

function setStatus(next: GoogleMapsStatus, err?: string) {
  status = next;
  if (err !== undefined) lastError = err;
  const snap = getGoogleMapsDiagnostics();
  listeners.forEach((cb) => cb(snap));
}

export function getGoogleMapsDiagnostics(): GoogleMapsDiagnostics {
  return {
    keySource: GOOGLE_MAPS_KEY_SOURCE,
    keyMasked: maskKey(GOOGLE_MAPS_API_KEY),
    channel: GOOGLE_MAPS_CHANNEL,
    origin: typeof window !== "undefined" ? window.location.origin : "",
    status,
    lastError,
  };
}

export function subscribeGoogleMapsDiagnostics(
  cb: (d: GoogleMapsDiagnostics) => void
): () => void {
  listeners.add(cb);
  cb(getGoogleMapsDiagnostics());
  return () => listeners.delete(cb);
}

// Google calls this global when the script loads but the key/referer is rejected.
if (typeof window !== "undefined") {
  (window as any).gm_authFailure = () => {
    setStatus(
      "referer-not-allowed",
      `Origin ${window.location.origin} is not in this key's HTTP-referrer allowlist (or the key is invalid).`
    );
  };
}

const GOOGLE_MAPS_CHANNEL: string | undefined = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let loadPromise: Promise<void> | null = null;

/** Loads the Google Maps JS API (with Places library) exactly once,
 *  using the documented async + callback pattern. */
export function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const g = (window as any).google;
  if (g?.maps?.Map && g?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const CALLBACK_NAME = "__tmlGmapsInit";
    setStatus("loading", null);

    const finish = async () => {
      try {
        const g = (window as any).google;
        if (g?.maps?.importLibrary) {
          await Promise.all([
            g.maps.importLibrary("maps"),
            g.maps.importLibrary("places"),
          ]);
        }
      } catch (err) {
        console.error("Google Maps importLibrary failed", err);
        setStatus("init-failed", (err as Error)?.message || String(err));
        resolve();
        return;
      }
      const g = (window as any).google;
      if (g?.maps?.Map) setStatus("ready", null);
      else if (status !== "referer-not-allowed")
        setStatus("init-failed", "google.maps.Map unavailable after load");
      resolve();
    };

    (window as any)[CALLBACK_NAME] = finish;

    // De-dupe: if another caller already injected the loader, just wait for it.
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-gmaps-loader]"
    );
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => {
          console.error("Failed to load Google Maps JS API");
          setStatus("script-error", "Script tag failed to load (network or CSP).");
          resolve();
        },
        { once: true }
      );
      return;
    }

    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      libraries: "places",
      loading: "async",
      callback: CALLBACK_NAME,
    });
    if (GOOGLE_MAPS_CHANNEL) params.set("channel", GOOGLE_MAPS_CHANNEL);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.gmapsLoader = "true";
    script.onerror = () => {
      console.error("Failed to load Google Maps JS API");
      setStatus("script-error", "Script tag failed to load (network or CSP).");
      loadPromise = null;
      resolve();
    };
    document.head.appendChild(script);
  });

  return loadPromise;
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
        fields: ["place_id", "name", "geometry", "formatted_address", "rating", "user_ratings_total", "photos"],
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
