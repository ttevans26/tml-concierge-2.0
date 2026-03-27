import { ItineraryItem } from "@/stores/useTripStore";

interface ItineraryItemCardProps {
  item: ItineraryItem;
}

export default function ItineraryItemCard({ item }: ItineraryItemCardProps) {
  return (
    <div className="rounded-sm border-thin border-border bg-card px-2 py-1.5 transition-shadow hover:shadow-sm">
      {item.start_time && (
        <p className="font-inter text-[9px] font-medium text-accent">
          {item.start_time.slice(0, 5)}
        </p>
      )}
      <p className="truncate font-inter text-[10px] font-medium text-foreground leading-tight">
        {item.title}
      </p>
      {item.cost != null && item.cost > 0 && (
        <p className="mt-0.5 font-inter text-[9px] text-muted-foreground">
          ${Number(item.cost).toLocaleString()}
        </p>
      )}
    </div>
  );
}
