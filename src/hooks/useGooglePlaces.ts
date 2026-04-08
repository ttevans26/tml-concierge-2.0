import { useState, useEffect, useRef, useCallback } from "react";

const GOOGLE_MAPS_API_KEY = "AIzaSyAz8jCkGRyZuOQLPOA5QpAAJPvhBK0e4iU";

export interface PlaceResult {
  name: string;
  address: string;
  placeId: string;
  website: string | null;
  phone: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  hours: string[] | null;
  lat: number | null;
  lng: number | null;
}

export interface PlacePrediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMapsScript(): Promise<void> {
  if (scriptLoaded && (window as any).google?.maps?.places) return Promise.resolve();
  return new Promise((resolve) => {
    if (scriptLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    scriptLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      scriptLoading = false;
      resolve();
    };
    document.head.appendChild(script);
  });
}

function getGoogle(): any {
  return (window as any).google;
}

export function useGooglePlaces(
  options?: { types?: string[]; enabled?: boolean }
) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const serviceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    loadGoogleMapsScript().then(() => {
      const g = getGoogle();
      if (g?.maps?.places) {
        serviceRef.current = new g.maps.places.AutocompleteService();
        const div = document.createElement("div");
        placesServiceRef.current = new g.maps.places.PlacesService(div);
      }
    });
  }, [enabled]);

  const search = useCallback(
    (query: string) => {
      console.log("DEBUG: Google Places Search Triggered", query, "service ready:", !!serviceRef.current);
      if (!query.trim() || !serviceRef.current) {
        setPredictions([]);
        return;
      }
      setLoading(true);
      serviceRef.current.getPlacePredictions(
        {
          input: query,
          types: options?.types || ["establishment"],
        },
        (results: any[] | null, status: string) => {
          console.log("DEBUG: Google Places response", status, results?.length ?? 0, "results");
          setLoading(false);
          if (status === "OK" && results) {
            setPredictions(results);
          } else {
            setPredictions([]);
          }
        }
      );
    },
    [options?.types]
  );

  const getDetails = useCallback(
    (placeId: string): Promise<PlaceResult | null> => {
      if (!placesServiceRef.current) return Promise.resolve(null);
      return new Promise((resolve) => {
        placesServiceRef.current.getDetails(
          {
            placeId,
            fields: [
              "name",
              "formatted_address",
              "place_id",
              "website",
              "formatted_phone_number",
              "rating",
              "user_ratings_total",
              "opening_hours",
              "geometry",
            ],
          },
          (place: any, status: string) => {
            if (status === "OK" && place) {
              resolve({
                name: place.name || "",
                address: place.formatted_address || "",
                placeId: place.place_id || placeId,
                website: place.website || null,
                phone: place.formatted_phone_number || null,
                rating: place.rating ?? null,
                userRatingsTotal: place.user_ratings_total ?? null,
                hours: place.opening_hours?.weekday_text || null,
                lat: place.geometry?.location?.lat() ?? null,
                lng: place.geometry?.location?.lng() ?? null,
              });
            } else {
              resolve(null);
            }
          }
        );
      });
    },
    []
  );

  return { predictions, search, getDetails, loading };
}
