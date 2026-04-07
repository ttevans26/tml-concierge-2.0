import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { Wifi } from "lucide-react";

interface PublicItem {
  id: string;
  trip_id: string;
  category: string;
  title: string;
  description: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
}

interface PublicTrip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
}

const CATEGORIES = [
  { key: "stays", label: "Stays" },
  { key: "logistics", label: "Logistics" },
  { key: "dining", label: "Dining" },
  { key: "activity", label: "Activity" },
];

const CELL_BG: Record<string, string> = {
  stays: "bg-[hsl(var(--cell-stays))]",
  logistics: "bg-[hsl(var(--cell-logistics))]",
  dining: "bg-[hsl(var(--cell-dining))]",
  activity: "bg-[hsl(var(--cell-activity))]",
};

export default function PublicTripView() {
  const { token } = useParams<{ token: string }>();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [items, setItems] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const fetchData = async (shareToken: string) => {
    // Lookup trip by share_token
    const { data: tripData, error: tripErr } = await supabase
      .from("trips")
      .select("id, name, destination, start_date, end_date, is_published, share_token")
      .eq("share_token", shareToken)
      .eq("is_published", true)
      .single();

    if (tripErr || !tripData) {
      setError("This itinerary is private or does not exist.");
      setLoading(false);
      return;
    }
    setTrip(tripData as PublicTrip);

    // Fetch public items (view strips cost/confirmation)
    const { data: itemsData } = await supabase
      .from("itinerary_items_public")
      .select("*")
      .eq("trip_id", (tripData as any).id)
      .order("sort_order");

    setItems((itemsData as PublicItem[]) || []);
    setLastSync(new Date());
    setLoading(false);
  };

  useEffect(() => {
    if (!token) return;
    fetchData(token);

    // Live sync: poll every 30s
    const interval = setInterval(() => {
      fetchData(token);
    }, 30_000);

    return () => clearInterval(interval);
  }, [token]);

  const days = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return [];
    try {
      return eachDayOfInterval({
        start: parseISO(trip.start_date),
        end: parseISO(trip.end_date),
      });
    } catch {
      return [];
    }
  }, [trip?.start_date, trip?.end_date]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <h1 className="font-playfair text-xl font-semibold text-foreground">Not Available</h1>
        <p className="mt-2 font-inter text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-playfair text-xl font-semibold text-foreground">{trip.name}</h1>
            {trip.destination && (
              <p className="mt-0.5 font-inter text-xs text-muted-foreground">{trip.destination}</p>
            )}
            {days.length > 0 && (
              <p className="mt-1 font-inter text-[11px] text-muted-foreground">
                {format(days[0], "MMM d")} — {format(days[days.length - 1], "MMM d, yyyy")} · {days.length} days
              </p>
            )}
          </div>
          {/* Live Sync Indicator */}
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5">
            <Wifi className="h-3 w-3 text-green-500 animate-pulse" />
            <span className="font-inter text-[9px] font-medium text-muted-foreground">
              Live · {format(lastSync, "h:mm a")}
            </span>
          </div>
        </div>
      </header>

      {/* Read-only Matrix — no cost row, no add/edit/delete */}
      <ScrollArea className="flex-1">
        <div className="flex min-w-max">
          {/* Category labels */}
          <div className="sticky left-0 z-20 w-24 shrink-0 border-r border-border bg-card">
            <div className="sticky top-0 z-30 h-10 border-b border-border bg-card" />
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex h-28 items-center border-b border-border px-3">
                <span className="font-inter text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  {cat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            return (
              <div key={dateStr} className="w-44 shrink-0 border-r border-border last:border-r-0">
                <div className="sticky top-0 z-10 flex h-10 items-center justify-center border-b border-border bg-secondary/40 backdrop-blur-sm">
                  <span className="font-inter text-[11px] font-medium text-foreground">
                    {format(day, "EEE, MMM d")}
                  </span>
                </div>
                {CATEGORIES.map((cat) => {
                  const cellItems = items.filter(
                    (i) => i.date === dateStr && i.category === cat.key
                  );
                  return (
                    <div
                      key={cat.key}
                      className={`flex h-28 flex-col gap-1 border-b border-border p-1.5 overflow-y-auto ${CELL_BG[cat.key] || ""}`}
                    >
                      {cellItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-sm border-thin border-border bg-card px-2 py-1.5"
                        >
                          {item.start_time && (
                            <p className="font-inter text-[9px] font-medium text-accent">
                              {item.start_time.slice(0, 5)}
                            </p>
                          )}
                          <p className="truncate font-inter text-[10px] font-medium text-foreground leading-tight">
                            {item.title}
                          </p>
                          {item.location_name && (
                            <p className="truncate font-inter text-[8px] text-muted-foreground">
                              {item.location_name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
