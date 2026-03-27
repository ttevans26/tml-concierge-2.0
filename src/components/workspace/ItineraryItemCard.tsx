import { useState } from "react";
import { Pencil, ExternalLink } from "lucide-react";
import { ItineraryItem } from "@/stores/useTripStore";
import EditItemDialog from "./EditItemDialog";

interface ItineraryItemCardProps {
  item: ItineraryItem;
}

export default function ItineraryItemCard({ item }: ItineraryItemCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div
        className="group relative cursor-pointer rounded-sm border-thin border-border bg-card px-2 py-1.5 transition-shadow hover:shadow-sm"
        onClick={() => setEditing(true)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="absolute right-1 top-1 hidden rounded-sm p-0.5 text-muted-foreground/50 hover:text-accent group-hover:block"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
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
        {item.cost != null && item.cost > 0 && (
          <p className="mt-0.5 font-inter text-[9px] text-muted-foreground">
            ${Number(item.cost).toLocaleString()}
          </p>
        )}
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
