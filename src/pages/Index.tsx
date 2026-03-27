import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, Calendar, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripStore, Trip } from "@/stores/useTripStore";
import { useAuth } from "@/hooks/useAuth";
import CreateTripDialog from "@/components/CreateTripDialog";
import { format } from "date-fns";

/* ------------------------------------------------------------------ */
/*  Trip Card                                                          */
/* ------------------------------------------------------------------ */

function TripCard({ trip }: { trip: Trip }) {
  const dateRange =
    trip.start_date && trip.end_date
      ? `${format(new Date(trip.start_date), "MMM d")} — ${format(new Date(trip.end_date), "MMM d, yyyy")}`
      : trip.start_date
        ? `From ${format(new Date(trip.start_date), "MMM d, yyyy")}`
        : null;

  return (
    <div className="group flex flex-col justify-between rounded-sm border-thin border-border bg-card p-6 transition-shadow hover:shadow-md">
      <div>
        <h3 className="font-playfair text-lg font-semibold text-foreground leading-snug">
          {trip.name}
        </h3>

        {trip.destination && (
          <p className="mt-2 flex items-center gap-1.5 font-inter text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            {trip.destination}
          </p>
        )}

        {dateRange && (
          <p className="mt-1.5 flex items-center gap-1.5 font-inter text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            {dateRange}
          </p>
        )}
      </div>

      {trip.total_trip_budget != null && (
        <p className="mt-4 flex items-center gap-1.5 font-inter text-sm font-medium text-foreground">
          <Wallet className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          ${Number(trip.total_trip_budget).toLocaleString()}
        </p>
      )}
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
  const { user, signOut } = useAuth();
  const { trips, loading, fetchTrips } = useTripStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  return (
    <div className="min-h-screen bg-background px-6 py-10 md:px-12 lg:px-20">
      {/* Header */}
      <header className="mb-12 flex items-end justify-between">
        <div>
          <p className="mb-1 font-inter text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            TML Concierge
          </p>
          <h1 className="font-playfair text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Your Trips
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-accent text-accent-foreground font-inter text-sm hover:bg-accent/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Journey
          </Button>
          <Button
            variant="ghost"
            onClick={signOut}
            className="font-inter text-xs text-muted-foreground"
          >
            Sign out
          </Button>
        </div>
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
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}

      <CreateTripDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
