import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, Calendar, Wallet, ChevronUp, ChevronDown, MoreHorizontal, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripStore, Trip } from "@/stores/useTripStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import CreateTripDialog from "@/components/CreateTripDialog";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { buildRouteWithGeocoding, type Waypoint } from "@/lib/tripRoute";
import TripRouteMap from "@/components/trips/TripRouteMap";

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
  const navigate = useNavigate();
  const duplicateTrip = useTripStore((s) => s.duplicateTrip);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDuplicate = async () => {
    setBusy(true);
    const copy = await duplicateTrip(trip.id);
    setBusy(false);
    if (copy) {
      toast.success(`Duplicated "${trip.name}"`);
      navigate(`/trip/${copy.id}`);
    } else {
      toast.error("Could not duplicate trip");
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    await deleteTrip(trip.id);
    setBusy(false);
    setConfirmDelete(false);
    toast.success(`Deleted "${trip.name}"`);
  };

  const dateRange =
    trip.start_date && trip.end_date
      ? `${format(new Date(trip.start_date), "MMM d")} — ${format(new Date(trip.end_date), "MMM d, yyyy")}`
      : trip.start_date
        ? `From ${format(new Date(trip.start_date), "MMM d, yyyy")}`
        : null;

  const [waypoints, setWaypoints] = useState<Waypoint[] | null>(null);
  const [mapOpen, setMapOpen] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("itinerary_items")
          .select("*")
          .eq("trip_id", trip.id)
          .order("sort_order");
        if (cancelled) return;
        if (error || !data) {
          setWaypoints([]);
          return;
        }
        const wps = await buildRouteWithGeocoding(data as any, trip.destination);
        if (!cancelled) setWaypoints(wps);
      } catch (err) {
        console.error("Route build failed", err);
        if (!cancelled) setWaypoints([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trip.id, trip.destination]);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-editorial border border-foil bg-surface-2 shadow-paper transition-all duration-soft ease-editorial hover:-translate-y-0.5 hover:shadow-raised">
      {/* Actions menu */}
      <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
              disabled={busy}
              aria-label="Trip actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDuplicate} disabled={busy}>
              <Copy className="mr-2 h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{trip.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the trip and all its itinerary items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex">
        <div
          onClick={onClick}
          className="flex min-w-0 flex-1 cursor-pointer flex-col justify-between p-5 sm:p-6"
        >
        <div className="min-w-0">
          <h2 className="truncate font-playfair text-lg font-semibold leading-snug text-foreground">
            {trip.name}
          </h2>

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

      {/* Collapse / expand bar */}
      <button
        type="button"
        onClick={() => setMapOpen((v) => !v)}
        className="flex items-center justify-between gap-2 border-t-thin border-border bg-secondary/40 px-5 py-2 text-left font-inter text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground hover:bg-secondary"
        aria-expanded={mapOpen}
      >
        <span className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          Route map
        </span>
        {mapOpen ? (
          <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
        )}
      </button>

      {mapOpen && (
        <TripRouteMap
          waypoints={waypoints ?? []}
          fallbackQuery={
            waypoints && waypoints.length === 0 ? trip.destination ?? null : null
          }
          isLoading={waypoints === null}
          height={420}
        />
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const trips = useTripStore((s) => s.trips);
  const loading = useTripStore((s) => s.loading);
  const fetchTrips = useTripStore((s) => s.fetchTrips);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTrips();
    }
  }, [authLoading, user, fetchTrips]);

  return (
    <div className="px-6 py-12 md:px-12 lg:px-20">
      {/* Header */}
      <header className="mb-14 flex flex-wrap items-end justify-between gap-6 border-b border-foil pb-8">
        <div>
          <p className="font-inter text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
            The Studio · {format(new Date(), "MMMM yyyy")}
          </p>
          <h1 className="mt-2 font-display-xl text-ink">
            Your <span className="italic-accent text-accent">journeys</span>
          </h1>
          <p className="mt-3 max-w-xl font-inter text-[13px] leading-relaxed text-muted-foreground">
            Quiet luxury, considered itineraries, and a strategic eye on every point. Continue where you left off, or begin a new chapter.
          </p>
        </div>

        <Button
          variant="premium"
          onClick={() => setDialogOpen(true)}
          className="font-inter text-sm"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Journey
        </Button>
      </header>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[480px] rounded-sm" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState onNew={() => setDialogOpen(true)} />
      ) : (
        <div className="mx-auto flex max-w-4xl flex-col gap-10">
          {[...trips]
            .sort((a, b) => {
              const ad = a.start_date ?? "9999-12-31";
              const bd = b.start_date ?? "9999-12-31";
              return ad.localeCompare(bd);
            })
            .map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onClick={() => navigate(`/trip/${trip.id}`)}
              />
            ))}
        </div>
      )}

      <CreateTripDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
