import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Plus } from "lucide-react";
import { useTripStore } from "@/stores/useTripStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import PreparednessChecklist from "@/components/tools/PreparednessChecklist";
import TravelWarningsFeed from "@/components/tools/TravelWarningsFeed";
import UpcomingAppointments from "@/components/tools/UpcomingAppointments";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SeoHead from "@/components/SeoHead";

export default function Tools() {
  const { user } = useAuth();
  const trips = useTripStore((s) => s.trips);
  const activeTrip = useTripStore((s) => s.activeTrip);
  const fetchTrips = useTripStore((s) => s.fetchTrips);
  const fetchItineraryItems = useTripStore((s) => s.fetchItineraryItems);

  useEffect(() => {
    if (user && trips.length === 0) fetchTrips();
  }, [user, trips.length, fetchTrips]);

  // Default: activeTrip, else next upcoming, else first.
  const defaultTripId = useMemo(() => {
    if (activeTrip) return activeTrip.id;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = trips
      .filter((t) => t.start_date && t.start_date >= today)
      .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0];
    return upcoming?.id ?? trips[0]?.id ?? "";
  }, [trips, activeTrip]);

  const [tripId, setTripId] = useState<string>(defaultTripId);
  useEffect(() => {
    if (!tripId && defaultTripId) setTripId(defaultTripId);
  }, [defaultTripId, tripId]);

  const selectedTrip = trips.find((t) => t.id === tripId) ?? null;

  useEffect(() => {
    if (tripId) fetchItineraryItems(tripId);
  }, [tripId, fetchItineraryItems]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 md:py-6">
      <SeoHead
        title="Concierge Tools — TML Concierge"
        description="Preparedness checklist, travel advisories, and upcoming appointments — filtered against your active trip."
        path="/tools"
        noindex
      />
      <header className="mb-6 md:mb-8">
        <p className="font-inter text-[10px] tracking-[0.24em] text-muted-foreground uppercase mb-2">
          Concierge Tools
        </p>
        <h1 className="font-playfair text-2xl md:text-4xl text-foreground mb-2">
          Preparedness &amp; Advisories
        </h1>
        <p className="font-inter text-xs md:text-sm text-muted-foreground max-w-2xl">
          Pre-departure logistics and real-time intelligence, filtered against your active itinerary.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className="font-inter text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
            Trip
          </span>
          <Select value={tripId} onValueChange={setTripId}>
            <SelectTrigger className="w-[280px] max-w-full rounded-sm border-thin border-foreground/60 bg-background h-10 font-inter text-sm">
              <SelectValue placeholder="Select a trip" />
            </SelectTrigger>
            <SelectContent>
              {trips.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No trips yet
                </SelectItem>
              ) : (
                trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.destination ? ` · ${t.destination}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </header>

      {trips.length === 0 ? (
        <div className="rounded-sm border-thin border-foreground/30 bg-card px-6 py-10 text-center">
          <Compass className="mx-auto h-6 w-6 text-accent" strokeWidth={1.5} />
          <h2 className="mt-3 font-playfair text-lg text-foreground">
            No trips to prepare for — yet.
          </h2>
          <p className="mx-auto mt-1 max-w-md font-inter text-xs text-muted-foreground">
            Preparedness checklists, travel advisories, and appointment surfacing all rely on an
            active itinerary. Create your first trip to unlock these tools.
          </p>
          <Button asChild size="sm" className="mt-4 rounded-[2px] font-inter text-xs">
            <Link to="/">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create a trip
            </Link>
          </Button>
        </div>
      ) : (
        <UpcomingAppointments />
      )}

      {trips.length > 0 && <div className="border-t-thin border-foreground/15 mb-6" />}

      {trips.length === 0 ? null : !selectedTrip ? (
        <div className="border-thin border-foreground/40 rounded-sm p-6 text-center">
          <p className="font-playfair italic text-foreground/70">
            Select a trip to surface tailored preparedness and advisories.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
          <div className="md:col-span-3">
            <PreparednessChecklist trip={selectedTrip} />
          </div>
          <div className="md:col-span-2">
            <TravelWarningsFeed trip={selectedTrip} />
          </div>
        </div>
      )}
    </div>
  );
}
