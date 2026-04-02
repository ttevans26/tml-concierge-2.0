import { Check, X, ExternalLink, Plane, Hotel, UtensilsCrossed, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ExtractedItem {
  id: string;
  title: string;
  category: "stays" | "logistics" | "dining" | "activity";
  date?: string;
  start_time?: string;
  end_time?: string;
  description?: string;
  confirmation_code?: string;
  flight_number?: string;
  departure_airport?: string;
  arrival_airport?: string;
  location_name?: string;
  estimated_cost?: number;
  currency?: string;
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  stays: <Hotel className="h-3.5 w-3.5" />,
  logistics: <Plane className="h-3.5 w-3.5" />,
  dining: <UtensilsCrossed className="h-3.5 w-3.5" />,
  activity: <MapPin className="h-3.5 w-3.5" />,
};

const CATEGORY_LABEL: Record<string, string> = {
  stays: "Stay",
  logistics: "Logistics",
  dining: "Dining",
  activity: "Activity",
};

interface SmartPullTrayProps {
  items: ExtractedItem[];
  onAccept: (item: ExtractedItem) => void;
  onDismiss: (itemId: string) => void;
  acceptingIds: Set<string>;
}

export default function SmartPullTray({ items, onAccept, onDismiss, acceptingIds }: SmartPullTrayProps) {
  if (items.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-border bg-secondary/20 px-4 py-3">
      <p className="mb-2 font-inter text-[11px] font-semibold uppercase tracking-widest text-accent">
        Smart Pull — {items.length} item{items.length !== 1 ? "s" : ""} pending review
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => {
          const accepting = acceptingIds.has(item.id);
          return (
            <div
              key={item.id}
              className="flex w-56 shrink-0 flex-col gap-1.5 rounded-sm border-2 border-dashed border-border bg-card p-3"
            >
              {/* Header */}
              <div className="flex items-center gap-1.5">
                {CATEGORY_ICON[item.category]}
                <Badge variant="outline" className="text-[9px] font-medium uppercase tracking-wider">
                  {CATEGORY_LABEL[item.category] || item.category}
                </Badge>
              </div>

              {/* Title */}
              <span className="font-inter text-xs font-semibold text-foreground leading-tight line-clamp-2">
                {item.title}
              </span>

              {/* Date & times */}
              {item.date && (
                <span className="font-inter text-[10px] text-muted-foreground">
                  {item.date}
                  {item.start_time && ` · ${item.start_time}`}
                  {item.end_time && `–${item.end_time}`}
                </span>
              )}

              {/* Airports */}
              {item.departure_airport && item.arrival_airport && (
                <span className="font-inter text-[10px] text-muted-foreground">
                  {item.departure_airport} → {item.arrival_airport}
                </span>
              )}

              {/* Cost */}
              {item.estimated_cost != null && (
                <span className="font-inter text-[10px] font-medium text-foreground">
                  {item.currency || "USD"} ${item.estimated_cost.toLocaleString()}
                </span>
              )}

              {/* Confirmation code deep link */}
              {item.confirmation_code && (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(item.confirmation_code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-accent underline underline-offset-2 hover:text-accent/80 transition-colors"
                >
                  {item.confirmation_code}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}

              {/* Actions */}
              <div className="mt-1 flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="min-h-[44px] flex-1 text-xs touch-manipulation"
                  onClick={() => onAccept(item)}
                  disabled={accepting}
                >
                  {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] flex-1 text-xs touch-manipulation"
                  onClick={() => onDismiss(item.id)}
                  disabled={accepting}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Dismiss
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
