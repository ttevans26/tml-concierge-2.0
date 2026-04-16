import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Compass, RefreshCw } from "lucide-react";
import { useStudioStore, StudioItem } from "@/stores/useStudioStore";
import { useGooglePlaces } from "@/hooks/useGooglePlaces";
import { toast } from "sonner";

const GOOGLE_MAPS_API_KEY = "AIzaSyAz8jCkGRyZuOQLPOA5QpAAJPvhBK0e4iU";

const PIN_HEX: Record<string, string> = {
  stays: "#5B6B8A",
  dining: "#5B9A6B",
  activity: "#B8934A",
  sites: "#8A5B9A",
};

let mapsScriptLoaded = false;
let mapsScriptLoading = false;
const mapsCallbacks: (() => void)[] = [];

function ensureMapsScript(): Promise<void> {
  const g = (window as any).google;
  if (mapsScriptLoaded && g?.maps) return Promise.resolve();
  return new Promise((resolve) => {
    if (mapsScriptLoading) {
      mapsCallbacks.push(resolve);
      return;
    }
    // Check if already loaded by useGooglePlaces
    if (g?.maps) {
      mapsScriptLoaded = true;
      resolve();
      return;
    }
    mapsScriptLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      mapsScriptLoaded = true;
      mapsScriptLoading = false;
      resolve();
      mapsCallbacks.forEach((cb) => cb());
      mapsCallbacks.length = 0;
    };
    script.onerror = () => {
      mapsScriptLoading = false;
      resolve();
    };
    document.head.appendChild(script);
  });
}

/** Extract lat/lng from item, checking top-level fields and api_metadata */
function getCoords(item: StudioItem): { lat: number; lng: number } | null {
  if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng };
  const meta = item.api_metadata || {};
  const mLat = Number(meta.lat ?? meta.location_lat);
  const mLng = Number(meta.lng ?? meta.location_lng);
  if (!isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0) return { lat: mLat, lng: mLng };
  return null;
}

export default function StudioMap() {
  const { activeFolder } = useStudioStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const allItems = activeFolder?.items || [];
  const pinnedItems = allItems.filter((i) => getCoords(i) !== null);

  // Initialize map
  useEffect(() => {
    if (!activeFolder) return;
    let cancelled = false;
    ensureMapsScript().then(() => {
      if (cancelled || !mapRef.current) return;
      const g = (window as any).google;
      if (!g?.maps) return;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new g.maps.Map(mapRef.current, {
          zoom: 13,
          center: { lat: 43.58, lng: 7.12 }, // default Antibes
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#f5f0e8" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#4a4a4a" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9dce6" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#e8e0d4" }] },
          ],
        });
      }
      setMapReady(true);
    });
    return () => { cancelled = true; };
  }, [activeFolder?.id]);

  // Update markers & bounds when items change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (pinnedItems.length === 0) return;

    const bounds = new g.maps.LatLngBounds();

    pinnedItems.forEach((item) => {
      const coords = getCoords(item)!;
      const color = PIN_HEX[item.category] || "#888";
      const marker = new g.maps.Marker({
        position: coords,
        map: mapInstanceRef.current,
        title: item.title,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 1.5,
          scale: 7,
        },
      });

      const infoWindow = new g.maps.InfoWindow({
        content: `<div style="font-family:Inter,sans-serif;font-size:11px;max-width:160px">
          <strong>${item.title}</strong>
          ${item.address ? `<br/><span style="color:#777">${item.address}</span>` : ""}
        </div>`,
      });
      marker.addListener("click", () => infoWindow.open(mapInstanceRef.current, marker));

      markersRef.current.push(marker);
      bounds.extend(coords);
    });

    if (pinnedItems.length === 1) {
      const c = getCoords(pinnedItems[0])!;
      mapInstanceRef.current.setCenter(c);
      mapInstanceRef.current.setZoom(15);
    } else {
      mapInstanceRef.current.fitBounds(bounds, 40);
    }
  }, [mapReady, pinnedItems.length, activeFolder?.id, allItems]);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Proximity Map
        </h2>
        {activeFolder && (
          <span className="ml-auto font-inter text-[10px] text-muted-foreground">
            {pinnedItems.length} pinned · {allItems.length} total
          </span>
        )}
      </div>

      {/* Map area */}
      <div className="relative flex flex-1 flex-col">
        {!activeFolder ? (
          <div className="flex flex-1 items-center justify-center px-6 bg-secondary/30">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-thin border-border bg-background">
                <Compass className="h-5 w-5 text-accent" strokeWidth={1.5} />
              </div>
              <p className="font-playfair text-sm font-semibold text-foreground">World View</p>
              <p className="mt-1 mx-auto max-w-[200px] font-inter text-[10px] leading-relaxed text-muted-foreground">
                Select a collection to see a proximity view of your saved locations.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Google Map container */}
            <div ref={mapRef} className="flex-1 min-h-0" />

            {/* Unpinned items list */}
            {allItems.filter((i) => !getCoords(i)).length > 0 && (
              <div className="border-t border-border bg-background px-3 py-2 max-h-28 overflow-y-auto">
                <p className="font-inter text-[9px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                  Missing Coordinates
                </p>
                {allItems.filter((i) => !getCoords(i)).map((item) => (
                  <ResyncRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Row for items missing coords, with a re-sync button */
function ResyncRow({ item }: { item: StudioItem }) {
  const { getDetails } = useGooglePlaces({ enabled: true });
  const fetchFolders = useStudioStore((s) => s.fetchFolders);
  const [syncing, setSyncing] = useState(false);

  const handleResync = useCallback(async () => {
    if (item.google_place_id) {
      setSyncing(true);
      try {
        const details = await getDetails(item.google_place_id);
        if (details) {
          const { supabase } = await import("@/integrations/supabase/client");
          const meta = { ...(item.api_metadata || {}), rating: details.rating, user_ratings_total: details.userRatingsTotal, photo_url: details.photoUrl };
          await supabase
            .from("studio_items")
            .update({ lat: details.lat, lng: details.lng, address: details.address, api_metadata: meta } as any)
            .eq("id", item.id);
          await fetchFolders();
          toast.success(`Re-synced "${item.title}"`);
        } else {
          toast.error("Could not fetch place details");
        }
      } catch {
        toast.error("Re-sync failed");
      } finally {
        setSyncing(false);
      }
    } else {
      toast.info("No Google Place ID linked. Edit the item to search and link a place.");
    }
  }, [item, getDetails, fetchFolders]);

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="flex-1 truncate font-inter text-[10px] text-foreground">{item.title}</span>
      <button
        onClick={handleResync}
        disabled={syncing}
        className="shrink-0 rounded-sm p-0.5 text-accent hover:text-accent/80 disabled:opacity-50"
        title={item.google_place_id ? "Re-sync from Google Places" : "No Place ID — edit to link"}
      >
        <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
