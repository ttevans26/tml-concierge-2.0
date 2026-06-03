import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isWithinInterval, addDays, startOfDay, differenceInCalendarDays } from "date-fns";
import { Calendar, Clock, MapPin, Plane, Hotel, UtensilsCrossed, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
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
    const ofTrip = itineraryItems.filter(
      (i) => trip && i.trip_id === trip.id && i.date && i.approval_status !== "cancelled",
    );
    const sortByTime = (a: ItineraryItem, b: ItineraryItem) =>
      (a.start_time || "00:00").localeCompare(b.start_time || "00:00");
    return {
      todayItems: ofTrip.filter((i) => i.date === isoT).sort(sortByTime),
      tomorrowItems: ofTrip.filter((i) => i.date === isoTm).sort(sortByTime),
      todayIso: isoT,
      tomorrowIso: isoTm,
    };
  }, [itineraryItems, trip]);

  // Day X of Y for in-progress trips
  const dayCounter = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return null;
    try {
      const start = parseISO(trip.start_date);
      const end = parseISO(trip.end_date);
      const t = startOfDay(new Date());
      if (!isWithinInterval(t, { start, end })) return null;
      const dayNum = differenceInCalendarDays(t, start) + 1;
      const total = differenceInCalendarDays(end, start) + 1;
      return { dayNum, total };
    } catch {
      return null;
    }
  }, [trip]);

  // Next Up — next non-past item across today
  const nextUp = useMemo(() => {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    return todayItems.find((i) => {
      if (!i.start_time) return false;
      const [h, m] = i.start_time.split(":").map(Number);
      return h * 60 + m >= nowMin;
    });
  }, [todayItems]);

  // Cancellation-deadline warnings (within 72h)
  const deadlineWarnings = useMemo(() => {
    if (!trip) return [] as ItineraryItem[];
    const now = new Date();
    const horizon = addDays(now, 3);
    return itineraryItems
      .filter(
        (i) =>
          i.trip_id === trip.id &&
          i.cancellation_deadline &&
          new Date(i.cancellation_deadline) <= horizon &&
          new Date(i.cancellation_deadline) >= now &&
          i.approval_status !== "cancelled",
      )
      .sort((a, b) =>
        (a.cancellation_deadline || "").localeCompare(b.cancellation_deadline || ""),
      );
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
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => navigate(`/trip/${trip.id}`)}
              className="inline-flex items-center gap-1.5 font-inter text-xs text-accent hover:underline"
            >
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
              {trip.name}
              {trip.destination ? ` · ${trip.destination}` : ""}
            </button>
            {dayCounter && (
              <span className="rounded-[2px] border border-border bg-secondary/40 px-1.5 py-0.5 font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
                Day {dayCounter.dayNum} of {dayCounter.total}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 font-inter text-xs text-muted-foreground">
            No active trip. {online ? "Create one to get started." : "Reconnect to sync."}
          </p>
        )}
      </header>

      {trip && (
        <div className="space-y-6">
          {nextUp && (
            <section className="rounded-sm border border-accent/40 bg-accent/5 px-3 py-3">
              <p className="font-inter text-[10px] uppercase tracking-widest text-accent">
                Next up
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-playfair text-base font-semibold text-foreground">
                    {nextUp.title}
                  </p>
                  <p className="mt-0.5 font-inter text-[11px] text-muted-foreground">
                    {nextUp.start_time?.slice(0, 5)}
                    {nextUp.location_name ? ` · ${nextUp.location_name}` : ""}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
              </div>
            </section>
          )}

          {deadlineWarnings.length > 0 && (
            <section className="rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2.5">
              <div className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                {deadlineWarnings.length} cancellation deadline
                {deadlineWarnings.length === 1 ? "" : "s"} within 72 hours
              </div>
              <ul className="mt-1.5 space-y-0.5 font-inter text-[11px] text-foreground/80">
                {deadlineWarnings.slice(0, 3).map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{w.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {format(new Date(w.cancellation_deadline!), "MMM d")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <DaySection label="Today" date={todayIso} items={todayItems} />
          <DaySection label="Tomorrow" date={tomorrowIso} items={tomorrowItems} />
        </div>
      )}
    </div>
  );
}
