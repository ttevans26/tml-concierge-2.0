import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Plane } from "lucide-react";
import { format, parseISO, isBefore, isAfter, startOfDay } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTripStore, type Trip } from "@/stores/useTripStore";
import { cn } from "@/lib/utils";

function bucketize(trips: Trip[]) {
  const today = startOfDay(new Date());
  const inProgress: Trip[] = [];
  const upcoming: Trip[] = [];
  const past: Trip[] = [];
  for (const t of trips) {
    if (!t.start_date && !t.end_date) {
      upcoming.push(t);
      continue;
    }
    const start = t.start_date ? parseISO(t.start_date) : null;
    const end = t.end_date ? parseISO(t.end_date) : start;
    if (start && isAfter(start, today)) upcoming.push(t);
    else if (end && isBefore(end, today)) past.push(t);
    else inProgress.push(t);
  }
  const sortAsc = (a: Trip, b: Trip) =>
    (a.start_date ?? "").localeCompare(b.start_date ?? "");
  return {
    inProgress: inProgress.sort(sortAsc),
    upcoming: upcoming.sort(sortAsc),
    past: past.sort((a, b) => sortAsc(b, a)),
  };
}

export default function TripSwitcher() {
  const navigate = useNavigate();
  const trips = useTripStore((s) => s.trips);
  const activeTrip = useTripStore((s) => s.activeTrip);
  const buckets = useMemo(() => bucketize(trips), [trips]);

  if (!activeTrip) return null;

  const fmt = (t: Trip) =>
    t.start_date && t.end_date
      ? `${format(parseISO(t.start_date), "MMM d")}–${format(parseISO(t.end_date), "MMM d")}`
      : t.destination || "—";

  const renderGroup = (label: string, list: Trip[]) =>
    list.length === 0 ? null : (
      <>
        <DropdownMenuLabel className="font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        {list.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => navigate(`/trip/${t.id}`)}
            className="flex items-start gap-2 py-1.5"
          >
            <Check
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0",
                t.id === activeTrip.id ? "text-accent" : "text-transparent",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-playfair text-[13px] font-medium text-foreground">
                {t.name}
              </p>
              <p className="truncate font-inter text-[10px] text-muted-foreground">
                {fmt(t)}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
      </>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex min-w-0 items-center gap-2 rounded-[2px] px-2 py-1 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <div className="min-w-0">
            <h1 className="truncate font-playfair text-base font-semibold leading-tight text-foreground">
              {activeTrip.name}
            </h1>
            {activeTrip.destination && (
              <p className="truncate font-inter text-[11px] text-muted-foreground">
                {activeTrip.destination}
              </p>
            )}
          </div>
          <ChevronsUpDown
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            strokeWidth={1.5}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {trips.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-3 text-muted-foreground">
            <Plane className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="font-inter text-xs">No trips yet.</span>
          </div>
        ) : (
          <>
            {renderGroup("In progress", buckets.inProgress)}
            {renderGroup("Upcoming", buckets.upcoming)}
            {renderGroup("Past", buckets.past)}
            <DropdownMenuItem
              onSelect={() => navigate("/")}
              className="font-inter text-[11px] text-muted-foreground"
            >
              All trips →
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}