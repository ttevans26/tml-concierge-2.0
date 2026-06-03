import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Compass, AlertTriangle } from "lucide-react";
import { useTripStore, type ItineraryItem } from "@/stores/useTripStore";
import {
  loadGoogleMapsScript,
  subscribeGoogleMapsDiagnostics,
  type GoogleMapsDiagnostics,
} from "@/lib/googleMaps";
import { cn } from "@/lib/utils";

const PIN_HEX: Record<ItineraryItem["category"], string> = {
  stays: "#5B6B8A",
  dining: "#5B9A6B",
  activity: "#B8934A",
  logistics: "#7A7A7A",
  sites_of_interest: "#8A5B9A",
};

const CATEGORY_LABEL: Record<ItineraryItem["category"], string> = {
  stays: "Stay",
  dining: "Dining",
  activity: "Activity",
  logistics: "Logistics",
  sites_of_interest: "Site",
};

function getCoords(item: ItineraryItem): { lat: number; lng: number } | null {
  if (item.location_lat != null && item.location_lng != null) {
    return { lat: item.location_lat, lng: item.location_lng };
  }
  const meta = (item.api_metadata || {}) as Record<string, unknown>;
  const mLat = Number(meta.lat ?? (meta as any).location_lat);
  const mLng = Number(meta.lng ?? (meta as any).location_lng);
  if (!isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0) {
    return { lat: mLat, lng: mLng };
  }
  return null;
}

