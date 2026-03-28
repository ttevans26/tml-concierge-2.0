/// <reference types="vite/client" />

interface Window {
  google?: typeof google;
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(el: HTMLElement, opts?: any);
    }
    namespace places {
      class AutocompleteService {
        getPlacePredictions(
          request: { input: string; types?: string[] },
          callback: (
            results: AutocompletePrediction[] | null,
            status: PlacesServiceStatus
          ) => void
        ): void;
      }
      class PlacesService {
        constructor(attrContainer: HTMLDivElement | google.maps.Map);
        getDetails(
          request: { placeId: string; fields?: string[] },
          callback: (
            result: PlaceDetailsResult | null,
            status: PlacesServiceStatus
          ) => void
        ): void;
      }
      interface AutocompletePrediction {
        description: string;
        place_id: string;
        structured_formatting: {
          main_text: string;
          secondary_text: string;
        };
      }
      interface PlaceDetailsResult {
        name?: string;
        formatted_address?: string;
        place_id?: string;
        website?: string;
        formatted_phone_number?: string;
        rating?: number;
        opening_hours?: { weekday_text?: string[] };
        geometry?: { location?: { lat(): number; lng(): number } };
      }
      enum PlacesServiceStatus {
        OK = "OK",
        ZERO_RESULTS = "ZERO_RESULTS",
        ERROR = "ERROR",
      }
    }
  }
}
