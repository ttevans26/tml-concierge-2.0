import { useState, useEffect, useRef, useCallback } from "react";

const GOOGLE_MAPS_API_KEY = "AIzaSyAz8jCkGRyZuOQLPOA5QpAAJPvhBK0e4iU";

export interface PlaceResult {
  name: string;
  address: string;
  placeId: string;
  website: string | null;
  phone: string | null;
  rating: number | null;
  hours: string[] | null;
  lat: number | null;
  lng: number | null;
}

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMapsScript(): Promise<void> {
  if (scriptLoaded && window.google?.maps?.places) return Promise.resolve();
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
      resolve(); // fail silently
    };
    document.head.appendChild(script);
  });
}

export function useGooglePlaces(
  inputRef: React.RefObject<HTMLInputElement | null>,
  options?: { types?: string[]; enabled?: boolean }
) {
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    loadGoogleMapsScript().then(() => {
      if (window.google?.maps?.places) {
        serviceRef.current = new google.maps.places.AutocompleteService();
        // PlacesService needs a div or map
        const div = document.createElement("div");
        placesServiceRef.current = new google.maps.places.PlacesService(div);
      }
    });
  }, [enabled]);

  const search = useCallback(
    (query: string) => {
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
        (results, status) => {
          setLoading(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
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
        placesServiceRef.current!.getDetails(
          {
            placeId,
            fields: [
              "name",
              "formatted_address",
              "place_id",
              "website",
              "formatted_phone_number",
              "rating",
              "opening_hours",
              "geometry",
            ],
          },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              resolve({
                name: place.name || "",
                address: place.formatted_address || "",
                placeId: place.place_id || placeId,
                website: place.website || null,
                phone: place.formatted_phone_number || null,
                rating: place.rating ?? null,
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
