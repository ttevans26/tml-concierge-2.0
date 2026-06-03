import { useEffect, useMemo, useState } from "react";
import { format, parseISO, addDays, differenceInCalendarDays } from "date-fns";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PlaceAutocomplete, { type PlacePick } from "@/components/ui/PlaceAutocomplete";
import type { LocationLeg } from "@/lib/locationLegs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripStart: string;
  tripEnd: string;
  /** When editing an existing leg. */
  leg?: LocationLeg | null;
  /** Suggested initial start date (e.g. cell clicked) */
  initialStart?: string;
  onSave: (data: {
    id?: string;
    city: string;
    state: string | null;
    country: string | null;
    googlePlaceId: string | null;
    startDate: string;
    nights: number;
  }) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

/** Best-effort parse of "City, Region, Country" from Google's description string. */
function parseDescription(description: string, mainText: string, secondaryText: string) {
  const city = mainText || description.split(",")[0].trim();
  const parts = (secondaryText || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  let state: string | null = null;
  let country: string | null = null;
  if (parts.length === 1) {
    country = parts[0];
  } else if (parts.length >= 2) {
    state = parts[0];
    country = parts[parts.length - 1];
  }
  return { city, state, country };
}

export default function LocationLegDialog({
  open,
  onOpenChange,
  tripStart,
  tripEnd,
  leg,
  initialStart,
  onSave,
  onDelete,
}: Props) {
  const [city, setCity] = useState("");
  const [state, setState] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [nights, setNights] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (leg) {
      setCity(leg.city);
      setState(leg.state);
      setCountry(leg.country);
      setGooglePlaceId(leg.googlePlaceId ?? null);
      setStartDate(leg.startDate);
      setNights(leg.nights);
    } else {
      setCity("");
      setState(null);
      setCountry(null);
      setGooglePlaceId(null);
      setStartDate(initialStart || tripStart);
      setNights(1);
    }
  }, [open, leg, initialStart, tripStart]);

  const maxNights = useMemo(() => {
    if (!startDate || !tripEnd) return 30;
    const remaining = differenceInCalendarDays(parseISO(tripEnd), parseISO(startDate)) + 1;
    return Math.max(1, remaining);
  }, [startDate, tripEnd]);

  const endDate = useMemo(() => {
    if (!startDate) return "";
    return format(addDays(parseISO(startDate), nights - 1), "yyyy-MM-dd");
  }, [startDate, nights]);

  const handleSelect = (p: PlacePick) => {
    const parsed = parseDescription(p.description, p.mainText, p.secondaryText);
    setCity(parsed.city);
    setState(parsed.state);
    setCountry(parsed.country);
    setGooglePlaceId(p.placeId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !startDate) return;
    setSubmitting(true);
    await onSave({
      id: leg?.isGhost ? undefined : leg?.id,
      city: city.trim(),
      state,
      country,
      googlePlaceId,
      startDate,
      nights: Math.max(1, Math.min(maxNights, nights)),
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-thin border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl text-foreground">
            {leg && !leg.isGhost ? "Edit Location" : "Set Location"}
          </DialogTitle>
          <DialogDescription className="font-inter text-sm text-muted-foreground">
            Define the city, state, and country for this leg of the trip.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
              City
            </Label>
            <PlaceAutocomplete
              value={city}
              onChange={setCity}
              onSelect={handleSelect}
              placeholder="Search a city…"
              types="cities"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
                State / Region
              </Label>
              <Input
                value={state ?? ""}
                onChange={(e) => setState(e.target.value || null)}
                className="border-thin border-border bg-background font-inter"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
                Country
              </Label>
              <Input
                value={country ?? ""}
                onChange={(e) => setCountry(e.target.value || null)}
                className="border-thin border-border bg-background font-inter"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
                Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                min={tripStart}
                max={tripEnd}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-thin border-border bg-background font-inter"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
                Nights
              </Label>
              <Input
                type="number"
                min={1}
                max={maxNights}
                value={nights}
                onChange={(e) => setNights(Math.max(1, Number(e.target.value) || 1))}
                className="border-thin border-border bg-background font-inter"
              />
            </div>
          </div>

          {endDate && (
            <div className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Ends {format(parseISO(endDate), "EEE, MMM d")}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 pt-2 sm:justify-between">
            {leg && !leg.isGhost && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  if (!leg.id) return;
                  setSubmitting(true);
                  await onDelete(leg.id);
                  setSubmitting(false);
                  onOpenChange(false);
                }}
                className="font-inter text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="font-inter text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !city.trim()}
                className="bg-accent text-accent-foreground font-inter text-sm hover:bg-accent/90"
              >
                {submitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}