import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { useStudioStore, StudioItem } from "@/stores/useStudioStore";
import {
  loadGoogleMapsScript,
  healItemCoordinates,
  subscribeGoogleMapsDiagnostics,
  type GoogleMapsDiagnostics,
} from "@/lib/googleMaps";
import { toast } from "sonner";
import { MapArc } from "@/components/ui/map-arc";

const PIN_HEX: Record<string, string> = {
  stays: "#5B6B8A",
  dining: "#5B9A6B",
  activity: "#B8934A",
  sites: "#8A5B9A",
};

const ensureMapsScript = loadGoogleMapsScript;

/** Extract lat/lng from item, checking top-level fields and api_metadata */
function getCoords(item: StudioItem): { lat: number; lng: number } | null {
  if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng };
  const meta = item.api_metadata || {};
  const mLat = Number(meta.lat ?? meta.location_lat);
  const mLng = Number(meta.lng ?? meta.location_lng);
  if (!isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0) return { lat: mLat, lng: mLng };
  return null;
}

interface StudioMapProps {
  /** When true: omit the header chrome and the missing-coords footer so the map fills its container. */
  bare?: boolean;
  /** Optional callback fired when a marker is clicked. */
  onSelectItem?: (item: StudioItem) => void;
  /** When set, the map will pan/zoom to this item's coordinates. */
  focusItemId?: string | null;
}