function tripDays(start: string | null | undefined, end: string | null | undefined): string[] {
  if (!start || !end) return [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return [];
  const out: string[] = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function ProximityMap() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const activeAnchor = useTripStore((s) => s.activeAnchor);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [diag, setDiag] = useState<GoogleMapsDiagnostics | null>(null);
  const [dayFilter, setDayFilter] = useState<string | "all">("all");

  useEffect(() => subscribeGoogleMapsDiagnostics(setDiag), []);

  const days = useMemo(
    () => tripDays(activeTrip?.start_date, activeTrip?.end_date),
    [activeTrip?.start_date, activeTrip?.end_date],
  );

  const pinnedItems = useMemo(
    () =>
      itineraryItems.filter((i) => {
        if (getCoords(i) === null) return false;
        if (dayFilter === "all") return true;
        return i.date === dayFilter;
      }),
    [itineraryItems, dayFilter],
  );

  const missingCount = useMemo(
    () => itineraryItems.filter((i) => getCoords(i) === null).length,
    [itineraryItems],
  );

  // Initialize map
  useEffect(() => {
    if (!activeTrip) return;
    let cancelled = false;
    loadGoogleMapsScript().then(() => {
      if (cancelled || !mapRef.current) return;
      const g = (window as any).google;
      if (!g?.maps?.Map) return;
      if (!mapInstanceRef.current) {
        try {
          mapInstanceRef.current = new g.maps.Map(mapRef.current, {
            zoom: 12,
            center: { lat: 43.58, lng: 7.12 },
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
          console.error("Proximity map init failed", err);
          return;
        }
      }
      setMapReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTrip?.id]);

  // Render markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (pinnedItems.length === 0) return;

    const bounds = new g.maps.LatLngBounds();

    pinnedItems.forEach((item) => {
      const coords = getCoords(item)!;
      const color = PIN_HEX[item.category] || "#888";
      const isAnchor = activeAnchor?.id === item.id;
      const marker = new g.maps.Marker({
        position: coords,
        map: mapInstanceRef.current,
        title: item.title,
        zIndex: isAnchor ? 999 : undefined,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: isAnchor ? "#9B7E4B" : "#fff",
          strokeWeight: isAnchor ? 3 : 1.5,
          scale: isAnchor ? 10 : 7,
        },
      });

      const timeStr = item.start_time ? item.start_time.slice(0, 5) : "";
      const dayIdx = item.date && days.length > 0 ? days.indexOf(item.date) : -1;
      const dayBadge = dayIdx >= 0 ? `Day ${dayIdx + 1}` : "";

      const info = new g.maps.InfoWindow({
        content: `<div style="font-family:Inter,sans-serif;font-size:11px;max-width:180px;line-height:1.4">
          <strong style="font-family:'Playfair Display',serif;font-size:13px">${item.title}</strong>
          <div style="color:#777;margin-top:2px">
            <span style="display:inline-block;padding:1px 5px;background:${color};color:#fff;border-radius:2px;font-size:9px;letter-spacing:0.5px;text-transform:uppercase">${CATEGORY_LABEL[item.category]}</span>
            ${dayBadge ? `<span style="margin-left:4px">${dayBadge}</span>` : ""}
            ${timeStr ? `<span style="margin-left:4px">${timeStr}</span>` : ""}
          </div>
          ${item.location_name ? `<div style="color:#999;margin-top:3px;font-size:10px">${item.location_name}</div>` : ""}
        </div>`,
      });
      marker.addListener("click", () => info.open(mapInstanceRef.current, marker));

      markersRef.current.push(marker);
      bounds.extend(coords);
    });

    if (pinnedItems.length === 1) {
      mapInstanceRef.current.setCenter(getCoords(pinnedItems[0])!);
      mapInstanceRef.current.setZoom(15);
    } else {
      mapInstanceRef.current.fitBounds(bounds, 50);
    }
  }, [mapReady, pinnedItems, activeAnchor?.id, days]);

  const showDiagBanner =
    diag && diag.status !== "idle" && diag.status !== "loading" && diag.status !== "ready";

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <h2 className="font-playfair text-sm font-semibold text-foreground">Proximity Map</h2>
        <span className="ml-auto font-inter text-[10px] text-muted-foreground">
          {pinnedItems.length} pinned
          {missingCount > 0 ? ` · ${missingCount} unmapped` : ""}
        </span>
      </div>

      {/* Day filter chips */}
      {days.length > 0 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-secondary/20 px-3 py-2">
          <button
            onClick={() => setDayFilter("all")}
            className={cn(
              "shrink-0 rounded-sm border-thin px-2 py-1 font-inter text-[10px] uppercase tracking-wider transition-colors",
              dayFilter === "all"
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {days.map((d, idx) => (
            <button
              key={d}
              onClick={() => setDayFilter(d)}
              className={cn(
                "shrink-0 rounded-sm border-thin px-2 py-1 font-inter text-[10px] uppercase tracking-wider transition-colors",
                dayFilter === d
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Day {idx + 1}
            </button>
          ))}
        </div>
      )}

      {/* Map area */}
      <div className="relative flex flex-1 flex-col min-h-0">
        {!activeTrip ? (
          <div className="flex flex-1 items-center justify-center bg-secondary/30 px-6">
            <div className="text-center">
              <Compass className="mx-auto h-5 w-5 text-accent" strokeWidth={1.5} />
              <p className="mt-2 font-playfair text-sm font-semibold text-foreground">No trip</p>
            </div>
          </div>
        ) : (
          <>
            <div ref={mapRef} className="flex-1 min-h-0" />

            {pinnedItems.length === 0 && missingCount === 0 && mapReady && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-card/80 px-6">
                <div className="text-center">
                  <MapPin className="mx-auto h-5 w-5 text-accent" strokeWidth={1.5} />
                  <p className="mt-2 font-playfair text-sm font-semibold text-foreground">
                    Nothing to map yet
                  </p>
                  <p className="mx-auto mt-1 max-w-[220px] font-inter text-[10px] leading-relaxed text-muted-foreground">
                    Add Stays, Dining, or Activities with a location to see them here.
                  </p>
                </div>
              </div>
            )}

            {showDiagBanner && (
              <div className="border-t border-border bg-amber-50/80 px-3 py-2 font-inter text-[10px] text-amber-900">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                  <div className="flex-1 leading-snug">
                    <div className="text-[9px] font-semibold uppercase tracking-wider">
                      Google Maps — {diag!.status.replace(/-/g, " ")}
                    </div>
                    {diag!.lastError && <div className="mt-0.5">{diag!.lastError}</div>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}