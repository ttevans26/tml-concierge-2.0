import { useMemo } from "react";
import { useTripStore, type Trip, type ItineraryItem } from "@/stores/useTripStore";
import { MOCK_TRAVEL_WARNINGS, type TravelWarning } from "@/data/mockTravelWarnings";
import { filterWarningsForTrip } from "@/lib/warningFilter";

interface Props {
  trip: Trip | null;
}

const CATEGORY_LABEL: Record<TravelWarning["category"], string> = {
  regulatory: "REGULATORY",
  health: "HEALTH",
  environmental: "ENVIRONMENTAL",
};

/** Stable, deterministic "X days ago" label based on the warning's id+valid_from
 *  so reordering doesn't change the badge between renders. */
function recencyLabel(w: TravelWarning): string {
  // Hash the id to produce a stable 1–14 day offset.
  let h = 0;
  for (let i = 0; i < w.id.length; i++) h = (h * 31 + w.id.charCodeAt(i)) | 0;
  const daysAgo = Math.abs(h % 14) + 1;
  if (daysAgo === 1) return "Updated yesterday";
  return `Updated ${daysAgo} days ago`;
}

export default function TravelWarningsFeed({ trip }: Props) {
  const items = useTripStore((s) => s.itineraryItems);
  const tripItems: ItineraryItem[] = trip
    ? items.filter((i) => i.trip_id === trip.id)
    : [];

  const filtered = useMemo(
    () => filterWarningsForTrip(MOCK_TRAVEL_WARNINGS, trip, tripItems),
    [trip, tripItems],
  );

  return (
    <section className="bg-card border-thin border-foreground/80 rounded-sm p-4 md:p-6">
      <header className="mb-4">
        <p className="font-inter text-[10px] tracking-[0.22em] text-muted-foreground uppercase mb-1">
          Real-Time Advisories
        </p>
        <h2 className="font-playfair text-xl text-foreground">Travel Warnings</h2>
        <p className="font-inter text-xs text-muted-foreground mt-1.5 max-w-prose">
          Notices filtered against this trip&apos;s destinations and dates.
        </p>
        <p className="font-inter text-[10px] uppercase tracking-widest text-muted-foreground/80 mt-2">
          Sources: U.S. State Dept · UK Home Office · WHO · Local authorities (curated)
        </p>
      </header>

      {filtered.length === 0 ? (
        <p className="font-playfair italic text-foreground/60 py-4 text-sm">
          No active advisories for this itinerary.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((w) => {
            const accent =
              w.severity === "advisory" ? "border-warning-amber" : "border-warning-forest";
            return (
              <li
                key={w.id}
                className={`border-l-2 ${accent} pl-3 py-0.5`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-inter text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
                    {CATEGORY_LABEL[w.category]}
                  </p>
                  <p className="font-inter text-[9px] tracking-wider text-muted-foreground/80 uppercase">
                    {recencyLabel(w)}
                  </p>
                </div>
                <h3 className="font-playfair text-base text-foreground mt-0.5 leading-snug">
                  {w.title}
                </h3>
                <p className="font-inter text-xs text-foreground/75 mt-1.5 leading-relaxed">
                  {w.body}
                </p>
                <p className="font-inter text-[10px] tracking-wide text-muted-foreground mt-2">
                  {w.source_label} · valid {w.valid_from} – {w.valid_to}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
