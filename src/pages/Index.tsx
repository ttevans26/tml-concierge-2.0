import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, Calendar, Wallet, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripStore, Trip } from "@/stores/useTripStore";
import { useAuth } from "@/hooks/useAuth";
import CreateTripDialog from "@/components/CreateTripDialog";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";

/* ------------------------------------------------------------------ */
/*  Countdown Widget                                                   */
/* ------------------------------------------------------------------ */

function CountdownPanel({ startDate, endDate }: { startDate?: string | null; endDate?: string | null }) {
  if (!startDate) {
    return (
      <div className="flex w-20 shrink-0 flex-col items-center justify-center border-l-thin border-border bg-secondary/60 px-2 py-4 sm:w-24">
        <span className="font-playfair text-2xl font-semibold text-muted-foreground">—</span>
        <span className="mt-1 text-center font-inter text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[9px]">
          No Date Set
        </span>
      </div>
    );
  }

  const today = startOfDay(new Date());
  const start = startOfDay(new Date(startDate));
  const end = endDate ? startOfDay(new Date(endDate)) : start;

  const daysUntil = differenceInCalendarDays(start, today);
  const daysAfterEnd = differenceInCalendarDays(today, end);

  // Concluded
  if (daysAfterEnd > 0) {
    return (
      <div className="flex w-20 shrink-0 flex-col items-center justify-center border-l-thin border-border bg-muted/70 px-2 py-4 sm:w-24">
        <span className="font-playfair text-xl font-semibold text-muted-foreground sm:text-2xl">✓</span>
        <span className="mt-1 text-center font-inter text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[9px]">
          Concluded
        </span>
      </div>
    );
  }

  // Active
  if (daysUntil <= 0 && daysAfterEnd <= 0) {
    return (
      <div className="flex w-20 shrink-0 flex-col items-center justify-center border-l-thin border-[hsl(140_30%_55%/0.4)] bg-[hsl(140_30%_92%)] px-2 py-4 sm:w-24">
        <span className="h-2 w-2 rounded-full bg-[hsl(140_45%_45%)]" />
        <span className="mt-2 text-center font-playfair text-base font-bold text-[hsl(140_35%_25%)] sm:text-lg">
          Active
        </span>
        <span className="mt-1 text-center font-inter text-[8px] font-semibold uppercase tracking-[0.12em] text-[hsl(140_35%_30%)] sm:text-[9px]">
          In Progress
        </span>
      </div>
    );
  }

  // Upcoming — Hero panel
  return (
    <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-accent px-2 py-4 text-accent-foreground sm:w-24">
      <span className="font-playfair text-3xl font-bold leading-none tracking-tight sm:text-4xl">
        {daysUntil}
      </span>
      <span className="mt-2 text-center font-inter text-[8px] font-semibold uppercase leading-tight tracking-[0.12em] sm:text-[9px]">
        Days to<br />Departure
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trip Card                                                          */
/* ------------------------------------------------------------------ */

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const dateRange =
    trip.start_date && trip.end_date
      ? `${format(new Date(trip.start_date), "MMM d")} — ${format(new Date(trip.end_date), "MMM d, yyyy")}`
      : trip.start_date
        ? `From ${format(new Date(trip.start_date), "MMM d, yyyy")}`
        : null;

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer overflow-hidden rounded-sm border-thin border-border bg-card transition-shadow hover:shadow-md"
    >
      {/* Left — Trip Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-5 sm:p-6">
        <div className="min-w-0">
          <h3 className="truncate font-playfair text-lg font-semibold leading-snug text-foreground">
            {trip.name}
          </h3>

          {trip.destination && (
            <p className="mt-2 flex items-center gap-1.5 font-inter text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
              <span className="truncate">{trip.destination}</span>
            </p>
          )}

          {dateRange && (
            <p className="mt-1.5 flex items-center gap-1.5 font-inter text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
              <span className="truncate">{dateRange}</span>
            </p>
          )}
        </div>

        {trip.total_trip_budget != null && (
          <p className="mt-4 flex items-center gap-1.5 font-inter text-sm font-medium text-foreground">
            <Wallet className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
            ${Number(trip.total_trip_budget).toLocaleString()}
          </p>
        )}
      </div>

      {/* Right — Countdown Hero Panel */}
      <CountdownPanel startDate={trip.start_date} endDate={trip.end_date} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-24 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border-thin border-border bg-secondary">
        <MapPin className="h-6 w-6 text-accent" strokeWidth={1.5} />
      </div>
      <h2 className="font-playfair text-2xl font-semibold text-foreground">
        No journeys yet
      </h2>
      <p className="mt-3 font-inter text-sm text-muted-foreground leading-relaxed">
        Start planning your next experience —&nbsp;every great trip begins with a single step.
      </p>
      <Button
        onClick={onNew}
        className="mt-8 bg-accent text-accent-foreground font-inter text-sm hover:bg-accent/90"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        New Journey
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { trips, loading, fetchTrips } = useTripStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTrips();
    }
  }, [authLoading, user, fetchTrips]);

  return (
    <div className="px-6 py-10 md:px-12 lg:px-20">
      {/* Header */}
      <header className="mb-12 flex items-end justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Your Trips
          </h1>
        </div>

        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-accent text-accent-foreground font-inter text-sm hover:bg-accent/90"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Journey
        </Button>
      </header>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-sm" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState onNew={() => setDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/trip/${trip.id}`)} />
          ))}
        </div>
      )}

      <CreateTripDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
