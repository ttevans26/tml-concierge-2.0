import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isToday, isTomorrow, isWithinInterval, addDays, startOfDay } from "date-fns";
import { Calendar, Clock, MapPin, Plane, Hotel, UtensilsCrossed, Sparkles } from "lucide-react";
import { useTripStore, type ItineraryItem } from "@/stores/useTripStore";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus, openInMaps } from "@/lib/native";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<string, typeof Hotel> = {
  stays: Hotel,
  logistics: Plane,
  dining: UtensilsCrossed,
  activity: Sparkles,
  sites_of_interest: MapPin,
};

function pickActiveTrip(trips: ReturnType<typeof useTripStore.getState>["trips"]) {
  const now = startOfDay(new Date());
  const active = trips.find((t) => {
    if (!t.start_date || !t.end_date) return false;
    try {
      return isWithinInterval(now, {
        start: parseISO(t.start_date),
        end: parseISO(t.end_date),
      });
    } catch {
      return false;
    }
  });
  if (active) return active;
  // Otherwise, next upcoming trip
  const upcoming = [...trips]
    .filter((t) => t.start_date)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1));
  return upcoming[0] || null;
}

function ItemRow({ item }: { item: ItineraryItem }) {
  const Icon = CATEGORY_ICON[item.category] ?? MapPin;
  return (
    <button
      type="button"
      onClick={() =>
        openInMaps({
          google_place_id: item.google_place_id,
          lat: item.location_lat,
          lng: item.location_lng,
          query: item.location_name || item.title,
        })
      }
      className="flex w-full items-start gap-3 rounded-sm border-thin border-border bg-card px-3 py-3 text-left transition-colors hover:border-accent/60"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-accent/10 text-accent">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-playfair text-sm font-semibold text-foreground">
          {item.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-inter text-[11px] text-muted-foreground">
          {item.start_time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.5} />
              {item.start_time.slice(0, 5)}
              {item.end_time ? ` – ${item.end_time.slice(0, 5)}` : ""}
            </span>
          )}
          {item.location_name && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" strokeWidth={1.5} />
              <span className="truncate">{item.location_name}</span>
            </span>
          )}
        </div>
        {item.confirmation_code && (
          <p className="mt-1 font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
            Conf · {item.confirmation_code}
          </p>
        )}
      </div>
    </button>
  );
}

function DaySection({ label, date, items }: { label: string; date: string; items: ItineraryItem[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-playfair text-lg font-semibold text-foreground">{label}</h2>
        <span className="font-inter text-[11px] uppercase tracking-wider text-muted-foreground">
          {format(parseISO(date), "EEE MMM d")}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-sm border-thin border-dashed border-border px-3 py-4 text-center font-inter text-xs text-muted-foreground">
          Nothing scheduled.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <ItemRow key={i.id} item={i} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Today() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { trips, itineraryItems, fetchTrips, fetchItineraryItems } = useTripStore();

  useEffect(() => {
    if (!authLoading && user) fetchTrips();
  }, [authLoading, user, fetchTrips]);

  const trip = useMemo(() => pickActiveTrip(trips), [trips]);

  useEffect(() => {
    if (trip) fetchItineraryItems(trip.id);
  }, [trip, fetchItineraryItems]);

  const { todayItems, tomorrowItems, todayIso, tomorrowIso } = useMemo(() => {
    const t = startOfDay(new Date());
    const tm = addDays(t, 1);
    const isoT = format(t, "yyyy-MM-dd");
    const isoTm = format(tm, "yyyy-MM-dd");
    const ofTrip = itineraryItems.filter((i) => trip && i.trip_id === trip.id && i.date);
    const sortByTime = (a: ItineraryItem, b: ItineraryItem) =>
      (a.start_time || "00:00").localeCompare(b.start_time || "00:00");
    return {
      todayItems: ofTrip.filter((i) => i.date === isoT).sort(sortByTime),
      tomorrowItems: ofTrip.filter((i) => i.date === isoTm).sort(sortByTime),
      todayIso: isoT,
      tomorrowIso: isoTm,
    };
  }, [itineraryItems, trip]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="font-inter text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {format(new Date(), "EEEE, MMM d")}
        </p>
        <h1 className="mt-1 font-playfair text-3xl font-bold tracking-tight text-foreground">
          Today
        </h1>
        {trip ? (
          <button
            type="button"
            onClick={() => navigate(`/trip/${trip.id}`)}
            className="mt-2 inline-flex items-center gap-1.5 font-inter text-xs text-accent hover:underline"
          >
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
            {trip.name}
            {trip.destination ? ` · ${trip.destination}` : ""}
          </button>
        ) : (
          <p className="mt-2 font-inter text-xs text-muted-foreground">
            No active trip. {online ? "Create one to get started." : "Reconnect to sync."}
          </p>
        )}
      </header>

      {trip && (
        <div className="space-y-6">
          <DaySection label="Today" date={todayIso} items={todayItems} />
          <DaySection label="Tomorrow" date={tomorrowIso} items={tomorrowItems} />
        </div>
      )}
    </div>
  );
}

// (unused import guards — keep tree-shaker happy in some bundlers)
export const __TODAY_DATE_HELPERS__ = { isToday, isTomorrow };