export default function StudioMap({ bare = false, onSelectItem, focusItemId }: StudioMapProps = {}) {
  const { activeFolder, fetchFolders } = useStudioStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const healedIdsRef = useRef<Set<string>>(new Set());
  const [diag, setDiag] = useState<GoogleMapsDiagnostics | null>(null);

  useEffect(() => subscribeGoogleMapsDiagnostics(setDiag), []);

  const allItems = activeFolder?.items || [];
  const pinnedItems = allItems.filter((i) => getCoords(i) !== null);

  // Initialize map
  useEffect(() => {
    if (!activeFolder) return;
    let cancelled = false;
    ensureMapsScript().then(() => {
      if (cancelled || !mapRef.current) return;
      const g = (window as any).google;
      if (!g?.maps?.Map) {
        console.error(
          "Google Maps failed to initialize — check the Google Maps connection / API key referrer restrictions."
        );
        return;
      }

      if (!mapInstanceRef.current) {
        try {
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
        } catch (err) {
          console.error("Google Maps init failed", err);
          return;
        }
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
      if (onSelectItem) {
        marker.addListener("click", () => onSelectItem(item));
      }

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

  // External focus: pan to a specific item.
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !focusItemId) return;
    const item = allItems.find((i) => i.id === focusItemId);
    if (!item) return;
    const coords = getCoords(item);
    if (!coords) return;
    mapInstanceRef.current.panTo(coords);
    mapInstanceRef.current.setZoom(16);
  }, [focusItemId, mapReady, allItems]);

  // Background auto-heal: silently look up coords for any items missing them
  useEffect(() => {
    if (!mapReady || !activeFolder) return;
    const missing = allItems.filter(
      (i) => getCoords(i) === null && !healedIdsRef.current.has(i.id)
    );
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const item of missing) {
        if (cancelled) return;
        healedIdsRef.current.add(item.id);
        try {
          const result = await healItemCoordinates(item, activeFolder.location);
          if (cancelled) return;
          if (result) {
            await fetchFolders();
          }
        } catch (err) {
          console.warn("Auto-heal failed for", item.title, err);
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapReady, activeFolder?.id, allItems.length]);

  // Reset healed-set when switching folders so a new folder gets its own pass
  useEffect(() => {
    healedIdsRef.current = new Set();
  }, [activeFolder?.id]);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      {!bare && (
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
      )}

      {/* Map area */}
      <div className="relative flex flex-1 flex-col">
        {!activeFolder ? (
          <div className="relative flex flex-1 flex-col">
            <div className="relative flex-1 min-h-0">
              <MapArc
                mode="globe"
                points={[]}
                className="absolute inset-0 h-full w-full rounded-none border-0 shadow-none"
              />
            </div>
            <div className="border-t border-border bg-card/80 px-4 py-3 text-center backdrop-blur-sm">
              <p className="font-inter text-[9px] font-semibold uppercase tracking-[0.3em] text-accent">
                World View
              </p>
              <p className="mt-1 font-playfair italic-accent text-sm text-foreground">
                Awaiting a destination
              </p>
              <p className="mx-auto mt-1 max-w-[220px] font-inter text-[10px] leading-relaxed text-muted-foreground">
                Choose a collection from the vault to focus the atlas.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Google Map container */}
            <div ref={mapRef} className="flex-1 min-h-0" />

            {/* Self-diagnostic banner (only when Maps failed to initialize) */}
            {diag && diag.status !== "idle" && diag.status !== "loading" && diag.status !== "ready" && (
              <div className="border-t border-border bg-amber-50/80 px-3 py-2 text-[10px] font-inter text-amber-900">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={2} />
                  <div className="flex-1 leading-snug">
                    <div className="font-semibold uppercase tracking-wider text-[9px]">
                      Google Maps — {diag.status.replace(/-/g, " ")}
                    </div>
                    {diag.lastError && <div className="mt-0.5">{diag.lastError}</div>}
                    <div className="mt-1 text-amber-800/80">
                      Key: <span className="font-mono">{diag.keyMasked}</span> · Source:{" "}
                      <span className="font-mono">{diag.keySource}</span> · Origin:{" "}
                      <span className="font-mono">{diag.origin}</span>
                    </div>
                    {diag.status === "referer-not-allowed" && (
                      <div className="mt-1 text-amber-800/80">
                        Add <span className="font-mono">{diag.origin}/*</span> to this key's HTTP-referrer
                        allowlist in Google Cloud Console, or reconnect the managed Google Maps integration.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Unpinned items list */}
            {!bare && allItems.filter((i) => !getCoords(i)).length > 0 && (
              <div className="border-t border-border bg-background px-3 py-2 max-h-28 overflow-y-auto">
                <p className="font-inter text-[9px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                  Missing Coordinates
                </p>
                {allItems.filter((i) => !getCoords(i)).map((item) => (
                  <ResyncRow key={item.id} item={item} folderLocation={activeFolder.location} mapInstance={mapInstanceRef.current} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Row for items missing coords — auto-heals via name + folder location search */
function ResyncRow({ item, folderLocation, mapInstance }: { item: StudioItem; folderLocation: string; mapInstance: any }) {
  const fetchFolders = useStudioStore((s) => s.fetchFolders);
  const [syncing, setSyncing] = useState(false);
  const [healed, setHealed] = useState(false);

  const handleResync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await healItemCoordinates(item, folderLocation);
      if (!result) {
        toast.error(`No match found for "${item.title}"`);
        setSyncing(false);
        return;
      }
      await fetchFolders();
      setHealed(true);
      toast.success(`Pinned "${item.title}"`);
      if (mapInstance) {
        mapInstance.panTo({ lat: result.lat, lng: result.lng });
        mapInstance.setZoom(15);
      }
    } catch (err) {
      console.error("Resync error:", err);
      toast.error("Re-sync failed");
    } finally {
      setSyncing(false);
    }
  }, [item, folderLocation, fetchFolders, mapInstance]);

  if (healed) {
    return (
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="flex-1 truncate font-inter text-[10px] text-foreground">{item.title}</span>
        <CheckCircle className="h-3 w-3 shrink-0 text-green-600" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="flex-1 truncate font-inter text-[10px] text-foreground">{item.title}</span>
      <button
        onClick={handleResync}
        disabled={syncing}
        className="shrink-0 rounded-sm p-0.5 text-accent hover:text-accent/80 disabled:opacity-50"
        title={`Auto-link "${item.title}" via Google Places`}
      >
        <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
