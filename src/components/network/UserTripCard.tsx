import { Link } from "react-router-dom";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { NetworkTripSummary } from "@/stores/useTripStore";

interface Props {
  trip: NetworkTripSummary;
}

export default function UserTripCard({ trip }: Props) {
  const start = format(parseISO(trip.start_date), "MMM d");
  const end = format(parseISO(trip.end_date), "MMM d, yyyy");

  return (
    <Link
      to={`/network/user/${trip.owner_id}/trip/${trip.id}`}
      className="group flex flex-col gap-3 border-thin border-foreground/15 bg-card p-4 rounded-sm hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-playfair text-base font-semibold text-foreground leading-snug">
          {trip.name}
        </h3>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent" strokeWidth={1.5} />
      </div>

      <div className="flex flex-col gap-1 font-inter text-xs text-muted-foreground">
        {trip.destination && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" strokeWidth={1.5} />
            <span>{trip.destination}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" strokeWidth={1.5} />
          <span>
            {start} – {end}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-foreground/5">
        {(["stays", "dining", "activity", "logistics"] as const).map((cat) => (
          <span
            key={cat}
            className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground border-thin border-foreground/10 px-1.5 py-0.5 rounded-sm"
          >
            {trip.item_counts[cat]} {cat}
          </span>
        ))}
      </div>
    </Link>
  );
}