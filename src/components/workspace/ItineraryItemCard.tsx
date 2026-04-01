import { useState, useMemo } from "react";
import { Pencil, ExternalLink, Anchor, CreditCard, Navigation, AlertTriangle, Star } from "lucide-react";
import { ItineraryItem, useTripStore } from "@/stores/useTripStore";
import { haversineDistance, formatDistance } from "@/lib/distance";
import EditItemDialog from "./EditItemDialog";

interface ItineraryItemCardProps {
  item: ItineraryItem;
  hasConflict?: boolean;
}

/** Compute match level against global travel preferences stored in profile */
function computeMatch(
  item: ItineraryItem,
  prefs: Record<string, unknown> | null | undefined
): "high" | "partial" | null {
  if (!prefs || Object.keys(prefs).length === 0) return null;
  const meta = (item.api_metadata || {}) as Record<string, unknown>;

  let totalCriteria = 0;
  let matched = 0;

  // Star rating check (stays only)
  const prefStars = Number(prefs.hotelStarRating) || 0;
  if (item.category === "stays" && prefStars > 0) {
    totalCriteria++;
    const itemStars = Number(meta.star_rating || meta.stars || 0);
    if (itemStars >= prefStars) matched++;
  }

  // Review score
  const prefScore = Number(prefs.minReviewScore) || 0;
  if (prefScore > 0) {
    totalCriteria++;
    const itemRating = Number(meta.rating || meta.review_score || 0);
    if (itemRating >= prefScore) matched++;
  }

  // Amenities
  const prefAmenities = (prefs.amenities as string[]) || [];
  if (prefAmenities.length > 0 && item.category === "stays") {
    totalCriteria++;
    const itemAmenities = ((meta.amenities as string[]) || []).map((a: string) =>
      a.toLowerCase()
    );
    const hasAll = prefAmenities.every((a) =>
      itemAmenities.some((ia) => ia.includes(a.toLowerCase()))
    );
    if (hasAll) matched++;
  }

  if (totalCriteria === 0) return null;
  if (matched === totalCriteria) return "high";
  if (matched > 0) return "partial";
  return "partial"; // has criteria but none matched
}

export default function ItineraryItemCard({ item, hasConflict = false }: ItineraryItemCardProps) {
  const [editing, setEditing] = useState(false);
  const activeAnchor = useTripStore((s) => s.activeAnchor);
  const setActiveAnchor = useTripStore((s) => s.setActiveAnchor);
  const activeTrip = useTripStore((s) => s.activeTrip);
  const profile = useTripStore((s) => s.profile);
  const isAnchor = activeAnchor?.id === item.id;

  const distance = useMemo(() => {
    if (!activeAnchor || activeAnchor.id === item.id) return null;
    const aLat = activeAnchor.location_lat;
    const aLng = activeAnchor.location_lng;
    const iLat = item.location_lat;
    const iLng = item.location_lng;
    if (aLat == null || aLng == null || iLat == null || iLng == null) return null;
    return haversineDistance(aLat, aLng, iLat, iLng);
  }, [activeAnchor, item]);

  // Budget alert: item cost exceeds nightly budget target
  const overBudget = useMemo(() => {
    if (!activeTrip?.target_nightly_budget || item.cost == null) return false;
    return Number(item.cost) > Number(activeTrip.target_nightly_budget);
  }, [activeTrip?.target_nightly_budget, item.cost]);

  // Match indicator
  const matchLevel = useMemo(
    () => computeMatch(item, profile?.preferences as Record<string, unknown>),
    [item, profile?.preferences]
  );

  return (
    <>
      <div
        className={`group relative cursor-pointer rounded-sm border-thin px-2 py-1.5 transition-shadow hover:shadow-sm ${isAnchor ? "ring-1 ring-accent" : ""} ${hasConflict ? "border-destructive ring-1 ring-destructive" : "border-border"} bg-card`}
        onClick={() => setEditing(true)}
      >
        {item.category === "stays" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveAnchor(isAnchor ? null : item);
            }}
            className={`absolute right-1 top-1 rounded-sm p-0.5 ${isAnchor ? "text-accent" : "hidden text-muted-foreground/50 hover:text-accent group-hover:block"}`}
          >
            <Anchor className="h-2.5 w-2.5" />
          </button>
        )}
        {item.category !== "stays" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="absolute right-1 top-1 hidden rounded-sm p-0.5 text-muted-foreground/50 hover:text-accent group-hover:block"
          >
            <Pencil className="h-2.5 w-2.5" />
          </button>
        )}
        {hasConflict && (
          <span className="mb-0.5 inline-block rounded-sm bg-destructive/10 px-1 py-0.5 font-inter text-[8px] font-semibold uppercase tracking-wider text-destructive">
            Conflict
          </span>
        )}
        {overBudget && (
          <span className="mb-0.5 ml-0.5 inline-flex items-center gap-0.5 rounded-sm bg-destructive/10 px-1 py-0.5 font-inter text-[8px] font-semibold uppercase tracking-wider text-destructive">
            <AlertTriangle className="h-2 w-2" /> Over Budget
          </span>
        )}
        {item.start_time && (
          <p className="font-inter text-[9px] font-medium text-accent">
            {item.start_time.slice(0, 5)}
          </p>
        )}
        <div className="flex items-center gap-1">
          <p className="truncate font-inter text-[10px] font-medium text-foreground leading-tight">
            {item.title}
          </p>
          {item.source_reference && (
            <a
              href={item.source_reference}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-accent hover:text-accent/80"
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {item.cost != null && item.cost > 0 && (
            <span className="font-inter text-[9px] text-muted-foreground">
              ${Number(item.cost).toLocaleString()}
            </span>
          )}
          {/* Distance Badge */}
          {distance != null && (
            <span className="inline-flex items-center gap-0.5 rounded-sm border-thin border-border bg-background/80 px-1 py-0.5">
              <Navigation className="h-2 w-2 text-accent" />
              <span className="font-inter text-[7px] text-muted-foreground">
                {formatDistance(distance)}
              </span>
            </span>
          )}
          {/* Match Indicator */}
          {matchLevel === "high" && (
            <span className="inline-flex items-center gap-0.5 rounded-sm border-thin border-accent/30 bg-accent/5 px-1 py-0.5">
              <Star className="h-2 w-2 fill-accent text-accent" />
              <span className="font-inter text-[7px] font-medium text-accent">High Match</span>
            </span>
          )}
          {matchLevel === "partial" && (
            <span className="inline-flex items-center gap-0.5 rounded-sm border-thin border-border bg-background/80 px-1 py-0.5">
              <Star className="h-2 w-2 text-muted-foreground" />
              <span className="font-inter text-[7px] text-muted-foreground">Partial</span>
            </span>
          )}
          {/* Suggestive Loyalty Badge */}
          {item.category === "stays" && (
            <span className="inline-flex items-center gap-0.5 rounded-sm border-thin border-border bg-background/80 px-1 py-0.5">
              <CreditCard className="h-2 w-2 text-accent" />
              <span className="font-inter text-[7px] text-muted-foreground">💳 Amex Platinum (5x)</span>
            </span>
          )}
          {item.category === "dining" && (
            <span className="inline-flex items-center gap-0.5 rounded-sm border-thin border-border bg-background/80 px-1 py-0.5">
              <CreditCard className="h-2 w-2 text-accent" />
              <span className="font-inter text-[7px] text-muted-foreground">💳 Sapphire (3x)</span>
            </span>
          )}
        </div>
      </div>

      {editing && (
        <EditItemDialog
          open={editing}
          onOpenChange={setEditing}
          item={item}
        />
      )}
    </>
  );
}
