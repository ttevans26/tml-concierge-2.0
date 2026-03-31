import { useState, useMemo } from "react";
import { Pencil, ExternalLink, Anchor, CreditCard, Navigation } from "lucide-react";
import { ItineraryItem, useTripStore } from "@/stores/useTripStore";
import { haversineDistance, formatDistance } from "@/lib/distance";
import EditItemDialog from "./EditItemDialog";

interface ItineraryItemCardProps {
  item: ItineraryItem;
  hasConflict?: boolean;
}

export default function ItineraryItemCard({ item, hasConflict = false }: ItineraryItemCardProps) {
  const [editing, setEditing] = useState(false);
  const activeAnchor = useTripStore((s) => s.activeAnchor);
  const setActiveAnchor = useTripStore((s) => s.setActiveAnchor);
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

  return (
    <>
      <div
        className={`group relative cursor-pointer rounded-sm border-thin border-border bg-card px-2 py-1.5 transition-shadow hover:shadow-sm ${isAnchor ? "ring-1 ring-accent" : ""}`}
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
