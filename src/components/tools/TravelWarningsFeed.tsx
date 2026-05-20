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
    <section className="bg-card border-thin border-foreground/80 rounded-sm p-6 md:p-8">
      <header className="mb-6">
        <p className="font-inter text-[11px] tracking-[0.22em] text-muted-foreground uppercase mb-2">
          Real-Time Advisories
        </p>
        <h2 className="font-playfair text-2xl text-foreground">Travel Warnings</h2>
        <p className="font-inter text-sm text-muted-foreground mt-2 max-w-prose">
          Notices filtered against this trip&apos;s destinations and dates.
        </p>
      </header>

      {filtered.length === 0 ? (
        <p className="font-playfair italic text-foreground/60 py-6">
          No active advisories for this itinerary.
        </p>
      ) : (
        <ul className="space-y-5">
          {filtered.map((w) => {
            const accent =
              w.severity === "advisory" ? "border-warning-amber" : "border-warning-forest";
            return (
              <li
                key={w.id}
                className={`border-l-2 ${accent} pl-4 py-1`}
              >
                <p className="font-inter text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  {CATEGORY_LABEL[w.category]}
                </p>
                <h3 className="font-playfair text-lg text-foreground mt-1 leading-snug">
                  {w.title}
                </h3>
                <p className="font-inter text-sm text-foreground/75 mt-2 leading-relaxed">
                  {w.body}
                </p>
                <p className="font-inter text-[11px] tracking-wide text-muted-foreground mt-3">
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
