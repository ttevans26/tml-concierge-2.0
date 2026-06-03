import * as React from "react";
import { MapPin, Star, ExternalLink } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export interface MarkerPopupData {
  title: string;
  subtitle?: string | null;
  address?: string | null;
  rating?: number | null;
  photoUrl?: string | null;
  googlePlaceId?: string | null;
  category?: string | null;
}

export interface MarkerPopupProps extends React.PropsWithChildren {
  data: MarkerPopupData | null | undefined;
  side?: "top" | "right" | "bottom" | "left";
  openDelay?: number;
  closeDelay?: number;
}

/**
 * MarkerPopup — Map-style rich preview on hover.
 * Renders only when `data.googlePlaceId` or a useful subset exists. Otherwise
 * passes children through untouched so wrapping is safe everywhere.
 */
export function MarkerPopup({
  data,
  children,
  side = "right",
  openDelay = 250,
  closeDelay = 120,
}: MarkerPopupProps) {
  const enabled = !!data && !!(data.googlePlaceId || data.address || data.photoUrl);
  if (!enabled) return <>{children}</>;

  const mapsUrl = data!.googlePlaceId
    ? `https://www.google.com/maps/place/?q=place_id:${data!.googlePlaceId}`
    : null;

  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align="start"
        sideOffset={10}
        className="w-72 overflow-hidden rounded-editorial border-foil bg-surface-3 p-0 shadow-float animate-fade-in-up"
      >
        {/* Photo */}
        {data!.photoUrl ? (
          <div className="relative h-32 w-full overflow-hidden">
            <img
              src={data!.photoUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
            {data!.category && (
              <span className="absolute left-2 top-2 rounded-editorial bg-foil px-2 py-0.5 font-inter text-[9px] font-semibold uppercase tracking-widest text-accent-foreground shadow-foil">
                {data!.category}
              </span>
            )}
          </div>
        ) : (
          <div className="h-2 bg-foil" />
        )}

        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-playfair text-[15px] font-semibold leading-snug text-foreground line-clamp-2">
              {data!.title}
            </h4>
            {data!.rating != null && (
              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-editorial border-foil border bg-foil-soft px-1.5 py-0.5 font-inter text-[10px] font-semibold text-foreground">
                <Star className="h-2.5 w-2.5 fill-accent text-accent" />
                {Number(data!.rating).toFixed(1)}
              </span>
            )}
          </div>

          {data!.subtitle && (
            <p className="font-inter text-[11px] italic-accent text-accent line-clamp-1">
              {data!.subtitle}
            </p>
          )}

          {data!.address && (
            <p className="flex items-start gap-1.5 font-inter text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-accent" strokeWidth={1.5} />
              <span>{data!.address}</span>
            </p>
          )}

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "mt-1 inline-flex items-center gap-1 font-inter text-[10px] font-semibold uppercase tracking-widest text-accent",
                "transition-colors hover:text-foreground",
              )}
            >
              Open in Maps <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default MarkerPopup;