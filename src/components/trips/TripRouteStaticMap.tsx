import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { Waypoint } from "@/lib/tripRoute";

interface Props {
  waypoints: Waypoint[];
  fallbackQuery?: string | null;
  height?: number;
  isLoading?: boolean;
  /** Called when the static image fails to load — lets parent swap to dynamic map. */
  onError?: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const PROXY_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/static-map` : null;

/** Quiet-luxury Static Maps styling. URL-encoded `style=` clauses. */
const STYLE_CLAUSES: string[] = [
  "feature:poi|visibility:off",
  "feature:transit|visibility:off",
  "feature:road|element:labels.icon|visibility:off",
  "feature:road.local|visibility:off",
  "feature:road.arterial|element:labels|visibility:off",
  "element:geometry|saturation:-25|lightness:8",
  "feature:water|element:geometry|color:0xcfe0e6",
  "feature:landscape|element:geometry|color:0xf4efe4",
  "feature:administrative.country|element:geometry.stroke|color:0x9B7E4B|weight:0.6",
  "feature:administrative.land_parcel|visibility:off",
];

function buildStaticUrl(opts: {
  waypoints: Waypoint[];
  fallbackQuery?: string | null;
  width: number;
  height: number;
  scale: 1 | 2;
}): string | null {
  if (!PROXY_BASE) return null;
  const params = new URLSearchParams();
  params.set("size", `${opts.width}x${opts.height}`);
  params.set("scale", String(opts.scale));
  params.set("maptype", "roadmap");
  for (const s of STYLE_CLAUSES) params.append("style", s);

  const wps = opts.waypoints.filter(
    (w) =>
      Number.isFinite(w.lat) &&
      Number.isFinite(w.lng) &&
      !(Math.abs(w.lat) < 0.001 && Math.abs(w.lng) < 0.001),
  );

  if (wps.length > 0) {
    // Numbered onyx markers with bronze label background via simple Static Maps markers.
    wps.forEach((w, idx) => {
      const n = idx + 1;
      const label = n <= 9 ? String(n) : ""; // Static Maps labels accept one char
      params.append(
        "markers",
        `color:0x1A1A1A|label:${label}|size:mid|${w.lat},${w.lng}`,
      );
    });
    if (wps.length >= 2) {
      const path = wps.map((w) => `${w.lat},${w.lng}`).join("|");
      params.append("path", `color:0x9B7E4Bcc|weight:3|geodesic:true|${path}`);
    } else {
      params.set("zoom", "7");
      params.set("center", `${wps[0].lat},${wps[0].lng}`);
    }
    return `${PROXY_BASE}?${params.toString()}`;
  }

  if (opts.fallbackQuery) {
    params.set("center", opts.fallbackQuery);
    params.set("zoom", "5");
    return `${PROXY_BASE}?${params.toString()}`;
  }

  return null;
}

/**
 * Renders a Google Static Maps PNG for a trip route. Far faster than the
 * interactive `TripRouteMap` — one HTTP request, no SDK load, no tile streams.
 * Auto-updates when `waypoints` (signature-cached upstream) change.
 */
export default function TripRouteStaticMap({
  waypoints,
  fallbackQuery,
  height = 320,
  isLoading = false,
  onError,
}: Props) {
  const [imgError, setImgError] = useState(false);

  // Use a reasonable Static Maps size (capped at 640 free / 2048 paid).
  // We oversample at scale=2 for retina without doubling URL width past 640.
  const url = useMemo(
    () =>
      buildStaticUrl({
        waypoints,
        fallbackQuery,
        width: 640,
        height: Math.min(height, 640),
        scale: 2,
      }),
    [waypoints, fallbackQuery, height],
  );

  const hasContent = url && !imgError;

  return (
    <div
      className="relative w-full overflow-hidden border-t-thin border-border bg-secondary/40"
      style={{ height }}
    >
      {hasContent ? (
        <img
          src={url!}
          alt={
            waypoints.length > 0
              ? `Route map with ${waypoints.length} stop${waypoints.length === 1 ? "" : "s"}`
              : fallbackQuery
                ? `Map of ${fallbackQuery}`
                : "Trip route map"
          }
          loading="lazy"
          decoding="async"
          onError={() => {
            setImgError(true);
            onError?.();
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <MapPin className="h-5 w-5 text-accent" strokeWidth={1.5} />
          {fallbackQuery ? (
            <p className="font-playfair text-sm italic">{fallbackQuery}</p>
          ) : (
            <p className="font-inter text-[11px] uppercase tracking-[0.18em]">
              Preparing map…
            </p>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <MapPin className="h-5 w-5 text-accent" strokeWidth={1.5} />
          <p className="font-inter text-xs">
            {fallbackQuery
              ? "Map unavailable."
              : "Add stays with locations to see your route."}
          </p>
        </div>
      )}
    </div>
  );
}