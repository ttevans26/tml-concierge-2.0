import { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, MapPin } from "lucide-react";
import { useTripStore } from "@/stores/useTripStore";
import type { ItineraryItem } from "@/stores/useTripStore";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { useGooglePlaces, type PlaceResult } from "@/hooks/useGooglePlaces";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  date: string;
  category: ItineraryItem["category"];
}

const CATEGORY_LABELS: Record<ItineraryItem["category"], string> = {
  stays: "Stay",
  logistics: "Logistics",
  dining: "Dining",
  activity: "Activity",
  sites_of_interest: "Site of Interest",
};

const LOGISTICS_TYPES = [
  { value: "plane", label: "✈ Plane" },
  { value: "train", label: "🚆 Train" },
  { value: "bus", label: "🚌 Bus" },
  { value: "boat", label: "⛴ Boat" },
  { value: "car", label: "🚗 Private Car" },
];

const PLACES_TYPES: Record<string, string[]> = {
  stays: ["lodging"],
  dining: ["restaurant", "cafe", "bar"],
  activity: ["establishment"],
  sites_of_interest: ["tourist_attraction", "museum", "park"],
  logistics: [],
};

export default function AddItemDialog({
  open,
  onOpenChange,
  tripId,
  date,
  category,
}: AddItemDialogProps) {
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  // Stays-specific
  const [checkoutDate, setCheckoutDate] = useState("");
  const [location, setLocation] = useState("");

  // Logistics-specific
  const [logisticsType, setLogisticsType] = useState("plane");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [apiMetadata, setApiMetadata] = useState<Record<string, unknown>>({});

  const createItineraryItem = useTripStore((s) => s.createItineraryItem);
  const activeTrip = useTripStore((s) => s.activeTrip);

  const usePlaces = category !== "logistics";
  const { predictions, search: searchPlaces, getDetails, loading: placesLoading } = useGooglePlaces({
    types: PLACES_TYPES[category] || ["establishment"],
    enabled: usePlaces,
  });

  // Debounced search
  useEffect(() => {
    if (!usePlaces || !searchQuery.trim()) return;
    const timer = setTimeout(() => searchPlaces(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchPlaces, usePlaces]);

  const reset = () => {
    setTitle(""); setCost(""); setStartTime(""); setEndTime("");
    setSourceUrl(""); setSearchQuery(""); setShowResults(false);
    setCheckoutDate(""); setLocation("");
    setLogisticsType("plane"); setReferenceNumber("");
    setDeparture(""); setArrival(""); setLookingUp(false);
    setSelectedPlace(null); setGooglePlaceId(""); setApiMetadata({});
  };

  const selectPlace = async (prediction: { place_id: string; description: string }) => {
    setSearchQuery(prediction.description);
    setShowResults(false);
    const details = await getDetails(prediction.place_id);
    if (details) {
      setTitle(details.name);
      setLocation(details.address);
      setSourceUrl(details.website || "");
      setGooglePlaceId(details.placeId);
      setSelectedPlace(details);
      setApiMetadata({
        phone: details.phone,
        rating: details.rating,
        hours: details.hours,
        lat: details.lat,
        lng: details.lng,
      });
    } else {
      setTitle(prediction.description);
    }
  };

  const handleLookup = async () => {
    if (!referenceNumber.trim()) return;
    setLookingUp(true);
    // Simulated lookup delay
    await new Promise((r) => setTimeout(r, 800));
    const isPlane = logisticsType === "plane";
    setDeparture(isPlane ? "LAX" : "London St Pancras");
    setArrival(isPlane ? "CDG" : "Paris Gare du Nord");
    setStartTime(isPlane ? "10:30" : "08:01");
    setEndTime(isPlane ? "18:45" : "10:23");
    setTitle(`${referenceNumber.trim().toUpperCase()}`);
    setLookingUp(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim();
    if (!finalTitle) return;
    setSubmitting(true);

    // Multi-night stay bulk insert
    if (category === "stays" && checkoutDate && checkoutDate > date) {
      try {
        const nights = eachDayOfInterval({
          start: parseISO(date),
          end: parseISO(checkoutDate),
        }).slice(0, -1); // exclude checkout day

        for (const night of nights) {
          await createItineraryItem({
            trip_id: tripId,
            category,
            date: format(night, "yyyy-MM-dd"),
            title: finalTitle,
            cost: cost ? parseFloat(cost) : null,
            start_time: startTime || null,
            end_time: endTime || null,
            source_reference: sourceUrl || null,
            location_name: location || null,
          });
        }
      } catch (err) {
        console.error("Bulk insert error:", err);
      }
    } else {
      // Logistics: build a descriptive title if departure/arrival exist
      let itemTitle = finalTitle;
      if (category === "logistics" && departure && arrival) {
        itemTitle = `${finalTitle} · ${departure} → ${arrival}`;
      }

      await createItineraryItem({
        trip_id: tripId,
        category,
        date,
        title: itemTitle,
        cost: cost ? parseFloat(cost) : null,
        start_time: startTime || null,
        end_time: endTime || null,
        source_reference: sourceUrl || null,
        location_name: category === "stays" ? location || null : null,
      });
    }

    setSubmitting(false);
    reset();
    onOpenChange(false);
  };

  const placeholderText = category === "stays"
    ? "e.g. Park Hyatt Tokyo"
    : category === "dining"
    ? "e.g. Le Jules Verne"
    : category === "logistics"
    ? "e.g. AF 1234 or Eurostar 9021"
    : "e.g. Louvre Museum Tour";

  const maxDate = activeTrip?.end_date || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-thin border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-playfair text-lg text-foreground">
            Add {CATEGORY_LABELS[category]}
          </DialogTitle>
          <DialogDescription className="font-inter text-xs text-muted-foreground">
            {date} · {CATEGORY_LABELS[category]}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* ── STAYS ── */}
          {category === "stays" && (
            <>
              <div className="space-y-1.5">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Hotel Name
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); setTitle(e.target.value); }}
                    onFocus={() => searchQuery && setShowResults(true)}
                    placeholder={placeholderText}
                    required
                    className="border-thin border-border bg-background pl-8 font-inter text-sm"
                  />
                  {showResults && searchResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-sm border border-border bg-card shadow-md">
                      {searchResults.map((r) => (
                        <button
                          key={r.name}
                          type="button"
                          onClick={() => selectPlace(r)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left font-inter text-xs text-foreground hover:bg-secondary/40"
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Location
                </Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Shibuya, Tokyo"
                  className="border-thin border-border bg-background font-inter text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Nightly Rate ($)
                  </Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Check-out Date
                  </Label>
                  <Input
                    type="date"
                    value={checkoutDate}
                    onChange={(e) => setCheckoutDate(e.target.value)}
                    min={date}
                    max={maxDate}
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── DINING ── */}
          {category === "dining" && (
            <>
              <div className="space-y-1.5">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Restaurant Name
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); setTitle(e.target.value); }}
                    onFocus={() => searchQuery && setShowResults(true)}
                    placeholder={placeholderText}
                    required
                    className="border-thin border-border bg-background pl-8 font-inter text-sm"
                  />
                  {showResults && searchResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-sm border border-border bg-card shadow-md">
                      {searchResults.map((r) => (
                        <button
                          key={r.name}
                          type="button"
                          onClick={() => selectPlace(r)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left font-inter text-xs text-foreground hover:bg-secondary/40"
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Reservation Time
                  </Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Cost ($)
                  </Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── LOGISTICS ── */}
          {category === "logistics" && (
            <>
              <div className="space-y-1.5">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Transport Type
                </Label>
                <Select value={logisticsType} onValueChange={setLogisticsType}>
                  <SelectTrigger className="border-thin border-border bg-background font-inter text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGISTICS_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Flight / Train #
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={referenceNumber}
                    onChange={(e) => { setReferenceNumber(e.target.value); setTitle(e.target.value); }}
                    placeholder={placeholderText}
                    required
                    className="border-thin border-border bg-background font-inter text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLookup}
                    disabled={lookingUp || !referenceNumber.trim()}
                    className="shrink-0 border-thin border-border font-inter text-xs"
                  >
                    {lookingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Lookup"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Departure
                  </Label>
                  <Input
                    value={departure}
                    onChange={(e) => setDeparture(e.target.value)}
                    placeholder="e.g. LAX"
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Arrival
                  </Label>
                  <Input
                    value={arrival}
                    onChange={(e) => setArrival(e.target.value)}
                    placeholder="e.g. CDG"
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Depart Time
                  </Label>
                  <Input
                    type="time" value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Arrive Time
                  </Label>
                  <Input
                    type="time" value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Cost ($)
                </Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className="border-thin border-border bg-background font-inter text-sm"
                />
              </div>
            </>
          )}

          {/* ── ACTIVITY (generic) ── */}
          {category === "activity" && (
            <>
              <div className="space-y-1.5">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Title
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={placeholderText}
                  required
                  className="border-thin border-border bg-background font-inter text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    Start Time
                  </Label>
                  <Input
                    type="time" value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                    End Time
                  </Label>
                  <Input
                    type="time" value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="border-thin border-border bg-background font-inter text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Cost ($)
                </Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className="border-thin border-border bg-background font-inter text-sm"
                />
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="font-inter text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim()}
              className="bg-accent text-accent-foreground font-inter text-xs hover:bg-accent/90"
            >
              {submitting ? "Adding…" : category === "stays" && checkoutDate && checkoutDate > date
                ? `Add ${(() => { try { return eachDayOfInterval({ start: parseISO(date), end: parseISO(checkoutDate) }).length - 1; } catch { return 1; } })()} Night${(() => { try { const n = eachDayOfInterval({ start: parseISO(date), end: parseISO(checkoutDate) }).length - 1; return n !== 1 ? "s" : ""; } catch { return ""; } })()}`
                : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
