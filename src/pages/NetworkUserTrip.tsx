import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, EyeOff } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useTripStore } from "@/stores/useTripStore";
import ReadOnlyMatrixGrid from "@/components/network/ReadOnlyMatrixGrid";

export default function NetworkUserTrip() {
  const { id, tripId } = useParams<{ id: string; tripId: string }>();
  const user = useTripStore((s) => s.networkUsers.find((u) => u.id === id));
  const trip = useTripStore((s) =>
    id && tripId ? (s.networkUserTrips[id] ?? []).find((t) => t.id === tripId) : undefined,
  );
  const items = useTripStore((s) => (tripId ? s.networkTripItems[tripId] ?? [] : []));

  const canView = user && (user.is_public || user.status === "connected");

  if (!user || !trip || !canView) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <Link
          to={id ? `/network/user/${id}` : "/network"}
          className="inline-flex items-center gap-1 font-inter text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Back
        </Link>
        <p className="mt-6 font-inter text-sm text-muted-foreground">
          This itinerary isn't available to you.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to={`/network/user/${user.id}`}
          className="inline-flex items-center gap-1 font-inter text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Back to {user.name}
        </Link>

        <header className="border-thin border-foreground/15 bg-card p-5 rounded-sm sm:p-6">
          <p className="font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
            Shared by {user.name}
          </p>
          <h1 className="mt-1 font-playfair text-2xl font-semibold text-foreground sm:text-3xl">
            {trip.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 font-inter text-xs text-muted-foreground">
            {trip.destination && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3 w-3" strokeWidth={1.5} />
                {trip.destination}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3 w-3" strokeWidth={1.5} />
              {format(parseISO(trip.start_date), "MMM d")} – {format(parseISO(trip.end_date), "MMM d, yyyy")}
            </span>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 border-thin border-accent/40 bg-accent/5 px-3 py-1.5 rounded-sm">
            <EyeOff className="h-3 w-3 text-accent" strokeWidth={1.5} />
            <span className="font-inter text-[11px] text-accent">
              Viewing as guest — financial details, booking codes, and points are hidden.
            </span>
          </div>
        </header>

        <section className="mt-6">
          <ReadOnlyMatrixGrid trip={trip} items={items} />
        </section>
      </div>
    </div>
  );
}