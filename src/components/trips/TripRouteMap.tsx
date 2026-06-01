import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadGoogleMapsScript } from "@/lib/googleMaps";
import type { Waypoint } from "@/lib/tripRoute";

interface Props {
  waypoints: Waypoint[];
  fallbackQuery?: string | null;
  height?: number;
}

/** Quiet-luxury map styling — muted greens/creams, no POIs. */
const MAP_STYLES: any[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.local", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "off" }] },
  { elementType: "geometry", stylers: [{ saturation: -25 }, { lightness: 8 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe0e6" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f4efe4" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#9B7E4B" }, { weight: 0.6 }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
];

function numberedMarkerIcon(n: number): any {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'>
      <circle cx='17' cy='17' r='14' fill='#1A1A1A' stroke='#9B7E4B' stroke-width='1.25'/>
      <text x='17' y='21' text-anchor='middle' font-family='Inter, system-ui, sans-serif'
            font-size='13' font-weight='600' fill='#FDFCF8'>${n}</text>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new (window as any).google.maps.Size(34, 34),
    anchor: new (window as any).google.maps.Point(17, 17),
  };
}

export default function TripRouteMap({ waypoints, fallbackQuery, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadGoogleMapsScript();
      if (cancelled) return;
      const g = (window as any).google;
      if (!g?.maps?.Map || !containerRef.current) {
        setStatus("error");
        return;
      }

      const hasPoints = waypoints.length > 0;
      if (!hasPoints && !fallbackQuery) {
        setStatus("empty");
        return;
      }

      const map = new g.maps.Map(containerRef.current, {
        zoom: 5,
        center: hasPoints
          ? { lat: waypoints[0].lat, lng: waypoints[0].lng }
          : { lat: 20, lng: 0 },
        disableDefaultUI: true,
        gestureHandling: "cooperative",
        backgroundColor: "#FDFCF8",
        styles: MAP_STYLES,
      });

      // Geocode fallback for trips with no coordinates yet.
      if (!hasPoints && fallbackQuery) {
        try {
          const geocoder = new g.maps.Geocoder();
          geocoder.geocode({ address: fallbackQuery }, (results: any[] | null, st: string) => {
            if (st === "OK" && results?.[0]) {
              const loc = results[0].geometry.location;
              map.setCenter(loc);
              map.setZoom(6);
              new g.maps.Marker({ position: loc, map, icon: numberedMarkerIcon(1) });
            }
            setStatus("ready");
          });
        } catch {
          setStatus("ready");
        }
        return;
      }

      const bounds = new g.maps.LatLngBounds();

      waypoints.forEach((wp) => {
        const pos = { lat: wp.lat, lng: wp.lng };
        bounds.extend(pos);

        new g.maps.Marker({
          position: pos,
          map,
          icon: numberedMarkerIcon(wp.order),
          title: wp.label,
          label: undefined,
          zIndex: 10 + wp.order,
        });

        // City label as a transparent marker with text via OverlayView-like trick:
        // simplest path — a second marker with a label.
        new g.maps.Marker({
          position: pos,
          map,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          label: {
            text: wp.label,
            color: "#1A1A1A",
            fontFamily: "'Playfair Display', serif",
            fontSize: "12px",
            fontWeight: "600",
          },
          // Offset label to the right of the numbered pin
          // by placing this marker slightly east is unreliable; use label only.
          zIndex: 5,
        });
      });

      if (waypoints.length >= 2) {
        const dashSymbol = {
          path: "M 0,-1 0,1",
          strokeOpacity: 0.85,
          strokeColor: "#9B7E4B",
          strokeWeight: 2,
          scale: 3,
        };
        new g.maps.Polyline({
          path: waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
          map,
          strokeOpacity: 0,
          icons: [{ icon: dashSymbol, offset: "0", repeat: "12px" }],
          geodesic: true,
        });
      }

      if (waypoints.length === 1) {
        map.setCenter({ lat: waypoints[0].lat, lng: waypoints[0].lng });
        map.setZoom(7);
      } else {
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      }

      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(waypoints), fallbackQuery]);

  if (status === "empty") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 border-t-thin border-border bg-secondary/40 text-muted-foreground"
        style={{ height }}
      >
        <MapPin className="h-5 w-5 text-accent" strokeWidth={1.5} />
        <p className="font-inter text-xs">
          Add stays with locations to see your route.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden border-t-thin border-border" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/40">
          <span className="font-inter text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Drawing route…
          </span>
        </div>
      )}
    </div>
  );
}