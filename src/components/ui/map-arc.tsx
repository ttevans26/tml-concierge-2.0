import * as React from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { geoOrthographic, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export interface ArcPoint {
  id: string;
  label: string;
  sublabel?: string | null;
  lat: number;
  lng: number;
  kind?: "stay" | "activity" | "dining" | "site" | "logistics";
}

export interface MapArcProps {
  points: ArcPoint[];
  title?: string;
  subtitle?: string;
  height?: number | string;
  className?: string;
  /** Visual mode: editorial arc atlas, or a slowly rotating wireframe globe placeholder. */
  mode?: "arc" | "globe";
}

/**
 * MapArc — Editorial arc-overlay map.
 *
 * Renders a flat cream "atlas" surface with the provided points
 * projected via equirectangular normalization, connected by gentle
 * bronze quadratic arcs. Intentionally not a real tiled map —
 * tile providers (Mapbox/MapLibre) would require a new secret.
 * The look matches the 21st.dev arc map reference without the
 * infrastructure cost. Falls back to a hero placeholder when empty.
 */
export function MapArc({
  points,
  title,
  subtitle,
  height = 360,
  className,
  mode = "arc",
}: MapArcProps) {
  if (mode === "globe") {
    return (
      <GlobePlaceholder
        title={title}
        subtitle={subtitle}
        height={height}
        className={className}
      />
    );
  }

  const valid = React.useMemo(
    () => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [points],
  );

  // Projection bounds with padding
  const proj = React.useMemo(() => {
    if (valid.length === 0) return null;
    const lats = valid.map((p) => p.lat);
    const lngs = valid.map((p) => p.lng);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);
    // Min span to avoid divide-by-zero on single point
    const padLat = Math.max(0.02, (maxLat - minLat) * 0.25);
    const padLng = Math.max(0.02, (maxLng - minLng) * 0.25);
    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;
    return { minLat, maxLat, minLng, maxLng };
  }, [valid]);

  const W = 1000;
  const heightNum = typeof height === "number" ? height : 360;
  const H = 1000 * (heightNum / 1000) * 1.4; // keep aspect roughly 5:7

  const project = (p: ArcPoint) => {
    if (!proj) return { x: W / 2, y: H / 2 };
    const x = ((p.lng - proj.minLng) / (proj.maxLng - proj.minLng)) * W;
    const y = (1 - (p.lat - proj.minLat) / (proj.maxLat - proj.minLat)) * H;
    return { x, y };
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-hero border border-foil bg-cream shadow-paper",
        className,
      )}
      style={{ height }}
    >
      {/* Atlas grid */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(36 45% 42%)" stopOpacity="0.85" />
            <stop offset="50%" stopColor="hsl(38 60% 55%)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(36 45% 42%)" stopOpacity="0.85" />
          </linearGradient>
          <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(36 60% 55%)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(36 45% 42%)" stopOpacity="0" />
          </radialGradient>
          <pattern id="atlasGrid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="hsl(36 25% 70%)"
              strokeOpacity="0.18"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern id="atlasGridMajor" width="240" height="240" patternUnits="userSpaceOnUse">
            <path
              d="M 240 0 L 0 0 0 240"
              fill="none"
              stroke="hsl(36 35% 50%)"
              strokeOpacity="0.22"
              strokeWidth="0.7"
            />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#atlasGrid)" />
        <rect width="100%" height="100%" fill="url(#atlasGridMajor)" />

        {/* Compass rose */}
        <g transform={`translate(${W - 90} 70)`} opacity="0.45">
          <circle r="22" fill="none" stroke="hsl(36 45% 42%)" strokeWidth="0.8" />
          <path d="M 0 -22 L 4 0 L 0 22 L -4 0 Z" fill="hsl(36 45% 42%)" />
          <text y="-28" textAnchor="middle" fontSize="10" fontFamily="Playfair Display, serif" fill="hsl(36 45% 42%)">
            N
          </text>
        </g>

        {/* Arcs between consecutive points */}
        {valid.length > 1 &&
          valid.slice(0, -1).map((p, i) => {
            const a = project(p);
            const b = project(valid[i + 1]);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            // Perpendicular offset for arc curvature
            const ox = -dy / len;
            const oy = dx / len;
            const lift = Math.min(220, len * 0.35);
            const cx = mx + ox * lift;
            const cy = my + oy * lift;
            return (
              <g key={p.id + "-arc"}>
                <path
                  d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                  fill="none"
                  stroke="url(#arcGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="1000"
                  strokeDashoffset="1000"
                  style={{
                    animation: `arc-draw 1200ms ${i * 220}ms var(--ease-editorial) forwards`,
                  }}
                />
              </g>
            );
          })}

        {/* Markers */}
        {valid.map((p, i) => {
          const { x, y } = project(p);
          const isStay = p.kind === "stay";
          return (
            <g
              key={p.id}
              transform={`translate(${x} ${y})`}
              style={{
                opacity: 0,
                animation: `marker-pop 480ms ${300 + i * 120}ms var(--ease-magnetic) forwards`,
              }}
            >
              <circle r="22" fill="url(#markerGlow)" />
              <circle r={isStay ? 7 : 5} fill={isStay ? "hsl(36 45% 42%)" : "hsl(0 0% 12%)"} />
              <circle r={isStay ? 3 : 2} fill="hsl(43 71% 98%)" />
            </g>
          );
        })}
      </svg>

      {/* Vignette + grain overlay for paper feel */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-vignette)" }} />

      {/* Hero overlay text */}
      {(title || subtitle) && (
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          {subtitle && (
            <p className="font-inter text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
              {subtitle}
            </p>
          )}
          {title && (
            <h1 className="mt-1.5 font-display-lg text-foreground">
              {title}
            </h1>
          )}
        </div>
      )}

      {/* Empty state */}
      {valid.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border-foil bg-surface-3 shadow-paper">
            <MapPin className="h-5 w-5 text-accent" strokeWidth={1.5} />
          </div>
          <p className="font-playfair italic-accent text-base text-foreground">
            The atlas is waiting
          </p>
          <p className="mt-1 max-w-xs px-6 font-inter text-[11px] text-muted-foreground">
            Add a stay or saved place to see your trip take shape.
          </p>
        </div>
      )}

      {/* Local keyframes */}
      <style>{`
        @keyframes arc-draw { to { stroke-dashoffset: 0; } }
        @keyframes marker-pop {
          0% { opacity: 0; transform: translate(var(--tx,0), var(--ty,0)) scale(0.4); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default MapArc;

/* -------------------------------------------------------------------------- */
/*  Rotating wireframe globe — used when context is undefined (no folder).    */
/* -------------------------------------------------------------------------- */

function GlobePlaceholder({
  title,
  subtitle,
  height,
  className,
}: {
  title?: string;
  subtitle?: string;
  height: number | string;
  className?: string;
}) {
  const VB = 400;
  const cx = VB / 2;
  const cy = VB / 2;
  const R = 150;

  // 6 meridians, each animated with a phase offset so the whole sphere
  // appears to rotate. We animate `rx` from R → ~0.05R → R and flip the
  // stroke opacity at the midpoint to fake the back/front of the sphere.
  const meridians = Array.from({ length: 6 }, (_, i) => i);
  const PERIOD = 24; // seconds for a full rotation

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-hero border border-foil bg-cream shadow-paper",
        className,
      )}
      style={height === undefined ? undefined : { height }}
    >
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <radialGradient id="globeFill" cx="35%" cy="32%" r="75%">
            <stop offset="0%" stopColor="hsl(43 71% 99%)" />
            <stop offset="55%" stopColor="hsl(43 50% 95%)" />
            <stop offset="100%" stopColor="hsl(36 28% 86%)" />
          </radialGradient>
          <radialGradient id="globeHighlight" cx="30%" cy="25%" r="40%">
            <stop offset="0%" stopColor="hsl(43 100% 100%)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(43 100% 100%)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="globeRim" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="hsl(36 45% 42%)" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(36 45% 42%)" stopOpacity="0.35" />
          </radialGradient>
        </defs>

        {/* Sphere */}
        <circle cx={cx} cy={cy} r={R} fill="url(#globeFill)" />
        <circle cx={cx} cy={cy} r={R} fill="url(#globeRim)" />

        {/* Latitudes (static) */}
        {[-0.7, -0.4, 0, 0.4, 0.7].map((t, idx) => {
          const ry = R * Math.sqrt(1 - t * t);
          const yy = cy + R * t;
          return (
            <ellipse
              key={idx}
              cx={cx}
              cy={yy}
              rx={R * Math.sqrt(1 - t * t)}
              ry={ry * 0.18}
              fill="none"
              stroke="hsl(36 45% 42%)"
              strokeOpacity={t === 0 ? 0.55 : 0.28}
              strokeWidth={t === 0 ? 0.9 : 0.6}
            />
          );
        })}

        {/* Meridians (animated to simulate rotation) */}
        <g
          className="globe-meridians"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
          {meridians.map((i) => {
            const delay = (-PERIOD / meridians.length) * i;
            return (
              <ellipse
                key={i}
                cx={cx}
                cy={cy}
                rx={R}
                ry={R}
                fill="none"
                stroke="hsl(36 45% 42%)"
                strokeOpacity={0.32}
                strokeWidth={0.7}
                style={{
                  animation: `globe-meridian ${PERIOD}s linear ${delay}s infinite`,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />
            );
          })}
        </g>

        {/* Top-left specular highlight for dimension */}
        <circle cx={cx} cy={cy} r={R} fill="url(#globeHighlight)" />

        {/* Hairline rim */}
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="hsl(36 45% 42%)"
          strokeOpacity="0.55"
          strokeWidth="0.9"
        />
      </svg>

      {/* Grain + vignette for paper feel */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-vignette)" }}
      />

      {(title || subtitle) && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center p-6 text-center">
          {subtitle && (
            <p className="font-inter text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
              {subtitle}
            </p>
          )}
          {title && (
            <h2 className="mt-1 font-playfair italic-accent text-base text-foreground">
              {title}
            </h2>
          )}
        </div>
      )}

      <style>{`
        @keyframes globe-meridian {
          0%   { rx: ${R}px; stroke-opacity: 0.32; }
          25%  { rx: ${R * 0.05}px; stroke-opacity: 0.55; }
          50%  { rx: ${R}px; stroke-opacity: 0.32; }
          75%  { rx: ${R * 0.05}px; stroke-opacity: 0.12; }
          100% { rx: ${R}px; stroke-opacity: 0.32; }
        }
        @media (prefers-reduced-motion: reduce) {
          .globe-meridians ellipse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}